import { createClient } from 'npm:@supabase/supabase-js@2.54.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface PagBankConfig {
  api_token: string;
  test_mode: boolean;
}

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const jwtParts = token.split('.');
    if (jwtParts.length !== 3) {
      return new Response(JSON.stringify({ error: 'Invalid authentication' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const jwtPayload = JSON.parse(atob(jwtParts[1].replace(/-/g, '+').replace(/_/g, '/')));
    const userId = jwtPayload.sub;
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Invalid authentication' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { order_id } = await req.json();

    const { data: configData, error: configError } = await supabaseAdmin
      .from('system_config')
      .select('value')
      .eq('key', 'pagbank_config')
      .maybeSingle();

    if (configError || !configData?.value) {
      return new Response(JSON.stringify({ error: 'PagBank configuration not found' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const config: PagBankConfig = configData.value;

    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('pagbank_payments')
      .select('*')
      .eq('order_id', order_id)
      .eq('user_id', userId)
      .maybeSingle();

    if (paymentError || !payment) {
      return new Response(JSON.stringify({ error: 'Payment not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const approvedStatuses = ['PAID', 'APPROVED', 'COMPLETED', 'paid', 'approved', 'completed'];
    if (approvedStatuses.includes(payment.status)) {
      return new Response(JSON.stringify({
        success: true,
        payment: {
          id: payment.payment_id,
          status: 'approved',
          date_approved: payment.approved_at
        }
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!config.api_token?.trim()) {
      return new Response(JSON.stringify({
        success: true,
        payment: {
          id: payment.payment_id,
          status: payment.status,
          status_detail: payment.status_detail,
          date_approved: payment.approved_at
        },
        source: 'local_database',
        note: 'API token not configured, showing local status'
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const isSandbox = config.test_mode !== false;
    const apiBase = isSandbox
      ? 'https://sandbox.api.pagseguro.com'
      : 'https://api.pagseguro.com';

    const pagbankResponse = await fetch(`${apiBase}/orders/${payment.payment_id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.api_token}`,
        'Content-Type': 'application/json',
      },
    });

    let pagbankResult: any;
    try {
      pagbankResult = await pagbankResponse.json();
    } catch {
      return new Response(JSON.stringify({
        success: true,
        payment: {
          id: payment.payment_id,
          status: payment.status,
          status_detail: payment.status_detail,
          date_approved: payment.approved_at
        },
        source: 'local_database',
        note: 'Payment status from local database due to API response parsing error'
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!pagbankResponse.ok) {
      return new Response(JSON.stringify({
        success: true,
        payment: {
          id: payment.payment_id,
          status: payment.status,
          status_detail: payment.status_detail,
          date_approved: payment.approved_at
        },
        source: 'local_database',
        note: 'Payment status from local database due to API access limitations'
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const apiStatus = pagbankResult.status || pagbankResult.charges?.[0]?.status || 'pending';
    const isApproved = approvedStatuses.includes(apiStatus);
    const mappedStatus = isApproved ? 'approved' : apiStatus;

    const { error: updateError } = await supabaseAdmin
      .from('pagbank_payments')
      .update({
        status: apiStatus,
        status_detail: apiStatus,
        approved_at: isApproved ? new Date().toISOString() : null,
        webhook_data: {
          ...payment.webhook_data,
          last_check: new Date().toISOString(),
          pagbank_response: pagbankResult,
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', payment.id);

    if (updateError) {
      console.error('Error updating payment:', updateError);
    }

    if (isApproved && !payment.credits_added) {
      await processCreditAddition(supabaseAdmin, payment, pagbankResult);
    }

    return new Response(JSON.stringify({
      success: true,
      payment: {
        id: pagbankResult.id || payment.payment_id,
        status: mappedStatus,
        status_detail: apiStatus,
        date_approved: isApproved ? new Date().toISOString() : null
      }
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error checking PagBank payment:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message
    }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function processCreditAddition(supabase: any, payment: any, paymentDetails: any) {
  try {
    console.log('Processing credit addition for approved PagBank payment:', payment.id);

    const { data: existingTx } = await supabase
      .from('credit_transactions')
      .select('id')
      .eq('reference_id', payment.id)
      .eq('reference_type', 'pagbank_payment')
      .maybeSingle();

    if (existingTx) {
      console.log('Credits already added for payment:', payment.id);
      await supabase
        .from('pagbank_payments')
        .update({ credits_added: true, updated_at: new Date().toISOString() })
        .eq('id', payment.id);
      return;
    }

    const { data: userCredit, error: creditError } = await supabase
      .from('user_credits')
      .select('balance, total_recharged')
      .eq('user_id', payment.user_id)
      .maybeSingle();

    if (creditError && creditError.code !== 'PGRST116') {
      console.error('Error getting user credit:', creditError);
      return;
    }

    const currentBalance = userCredit?.balance || 0;
    const currentTotalRecharged = userCredit?.total_recharged || 0;
    const amountUSD = payment.amount_usd;
    const newBalance = currentBalance + amountUSD;
    const newTotalRecharged = currentTotalRecharged + amountUSD;

    const { error: transactionError } = await supabase
      .from('credit_transactions')
      .insert({
        user_id: payment.user_id,
        type: 'recharge',
        amount: amountUSD,
        balance_before: currentBalance,
        balance_after: newBalance,
        description: `Recarga via PagBank - $${amountUSD.toFixed(2)} (cobrado R$${payment.amount_brl.toFixed(2)})`,
        reference_id: payment.id,
        reference_type: 'pagbank_payment',
        metadata: {
          payment_id: paymentDetails.id,
          billing_type: payment.billing_type,
          currency: payment.currency,
          amount_brl: payment.amount_brl,
          amount_usd: amountUSD,
          status: paymentDetails.status,
        }
      });

    if (transactionError) {
      console.error('Error creating transaction:', transactionError);
      return;
    }

    const { error: creditUpdateError } = await supabase
      .from('user_credits')
      .upsert({
        user_id: payment.user_id,
        balance: newBalance,
        total_recharged: newTotalRecharged,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });

    if (creditUpdateError) {
      console.error('Error updating user credit:', creditUpdateError);
      return;
    }

    await supabase
      .from('pagbank_payments')
      .update({ credits_added: true, updated_at: new Date().toISOString() })
      .eq('id', payment.id);

    await supabase.rpc('create_notification', {
      p_user_id: payment.user_id,
      p_type: 'payment',
      p_title: 'Recarga Confirmada!',
      p_message: `Sua recarga de ${amountUSD.toFixed(2)} via PagBank foi confirmada! Valor cobrado: R$${payment.amount_brl.toFixed(2)}.`,
      p_data: {
        payment_id: paymentDetails.id,
        amount_usd: amountUSD,
        amount_brl: payment.amount_brl,
        billing_type: payment.billing_type,
        currency: payment.currency
      },
      p_priority: 'high',
      p_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    });

    await sendEmailNotification('recharge_deposit', payment.user_id, {
      user_name: 'Cliente',
      amount: amountUSD.toFixed(2),
      new_balance: newBalance.toFixed(2),
    });

    console.log(`Successfully processed PagBank payment: ${paymentDetails.id}, credited ${amountUSD} to user ${payment.user_id}`);

  } catch (error) {
    console.error('Error processing credit addition:', error);
  }
}
