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
): Promise<{ ok: boolean; data?: any; error?: string; httpStatus: number }> {
  const timestamp = Date.now();
  const recvWindow = 10000;

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

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'GET',
      headers: {
        'X-MBX-APIKEY': apiKey,
      },
    });
  } catch (fetchErr: any) {
    return { ok: false, error: `Falha de rede ao conectar com a Binance: ${fetchErr.message}`, httpStatus: 0 };
  }

  const rawText = await res.text();

  let parsed: any;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    return {
      ok: false,
      error: `Resposta inválida da Binance (HTTP ${res.status}): ${rawText.slice(0, 200)}`,
      httpStatus: res.status,
    };
  }

  // Binance success: { code: "000000", success: true, data: [...] }
  // Binance error:   { code: "-xxxx", msg: "..." }
  if (res.status >= 400 || (parsed.code && parsed.code !== '000000')) {
    const errMsg = parsed.msg || parsed.message || parsed.error || `HTTP ${res.status}`;
    console.error('Binance Pay API error response:', JSON.stringify(parsed));
    return { ok: false, error: `Binance API: ${errMsg} (código ${parsed.code || res.status})`, data: parsed, httpStatus: res.status };
  }

  return { ok: true, data: parsed, httpStatus: res.status };
}

/**
 * Extract the USDT amount from a transaction. Binance Pay returns the
 * primary `amount`/`currency` at the top level, but when multiple assets are
 * involved the actual USDT figure lives inside `fundsDetail`. We prefer a
 * USDT entry from fundsDetail and fall back to the top-level amount when the
 * currency itself is USDT.
 */
function extractUsdtAmount(tx: any): number | null {
  const fundsDetail: any[] = tx.fundsDetail || [];
  const usdtFund = fundsDetail.find(
    (f) => f.currency?.toUpperCase() === 'USDT'
  );
  if (usdtFund) {
    const v = parseFloat(usdtFund.amount);
    if (!isNaN(v)) return v;
  }
  if ((tx.currency || '').toUpperCase() === 'USDT') {
    const v = parseFloat(tx.amount);
    if (!isNaN(v)) return v;
  }
  return null;
}

/**
 * Compare two ID strings loosely. Binance's website ("Orders > Payment
 * History") labels the identifier as "Order ID" which may or may not include
 * the same prefix as the API `transactionId`. We match when one string is a
 * suffix of the other (after trimming spaces and ignoring case) so a user who
 * copies only the numeric portion still gets a hit.
 */
function idMatches(a: string, b: string): boolean {
  const na = a.trim().toLowerCase().replace(/\s+/g, '');
  const nb = b.trim().toLowerCase().replace(/\s+/g, '');
  if (!na || !nb) return false;
  if (na === nb) return true;
  // one is a suffix of the other (covers "M_P_12345" vs "12345")
  if (na.endsWith(nb) || nb.endsWith(na)) return true;
  // numeric cores match
  const coreA = na.replace(/[^0-9]/g, '');
  const coreB = nb.replace(/[^0-9]/g, '');
  if (coreA && coreB && coreA === coreB) return true;
  return false;
}

/**
 * Search recent incoming Pay transactions for one whose transactionId (or
 * orderId) matches the user-provided ID and whose USDT amount equals the
 * expected deposit amount. We look back up to 7 days in pages of 100.
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
    const result = await queryPayTransactions(
      { startTime: sevenDaysAgo, endTime: now },
      apiKey,
      apiSecret
    );

    if (!result.ok) {
      console.error('Binance Pay API error:', result.error);
      return { matched: false, reason: result.error || 'Erro ao consultar a Binance. Tente novamente.' };
    }

    const transactions: any[] = result.data?.data || [];
    console.log(`Binance Pay returned ${transactions.length} transactions in last 7 days`);

    let idFoundAmountMismatch: string | null = null;

    for (const tx of transactions) {
      const txAmount = extractUsdtAmount(tx);
      // Only consider incoming (positive) transfers
      if (txAmount === null || txAmount <= 0) continue;

      const txId: string = tx.transactionId || '';
      const txOrderId: string = tx.orderId || tx.orderID || '';
      console.log(`Checking tx transactionId=${txId} orderId=${txOrderId} amount=${txAmount} currency=${tx.currency} against user=${transactionId} expected=${expectedAmount}`);

      const idMatch = idMatches(txId, transactionId) || idMatches(txOrderId, transactionId);

      if (idMatch) {
        if (Math.abs(txAmount - expectedAmount) < 0.01) {
          return { matched: true };
        }
        idFoundAmountMismatch = `Transação encontrada, mas o valor (USDT ${txAmount.toFixed(2)}) não corresponde ao valor solicitado (USDT ${expectedAmount.toFixed(2)}).`;
        // keep scanning in case another record matches both ID and amount
      }
    }

    if (idFoundAmountMismatch) {
      return { matched: false, reason: idFoundAmountMismatch };
    }

    // Provide a helpful diagnostic so the user (and admin) can see what IDs
    // the API actually returned, making it easier to spot a copy/paste mismatch.
    const recentIds = transactions
      .filter((tx) => (extractUsdtAmount(tx) ?? 0) > 0)
      .slice(0, 10)
      .map((tx) => tx.transactionId || tx.orderId || '(sem id)')
      .join(', ');
    console.log(`No match for "${transactionId}". Recent incoming tx IDs: ${recentIds}`);

    return {
      matched: false,
      reason:
        'Transação não encontrada no histórico da Binance. Verifique o Order ID exibido em "Orders > Payment History" no site/app da Binance e tente novamente.',
    };
  } catch (err: any) {
    console.error('Error querying Binance Pay transactions:', err);
    return { matched: false, reason: `Erro inesperado: ${err.message || 'Tente novamente.'}` };
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

    // Block reuse of an Order ID that already completed a deposit. Binance Pay
    // Order IDs are globally unique, so we check across all users — if the same
    // Order ID already credited any account, refuse it here before hitting the
    // Binance API.
    const { data: alreadyUsed } = await supabase
      .from('binance_payments')
      .select('id, user_id, order_id')
      .eq('tx_id', trimmedUserOrderId)
      .eq('status', 'completed')
      .maybeSingle();

    if (alreadyUsed) {
      return new Response(JSON.stringify({
        status: 'failed',
        error: 'Este Order ID já foi utilizado para confirmar um depósito anteriormente. Não é possível reutilizá-lo.',
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

    // Transfer confirmed — credit the user's balance.
    // Use a conditional update (only flips pending → completed) so that if two
    // requests race for the same Order ID, only the first one wins and credits
    // the balance. The second update affects 0 rows and we abort without
    // double-crediting.
    const { data: updatedRow } = await supabase
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
      .eq('id', payment.id)
      .eq('status', 'pending')
      .select();

    if (!updatedRow || updatedRow.length === 0) {
      // Another request already completed this record — abort to avoid a duplicate credit.
      console.warn(`Concurrent completion blocked for payment ${payment.id} (Order ID ${trimmedUserOrderId})`);
      return new Response(JSON.stringify({
        status: 'failed',
        error: 'Este Order ID já foi utilizado para confirmar um depósito. Não é possível reutilizá-lo.',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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
