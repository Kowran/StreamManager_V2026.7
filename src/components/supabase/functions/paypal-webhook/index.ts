import { createClient } from 'npm:@supabase/supabase-js@2.54.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, PAYPAL-TRANSMISSION-ID, PAYPAL-CERT-ID, PAYPAL-AUTH-ALGO, PAYPAL-TRANSMISSION-TIME, PAYPAL-TRANSMISSION-SIG",
};

interface WebhookEvent {
  id: string;
  event_type: string;
  create_time: string;
  resource_type: string;
  event_version: string;
  summary: string;
  resource: any;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get request body
    const body = await req.text();
    console.log('PayPal webhook received:', body);

    let webhookEvent: WebhookEvent;
    try {
      webhookEvent = JSON.parse(body);
    } catch (parseError) {
      console.error('Invalid JSON in webhook body');
      return new Response('Invalid JSON', { status: 400, headers: corsHeaders });
    }

    console.log('Webhook event:', webhookEvent);

    // Handle the event
    switch (webhookEvent.event_type) {
      case 'CHECKOUT.ORDER.APPROVED':
        await handleOrderApproved(supabaseAdmin, webhookEvent.resource);
        break;
      
      case 'CHECKOUT.ORDER.COMPLETED':
        await handleOrderCompleted(supabaseAdmin, webhookEvent.resource);
        break;
      
      case 'PAYMENT.CAPTURE.COMPLETED':
        await handlePaymentCaptured(supabaseAdmin, webhookEvent.resource);
        break;
      
      case 'PAYMENT.CAPTURE.DENIED':
      case 'PAYMENT.CAPTURE.FAILED':
        await handlePaymentFailed(supabaseAdmin, webhookEvent.resource);
        break;
      
      default:
        console.log(`Unhandled event type: ${webhookEvent.event_type}`);
        break;
    }

    return new Response('OK', { 
      status: 200, 
      headers: corsHeaders 
    });

  } catch (error) {
    console.error('PayPal webhook processing error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Webhook processing failed',
        details: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function handleOrderApproved(supabase: any, resource: any) {
  try {
    console.log('Processing approved order:', resource.id);

    // Find the payment record by PayPal order ID
    const { data: payment, error: paymentError } = await supabase
      .from('paypal_payments')
      .select('*')
      .eq('paypal_order_id', resource.id)
      .single();

    if (paymentError || !payment) {
      console.error('Payment record not found for order:', resource.id);
      return;
    }

    // Update payment status to approved
    const { error: updateError } = await supabase
      .from('paypal_payments')
      .update({
        status: 'APPROVED',
        webhook_data: {
          ...payment.webhook_data,
          order_approved: resource,
          approved_at: new Date().toISOString()
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', payment.id);

    if (updateError) {
      console.error('Error updating approved payment:', updateError);
    }

    console.log(`PayPal order ${resource.id} approved`);
  } catch (error) {
    console.error('Error handling order approval:', error);
  }
}

async function handleOrderCompleted(supabase: any, resource: any) {
  try {
    console.log('Processing completed order:', resource.id);

    // Find the payment record by PayPal order ID
    const { data: payment, error: paymentError } = await supabase
      .from('paypal_payments')
      .select('*')
      .eq('paypal_order_id', resource.id)
      .single();

    if (paymentError || !payment) {
      console.error('Payment record not found for order:', resource.id);
      return;
    }

    // Update payment status to completed
    const { error: updateError } = await supabase
      .from('paypal_payments')
      .update({
        status: 'COMPLETED',
        completed_at: new Date().toISOString(),
        webhook_data: {
          ...payment.webhook_data,
          order_completed: resource,
          completed_at: new Date().toISOString()
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', payment.id);

    if (updateError) {
      console.error('Error updating completed payment:', updateError);
      return;
    }

    console.log(`PayPal order ${resource.id} completed`);
  } catch (error) {
    console.error('Error handling order completion:', error);
  }
}

async function handlePaymentCaptured(supabase: any, resource: any) {
  try {
    console.log('Processing captured payment:', resource.id);

    // Find the payment record by order reference
    const orderId = resource.custom_id || resource.invoice_id;
    
    const { data: payment, error: paymentError } = await supabase
      .from('paypal_payments')
      .select('*')
      .eq('order_id', orderId)
      .single();

    if (paymentError || !payment) {
      console.error('Payment record not found for capture:', resource.id);
      return;
    }

    // Update payment status to completed
    const { error: updateError } = await supabase
      .from('paypal_payments')
      .update({
        status: 'COMPLETED',
        completed_at: new Date().toISOString(),
        webhook_data: {
          ...payment.webhook_data,
          payment_captured: resource,
          captured_at: new Date().toISOString()
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', payment.id);

    if (updateError) {
      console.error('Error updating captured payment:', updateError);
      return;
    }

    console.log(`PayPal payment ${orderId} captured`);

  } catch (error) {
    console.error('Error handling payment capture:', error);
  }
}

async function handlePaymentFailed(supabase: any, resource: any) {
  try {
    console.log('Processing failed payment:', resource.id);

    const orderId = resource.custom_id || resource.invoice_id;
    
    const { data: payment, error: paymentError } = await supabase
      .from('paypal_payments')
      .select('*')
      .eq('order_id', orderId)
      .single();

    if (paymentError || !payment) {
      console.error('Payment record not found for failed payment:', resource.id);
      return;
    }

    // Update payment status to failed
    const { error: updateError } = await supabase
      .from('paypal_payments')
      .update({
        status: 'FAILED',
        webhook_data: {
          ...payment.webhook_data,
          payment_failed: resource,
          failed_at: new Date().toISOString(),
          failure_reason: resource.reason_code || 'Payment failed'
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', payment.id);

    if (updateError) {
      console.error('Error updating failed payment:', updateError);
    }

    console.log(`PayPal payment ${orderId} failed`);
  } catch (error) {
    console.error('Error handling payment failure:', error);
  }
}