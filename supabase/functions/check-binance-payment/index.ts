import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

async function sendEmailNotification(
  templateType: string,
  recipientId: string,
  variables: Record<string, string | number>
): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const response = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        template_type: templateType,
        recipient_id: recipientId,
        variables,
      }),
    });
    if (!response.ok) {
      const errText = await response.text();
      console.error(`send-email failed for ${templateType}: ${errText}`);
    }
  } catch (err) {
    console.error(`Failed to send ${templateType} email (non-fatal):`, err);
  }
}

/**
 * Query Binance Pay Trade History to find an incoming transfer matching the
 * transaction ID and amount the user reported. This uses the C2C transfer
 * endpoint (GET /sapi/v1/pay/transactions) which does NOT create orders and
 * therefore incurs no merchant acquiring fees.
 *
 * Binance Pay REST API uses HMAC-SHA256 with the API secret on a query string.
 */
async function queryPayTransactions(
  params: { startTime?: number; endTime?: number },
  apiKey: string,
  apiSecret: string
): Promise<any> {
  const timestamp = Date.now();
  const recvWindow = 5000;

  const queryString = `timestamp=${timestamp}&recvWindow=${recvWindow}` +
    (params.startTime ? `&startTime=${params.startTime}` : '') +
    (params.endTime ? `&endTime=${params.endTime}` : '');

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(apiSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(queryString));
  const signature = Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0')).join('');

  const url = `https://api.binance.com/sapi/v1/pay/transactions?${queryString}&signature=${signature}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'X-MBX-APIKEY': apiKey,
    },
  });
  return res.json();
}

/**
 * Search recent incoming Pay transactions for one whose transactionId matches
 * the user-provided ID and whose amount equals the expected deposit amount.
 * We look back up to 7 days in pages of 100.
 */
async function findMatchingTransfer(
  transactionId: string,
  expectedAmount: number,
  apiKey: string,
  apiSecret: string
): Promise<{ matched: boolean; reason?: string }> {
  const now = Date.now();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

  try {
    let result = await queryPayTransactions(
      { startTime: sevenDaysAgo, endTime: now },
      apiKey,
      apiSecret
    );

    // Handle API error
    if (result.code && result.code !== '000000' && result.success !== true) {
      console.error('Binance Pay API error:', JSON.stringify(result));
      return { matched: false, reason: 'Erro ao consultar a Binance. Tente novamente.' };
    }

    const transactions: any[] = result.data || [];

    // Search through all returned transactions
    for (const tx of transactions) {
      // Only incoming transfers (positive amount) to our account
      const txAmount = parseFloat(tx.amount);
      if (txAmount <= 0) continue;

      // Match by transaction ID (Binance returns e.g. "M_P_71505104267788288")
      const txId: string = tx.transactionId || '';
      if (txId === transactionId) {
        // Verify the amount matches (allow tiny float tolerance)
        if (Math.abs(txAmount - expectedAmount) < 0.01) {
          return { matched: true };
        }
        return {
          matched: false,
          reason: `Transação encontrada, mas o valor (USDT ${txAmount.toFixed(2)}) não corresponde ao valor solicitado (USDT ${expectedAmount.toFixed(2)}).`,
        };
      }
    }

    return {
      matched: false,
      reason: 'Transação não encontrada no histórico da Binance. Verifique o Order ID e tente novamente.',
    };
  } catch (err) {
    console.error('Error querying Binance Pay transactions:', err);
    return { matched: false, reason: 'Erro ao conectar com a Binance. Tente novamente.' };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing authorization header');

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error('Invalid authentication');

    const { order_id, user_order_id } = await req.json();

    const trimmedUserOrderId = (user_order_id || '').trim();
    if (!trimmedUserOrderId) {
      return new Response(JSON.stringify({
        status: 'pending',
        error: 'Digite o ID da transação gerado pelo Binance Pay.',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find the pending payment record in our DB
    const { data: payment, error: paymentError } = await supabase
      .from('binance_payments')
      .select('*')
      .eq('order_id', order_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (paymentError || !payment) throw new Error('Payment record not found');

    if (payment.status === 'completed') {
      return new Response(JSON.stringify({ status: 'completed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (payment.status === 'failed') {
      return new Response(JSON.stringify({
        status: 'failed',
        error: 'Este pagamento foi marcado como falhou. Crie um novo.',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Load Binance API credentials
    const { data: config, error: configError } = await supabase
      .from('binance_config')
      .select('api_key, api_secret, is_active')
      .maybeSingle();

    if (configError || !config || !config.is_active) {
      return new Response(JSON.stringify({
        status: 'pending',
        error: 'Binance Pay não está configurado.',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const expectedAmount = parseFloat(payment.amount_usd) || 0;

    // Query Binance Pay Trade History to verify the transfer
    const { matched, reason } = await findMatchingTransfer(
      trimmedUserOrderId,
      expectedAmount,
      config.api_key,
      config.api_secret
    );

    if (!matched) {
      return new Response(JSON.stringify({
        status: 'pending',
        error: reason || 'Pagamento não confirmado pela Binance.',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Transfer confirmed — credit the user's balance
    await supabase
      .from('binance_payments')
      .update({
        status: 'completed',
        tx_id: trimmedUserOrderId,
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        webhook_data: {
          ...payment.webhook_data,
          transaction_id: trimmedUserOrderId,
          confirmed_via: 'pay_trade_history',
        },
      })
      .eq('id', payment.id);

    const { data: userCredits } = await supabase
      .from('user_credits')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    const currentBalance = userCredits?.balance || 0;
    const newBalance = currentBalance + expectedAmount;

    await supabase.from('user_credits').upsert({
      user_id: user.id,
      balance: newBalance,
      total_recharged: (userCredits?.total_recharged || 0) + expectedAmount,
    });

    await supabase.from('credit_transactions').insert({
      user_id: user.id,
      type: 'recharge',
      amount: expectedAmount,
      balance_before: currentBalance,
      balance_after: newBalance,
      description: `Recarga via Binance Pay - TxID ${trimmedUserOrderId}`,
      reference_type: 'binance_payment',
      reference_id: payment.id,
      metadata: { order_id, user_order_id: trimmedUserOrderId },
    });

    await sendEmailNotification('recharge_deposit', user.id, {
      user_name: 'Cliente',
      amount: expectedAmount.toFixed(2),
      new_balance: newBalance.toFixed(2),
    });

    return new Response(JSON.stringify({ status: 'completed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Error checking Binance payment:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Internal server error', status: 'pending' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
