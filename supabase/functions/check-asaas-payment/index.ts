import { createClient } from 'npm:@supabase/supabase-js@2.54.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface AsaasConfig {
  access_token: string;
  test_mode: boolean;
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
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid authentication' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { order_id } = await req.json();

    const { data: configData, error: configError } = await supabaseAdmin
      .from('system_config')
      .select('value')
      .eq('key', 'asaas_config')
      .maybeSingle();

    if (configError || !configData?.value) {
      return new Response(JSON.stringify({ error: 'Asaas configuration not found' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const config: AsaasConfig = configData.value;
    const apiBase = config.test_mode
      ? 'https://sandbox.asaas.com/v3'
      : 'https://api.asaas.com/v3';

    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('asaas_payments')
      .select('*')
      .eq('order_id', order_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (paymentError || !payment) {
      return new Response(JSON.stringify({ error: 'Payment not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const approvedStatuses = ['CONFIRMED', 'RECEIVED'];
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

    const asaasResponse = await fetch(`${apiBase}/payments/${payment.payment_id}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.access_token}`,
        'Content-Type': 'application/json',
      },
    });

    let asaasResult;
    try {
      asaasResult = await asaasResponse.json();
    } catch (parseError) {
      console.warn('Failed to parse Asaas API response:', parseError);
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

    if (!asaasResponse.ok) {
      console.warn('Asaas API access error:', { status: asaasResponse.status, error: asaasResult });
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

    const mappedStatus = approvedStatuses.includes(asaasResult.status) ? 'approved' : asaasResult.status;

    const { error: updateError } = await supabaseAdmin
      .from('asaas_payments')
      .update({
        status: asaasResult.status,
        status_detail: asaasResult.status,
        approved_at: approvedStatuses.includes(asaasResult.status) ? new Date().toISOString() : null,
        webhook_data: {
          ...payment.webhook_data,
          last_check: new Date().toISOString(),
          asaas_response: asaasResult,
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', payment.id);

    if (updateError) {
      console.error('Error updating payment:', updateError);
    }

    if (approvedStatuses.includes(asaasResult.status) && !payment.credits_added) {
      await processCreditAddition(supabaseAdmin, payment, asaasResult);
    }

    return new Response(JSON.stringify({
      success: true,
      payment: {
        id: asaasResult.id,
        status: mappedStatus,
        status_detail: asaasResult.status,
        date_approved: approvedStatuses.includes(asaasResult.status) ? new Date().toISOString() : null
      }
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error checking Asaas payment:', error);
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
    console.log('Processing credit addition for approved Asaas payment:', payment.id);

    const { data: existingTx } = await supabase
      .from('credit_transactions')
      .select('id')
      .eq('reference_id', payment.id)
      .eq('reference_type', 'asaas_payment')
      .maybeSingle();

    if (existingTx) {
      console.log('Credits already added for payment:', payment.id);
      await supabase
        .from('asaas_payments')
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
        description: `Recarga via Asaas - $${amountUSD.toFixed(2)} (cobrado R$${payment.amount_brl.toFixed(2)})`,
        reference_id: payment.id,
        reference_type: 'asaas_payment',
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
      .from('asaas_payments')
      .update({ credits_added: true, updated_at: new Date().toISOString() })
      .eq('id', payment.id);

    await supabase.rpc('create_notification', {
      p_user_id: payment.user_id,
      p_type: 'payment',
      p_title: 'Recarga Confirmada!',
      p_message: `Sua recarga de $${amountUSD.toFixed(2)} via Asaas foi confirmada! Valor cobrado: R$${payment.amount_brl.toFixed(2)}.`,
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

    console.log(`Successfully processed Asaas payment: ${paymentDetails.id}, credited $${amountUSD} to user ${payment.user_id}`);

  } catch (error) {
    console.error('Error processing credit addition:', error);
  }
}
