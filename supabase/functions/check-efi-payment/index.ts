import { createClient } from 'npm:@supabase/supabase-js@2.54.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface EfiConfig {
  client_id: string;
  client_secret: string;
  pix_key: string;
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

async function getEfiAccessToken(config: EfiConfig): Promise<string> {
  const isSandbox = config.test_mode !== false;
  const oauthUrl = isSandbox
    ? 'https://sandbox.api.efipay.com.br/v1/authorize'
    : 'https://api.efipay.com.br/v1/authorize';

  const basicAuth = btoa(`${config.client_id}:${config.client_secret}`);

  const response = await fetch(oauthUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ grant_type: 'client_credentials' }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error_description || result.message || 'Falha na autenticacao OAuth');
  }

  return result.access_token;
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
      .eq('key', 'efi_config')
      .maybeSingle();

    if (configError || !configData?.value) {
      return new Response(JSON.stringify({ error: 'EFI Bank configuration not found' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const config: EfiConfig = configData.value;

    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('efi_payments')
      .select('*')
      .eq('order_id', order_id)
      .eq('user_id', userId)
      .maybeSingle();

    if (paymentError || !payment) {
      return new Response(JSON.stringify({ error: 'Payment not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const approvedStatuses = ['CONCLUIDA', 'APPROVED', 'COMPLETED', 'paid', 'approved', 'completed', 'settled'];
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

    if (!config.client_id?.trim() || !config.client_secret?.trim()) {
      return new Response(JSON.stringify({
        success: true,
        payment: {
          id: payment.payment_id,
          status: payment.status,
          status_detail: payment.status_detail,
          date_approved: payment.approved_at
        },
        source: 'local_database',
        note: 'Credenciais nao configuradas, exibindo status local'
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    try {
      const accessToken = await getEfiAccessToken(config);
      const isSandbox = config.test_mode !== false;
      const apiBase = isSandbox
        ? 'https://sandbox.api.efipay.com.br'
        : 'https://api.efipay.com.br';

      let apiStatus = payment.status;
      let apiResult: any = null;

      if (payment.billing_type === 'PIX') {
        const efiResponse = await fetch(`${apiBase}/v2/cob/${payment.payment_id}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (efiResponse.ok) {
          apiResult = await efiResponse.json();
          apiStatus = apiResult.status || payment.status;
        }
      } else {
        // Boleto - check charge status
        const efiResponse = await fetch(`${apiBase}/v1/charge/${payment.payment_id}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (efiResponse.ok) {
          apiResult = await efiResponse.json();
          apiStatus = apiResult.data?.status || apiResult.status || payment.status;
        }
      }

      const isApproved = approvedStatuses.includes(apiStatus);
      const mappedStatus = isApproved ? 'approved' : apiStatus;

      const { error: updateError } = await supabaseAdmin
        .from('efi_payments')
        .update({
          status: apiStatus,
          status_detail: apiStatus,
          approved_at: isApproved ? new Date().toISOString() : null,
          webhook_data: {
            ...payment.webhook_data,
            last_check: new Date().toISOString(),
            efi_response: apiResult,
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', payment.id);

      if (updateError) {
        console.error('Error updating payment:', updateError);
      }

      if (isApproved && !payment.credits_added) {
        await processCreditAddition(supabaseAdmin, payment, apiResult || {});
      }

      return new Response(JSON.stringify({
        success: true,
        payment: {
          id: payment.payment_id,
          status: mappedStatus,
          status_detail: apiStatus,
          date_approved: isApproved ? new Date().toISOString() : null
        }
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (apiError) {
      console.error('EFI API check failed, returning local status:', apiError);
      return new Response(JSON.stringify({
        success: true,
        payment: {
          id: payment.payment_id,
          status: payment.status,
          status_detail: payment.status_detail,
          date_approved: payment.approved_at
        },
        source: 'local_database',
        note: 'Status local devido a erro de acesso a API'
      }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('Error checking EFI payment:', error);
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
    console.log('Processing credit addition for approved EFI payment:', payment.id);

    const { data: existingTx } = await supabase
      .from('credit_transactions')
      .select('id')
      .eq('reference_id', payment.id)
      .eq('reference_type', 'efi_payment')
      .maybeSingle();

    if (existingTx) {
      console.log('Credits already added for payment:', payment.id);
      await supabase
        .from('efi_payments')
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
        description: `Recarga via EFI Bank - $${amountUSD.toFixed(2)} (cobrado R$${payment.amount_brl.toFixed(2)})`,
        reference_id: payment.id,
        reference_type: 'efi_payment',
        metadata: {
          payment_id: paymentDetails.txid || paymentDetails.data?.id,
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
      .from('efi_payments')
      .update({ credits_added: true, updated_at: new Date().toISOString() })
      .eq('id', payment.id);

    await supabase.rpc('create_notification', {
      p_user_id: payment.user_id,
      p_type: 'payment',
      p_title: 'Recarga Confirmada!',
      p_message: `Sua recarga de ${amountUSD.toFixed(2)} via EFI Bank foi confirmada! Valor cobrado: R$${payment.amount_brl.toFixed(2)}.`,
      p_data: {
        payment_id: paymentDetails.txid || paymentDetails.data?.id,
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

    console.log(`Successfully processed EFI payment, credited ${amountUSD} to user ${payment.user_id}`);

  } catch (error) {
    console.error('Error processing credit addition:', error);
  }
}
