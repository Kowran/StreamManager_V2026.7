-- Add dispute_resolved email template (pt, en, es)
INSERT INTO public.email_templates (template_type, language, subject, html_content, description, available_variables, enabled)
VALUES
  (
    'dispute_resolved',
    'pt',
    'Disputa Resolvida - Pedido {{order_id}}',
    '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #1e40af;">Disputa Resolvida</h2>
      <p>Olá,</p>
      <p>A disputa relacionada ao pedido <strong>{{order_id}}</strong> foi resolvida pela administração.</p>
      <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 15px 0;">
        <p><strong>Produto:</strong> {{product_name}}</p>
        <p><strong>Cliente:</strong> {{customer_name}}</p>
        <p><strong>Vendedor:</strong> {{seller_name}}</p>
        <p><strong>Decisão do Admin:</strong> {{resolution_decision}}</p>
        <p><strong>Notas da Resolução:</strong> {{resolution_notes}}</p>
        <p><strong>Data da Resolução:</strong> {{resolved_at}}</p>
      </div>
      <p>Para mais detalhes, acesse a plataforma.</p>
      <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">Esta é uma mensagem automática, não responda.</p>
    </div>',
    'Email enviado quando uma disputa é resolvida pelo administrador',
    ARRAY['order_id', 'product_name', 'customer_name', 'seller_name', 'resolution_decision', 'resolution_notes', 'resolved_at'],
    true
  ),
  (
    'dispute_resolved',
    'en',
    'Dispute Resolved - Order {{order_id}}',
    '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #1e40af;">Dispute Resolved</h2>
      <p>Hello,</p>
      <p>The dispute related to order <strong>{{order_id}}</strong> has been resolved by the administration.</p>
      <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 15px 0;">
        <p><strong>Product:</strong> {{product_name}}</p>
        <p><strong>Customer:</strong> {{customer_name}}</p>
        <p><strong>Seller:</strong> {{seller_name}}</p>
        <p><strong>Admin Decision:</strong> {{resolution_decision}}</p>
        <p><strong>Resolution Notes:</strong> {{resolution_notes}}</p>
        <p><strong>Resolution Date:</strong> {{resolved_at}}</p>
      </div>
      <p>For more details, please access the platform.</p>
      <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">This is an automated message, do not reply.</p>
    </div>',
    'Email sent when a dispute is resolved by the administrator',
    ARRAY['order_id', 'product_name', 'customer_name', 'seller_name', 'resolution_decision', 'resolution_notes', 'resolved_at'],
    true
  ),
  (
    'dispute_resolved',
    'es',
    'Disputa Resuelta - Pedido {{order_id}}',
    '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #1e40af;">Disputa Resuelta</h2>
      <p>Hola,</p>
      <p>La disputa relacionada con el pedido <strong>{{order_id}}</strong> ha sido resuelta por la administración.</p>
      <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 15px 0;">
        <p><strong>Producto:</strong> {{product_name}}</p>
        <p><strong>Cliente:</strong> {{customer_name}}</p>
        <p><strong>Vendedor:</strong> {{seller_name}}</p>
        <p><strong>Decisión del Admin:</strong> {{resolution_decision}}</p>
        <p><strong>Notas de Resolución:</strong> {{resolution_notes}}</p>
        <p><strong>Fecha de Resolución:</strong> {{resolved_at}}</p>
      </div>
      <p>Para más detalles, acceda a la plataforma.</p>
      <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">Este es un mensaje automático, no responda.</p>
    </div>',
    'Correo enviado cuando se resuelve una disputa por el administrador',
    ARRAY['order_id', 'product_name', 'customer_name', 'seller_name', 'resolution_decision', 'resolution_notes', 'resolved_at'],
    true
  )
ON CONFLICT (template_type, language) DO UPDATE SET
  subject = EXCLUDED.subject,
  html_content = EXCLUDED.html_content,
  description = EXCLUDED.description,
  available_variables = EXCLUDED.available_variables,
  enabled = EXCLUDED.enabled,
  updated_at = now();

-- Insert dispute notification email config key
INSERT INTO public.system_config (key, value, description)
VALUES (
  'dispute_notification_email',
  '{"email": "", "enabled": false}'::jsonb,
  'Email address to receive notifications when a dispute is resolved by admin'
)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description;
