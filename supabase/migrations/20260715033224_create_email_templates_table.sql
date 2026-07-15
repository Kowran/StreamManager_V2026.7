/*
# Create email_templates table for admin-editable email templates

1. Purpose
- Stores HTML email templates for all transactional emails sent by the platform.
- Each template type has 3 language variants (pt, en, es).
- Admins can edit the HTML content, subject line, and enable/disable each template.
- Templates use {{variable_name}} placeholders that are replaced at send time.

2. New Tables
- `email_templates`
  - `id` (uuid, primary key)
  - `template_type` (text, NOT NULL) — e.g. 'sale_notification', 'recharge_deposit', etc.
  - `language` (text, NOT NULL) — 'pt', 'en', or 'es'
  - `subject` (text, NOT NULL) — email subject line
  - `html_content` (text, NOT NULL) — full HTML email body
  - `description` (text, NOT NULL) — instructions shown to admin about this template
  - `available_variables` (text[], default '{}') — list of {{variables}} available
  - `enabled` (boolean, NOT NULL, default true)
  - `created_at` (timestamptz, default now())
  - `updated_at` (timestamptz, default now())
  - UNIQUE constraint on (template_type, language)

3. Seed Data
- 7 template types × 3 languages = 21 default templates inserted.

4. Security
- RLS enabled on `email_templates`.
- Only admin users can SELECT, INSERT, UPDATE, DELETE.
- No access for anon or non-admin authenticated users.
*/

CREATE TABLE IF NOT EXISTS public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_type text NOT NULL,
  language text NOT NULL DEFAULT 'pt',
  subject text NOT NULL,
  html_content text NOT NULL,
  description text NOT NULL DEFAULT '',
  available_variables text[] NOT NULL DEFAULT '{}',
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT email_templates_type_language_unique UNIQUE (template_type, language)
);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- Only admins can read email templates
DROP POLICY IF EXISTS "admin_select_email_templates" ON public.email_templates;
CREATE POLICY "admin_select_email_templates"
ON public.email_templates FOR SELECT
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- Only admins can insert email templates
DROP POLICY IF EXISTS "admin_insert_email_templates" ON public.email_templates;
CREATE POLICY "admin_insert_email_templates"
ON public.email_templates FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- Only admins can update email templates
DROP POLICY IF EXISTS "admin_update_email_templates" ON public.email_templates;
CREATE POLICY "admin_update_email_templates"
ON public.email_templates FOR UPDATE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- Only admins can delete email templates
DROP POLICY IF EXISTS "admin_delete_email_templates" ON public.email_templates;
CREATE POLICY "admin_delete_email_templates"
ON public.email_templates FOR DELETE
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- ============================================================
-- SEED: sale_notification (to seller when a sale completes)
-- ============================================================
INSERT INTO public.email_templates (template_type, language, subject, html_content, description, available_variables) VALUES
('sale_notification', 'pt', 'Nova venda realizada!',
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #10b981;">Parabéns! Você realizou uma nova venda!</h2>
  <p>Olá,</p>
  <p>Uma nova venda foi registrada em sua loja. Aqui estão os detalhes:</p>
  <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Produto:</td><td style="padding: 8px; border: 1px solid #ddd;">{{product_name}}</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Quantidade:</td><td style="padding: 8px; border: 1px solid #ddd;">{{quantity}}</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Valor Total:</td><td style="padding: 8px; border: 1px solid #ddd;">${{total_price}} USDT</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Comprador:</td><td style="padding: 8px; border: 1px solid #ddd;">{{buyer_name}}</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Pedido #:</td><td style="padding: 8px; border: 1px solid #ddd;">{{order_id}}</td></tr>
  </table>
  <p>Acesse seu painel do vendedor para mais detalhes sobre esta venda.</p>
  <p style="color: #6b7280; font-size: 12px;">Este é um email automático, não responda.</p>
</div>',
'Enviado para o vendedor quando uma venda é finalizada. Variáveis: product_name, quantity, total_price, buyer_name, order_id.',
ARRAY['product_name', 'quantity', 'total_price', 'buyer_name', 'order_id'])
ON CONFLICT (template_type, language) DO NOTHING;

INSERT INTO public.email_templates (template_type, language, subject, html_content, description, available_variables) VALUES
('sale_notification', 'en', 'New sale completed!',
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #10b981;">Congratulations! You made a new sale!</h2>
  <p>Hello,</p>
  <p>A new sale has been registered in your store. Here are the details:</p>
  <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Product:</td><td style="padding: 8px; border: 1px solid #ddd;">{{product_name}}</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Quantity:</td><td style="padding: 8px; border: 1px solid #ddd;">{{quantity}}</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Total Amount:</td><td style="padding: 8px; border: 1px solid #ddd;">${{total_price}} USDT</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Buyer:</td><td style="padding: 8px; border: 1px solid #ddd;">{{buyer_name}}</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Order #:</td><td style="padding: 8px; border: 1px solid #ddd;">{{order_id}}</td></tr>
  </table>
  <p>Access your seller dashboard for more details about this sale.</p>
  <p style="color: #6b7280; font-size: 12px;">This is an automated email, please do not reply.</p>
</div>',
'Sent to the seller when a sale is completed. Variables: product_name, quantity, total_price, buyer_name, order_id.',
ARRAY['product_name', 'quantity', 'total_price', 'buyer_name', 'order_id'])
ON CONFLICT (template_type, language) DO NOTHING;

INSERT INTO public.email_templates (template_type, language, subject, html_content, description, available_variables) VALUES
('sale_notification', 'es', '¡Nueva venta realizada!',
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #10b981;">¡Felicidades! Has realizado una nueva venta!</h2>
  <p>Hola,</p>
  <p>Se ha registrado una nueva venta en tu tienda. Aquí están los detalles:</p>
  <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Producto:</td><td style="padding: 8px; border: 1px solid #ddd;">{{product_name}}</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Cantidad:</td><td style="padding: 8px; border: 1px solid #ddd;">{{quantity}}</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Monto Total:</td><td style="padding: 8px; border: 1px solid #ddd;">${{total_price}} USDT</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Comprador:</td><td style="padding: 8px; border: 1px solid #ddd;">{{buyer_name}}</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Pedido #:</td><td style="padding: 8px; border: 1px solid #ddd;">{{order_id}}</td></tr>
  </table>
  <p>Accede a tu panel de vendedor para más detalles sobre esta venta.</p>
  <p style="color: #6b7280; font-size: 12px;">Este es un correo automático, no respondas.</p>
</div>',
'Enviado al vendedor cuando se completa una venta. Variables: product_name, quantity, total_price, buyer_name, order_id.',
ARRAY['product_name', 'quantity', 'total_price', 'buyer_name', 'order_id'])
ON CONFLICT (template_type, language) DO NOTHING;

-- ============================================================
-- SEED: recharge_deposit (to user when balance is recharged)
-- ============================================================
INSERT INTO public.email_templates (template_type, language, subject, html_content, description, available_variables) VALUES
('recharge_deposit', 'pt', 'Recarga confirmada!',
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #10b981;">Sua recarga foi confirmada!</h2>
  <p>Olá {{user_name}},</p>
  <p>Sua recarga foi processada com sucesso. Veja os detalhes:</p>
  <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Valor recarregado:</td><td style="padding: 8px; border: 1px solid #ddd;">${{amount}} USDT</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Saldo atual:</td><td style="padding: 8px; border: 1px solid #ddd;">${{new_balance}} USDT</td></tr>
  </table>
  <p>O valor já está disponível em sua conta para uso.</p>
  <p style="color: #6b7280; font-size: 12px;">Este é um email automático, não responda.</p>
</div>',
'Enviado para o usuário quando uma recarga de saldo é confirmada. Variáveis: user_name, amount, new_balance.',
ARRAY['user_name', 'amount', 'new_balance'])
ON CONFLICT (template_type, language) DO NOTHING;

INSERT INTO public.email_templates (template_type, language, subject, html_content, description, available_variables) VALUES
('recharge_deposit', 'en', 'Recharge confirmed!',
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #10b981;">Your recharge has been confirmed!</h2>
  <p>Hello {{user_name}},</p>
  <p>Your recharge has been successfully processed. See the details:</p>
  <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Amount recharged:</td><td style="padding: 8px; border: 1px solid #ddd;">${{amount}} USDT</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Current balance:</td><td style="padding: 8px; border: 1px solid #ddd;">${{new_balance}} USDT</td></tr>
  </table>
  <p>The amount is now available in your account for use.</p>
  <p style="color: #6b7280; font-size: 12px;">This is an automated email, please do not reply.</p>
</div>',
'Sent to the user when a balance recharge is confirmed. Variables: user_name, amount, new_balance.',
ARRAY['user_name', 'amount', 'new_balance'])
ON CONFLICT (template_type, language) DO NOTHING;

INSERT INTO public.email_templates (template_type, language, subject, html_content, description, available_variables) VALUES
('recharge_deposit', 'es', '¡Recarga confirmada!',
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #10b981;">¡Tu recarga ha sido confirmada!</h2>
  <p>Hola {{user_name}},</p>
  <p>Tu recarga ha sido procesada con éxito. Mira los detalles:</p>
  <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Monto recargado:</td><td style="padding: 8px; border: 1px solid #ddd;">${{amount}} USDT</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Saldo actual:</td><td style="padding: 8px; border: 1px solid #ddd;">${{new_balance}} USDT</td></tr>
  </table>
  <p>El monto ya está disponible en tu cuenta para usar.</p>
  <p style="color: #6b7280; font-size: 12px;">Este es un correo automático, no respondas.</p>
</div>',
'Enviado al usuario cuando se confirma una recarga de saldo. Variables: user_name, amount, new_balance.',
ARRAY['user_name', 'amount', 'new_balance'])
ON CONFLICT (template_type, language) DO NOTHING;

-- ============================================================
-- SEED: purchase_confirmed (to buyer when purchase is confirmed)
-- ============================================================
INSERT INTO public.email_templates (template_type, language, subject, html_content, description, available_variables) VALUES
('purchase_confirmed', 'pt', 'Compra confirmada!',
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #10b981;">Sua compra foi confirmada!</h2>
  <p>Olá {{user_name}},</p>
  <p>Sua compra foi processada com sucesso. Aqui estão os detalhes:</p>
  <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Produto:</td><td style="padding: 8px; border: 1px solid #ddd;">{{product_name}}</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Quantidade:</td><td style="padding: 8px; border: 1px solid #ddd;">{{quantity}}</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Valor Total:</td><td style="padding: 8px; border: 1px solid #ddd;">${{total_price}} USDT</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Pedido #:</td><td style="padding: 8px; border: 1px solid #ddd;">{{order_id}}</td></tr>
  </table>
  <p>Acesse sua conta para ver os detalhes da entrega.</p>
  <p style="color: #6b7280; font-size: 12px;">Este é um email automático, não responda.</p>
</div>',
'Enviado para o comprador quando a compra é confirmada. Variáveis: user_name, product_name, quantity, total_price, order_id.',
ARRAY['user_name', 'product_name', 'quantity', 'total_price', 'order_id'])
ON CONFLICT (template_type, language) DO NOTHING;

INSERT INTO public.email_templates (template_type, language, subject, html_content, description, available_variables) VALUES
('purchase_confirmed', 'en', 'Purchase confirmed!',
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #10b981;">Your purchase has been confirmed!</h2>
  <p>Hello {{user_name}},</p>
  <p>Your purchase has been successfully processed. Here are the details:</p>
  <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Product:</td><td style="padding: 8px; border: 1px solid #ddd;">{{product_name}}</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Quantity:</td><td style="padding: 8px; border: 1px solid #ddd;">{{quantity}}</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Total Amount:</td><td style="padding: 8px; border: 1px solid #ddd;">${{total_price}} USDT</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Order #:</td><td style="padding: 8px; border: 1px solid #ddd;">{{order_id}}</td></tr>
  </table>
  <p>Access your account to view delivery details.</p>
  <p style="color: #6b7280; font-size: 12px;">This is an automated email, please do not reply.</p>
</div>',
'Sent to the buyer when a purchase is confirmed. Variables: user_name, product_name, quantity, total_price, order_id.',
ARRAY['user_name', 'product_name', 'quantity', 'total_price', 'order_id'])
ON CONFLICT (template_type, language) DO NOTHING;

INSERT INTO public.email_templates (template_type, language, subject, html_content, description, available_variables) VALUES
('purchase_confirmed', 'es', '¡Compra confirmada!',
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #10b981;">¡Tu compra ha sido confirmada!</h2>
  <p>Hola {{user_name}},</p>
  <p>Tu compra ha sido procesada con éxito. Aquí están los detalles:</p>
  <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Producto:</td><td style="padding: 8px; border: 1px solid #ddd;">{{product_name}}</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Cantidad:</td><td style="padding: 8px; border: 1px solid #ddd;">{{quantity}}</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Monto Total:</td><td style="padding: 8px; border: 1px solid #ddd;">${{total_price}} USDT</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Pedido #:</td><td style="padding: 8px; border: 1px solid #ddd;">{{order_id}}</td></tr>
  </table>
  <p>Accede a tu cuenta para ver los detalles de la entrega.</p>
  <p style="color: #6b7280; font-size: 12px;">Este es un correo automático, no respondas.</p>
</div>',
'Enviado al comprador cuando se confirma una compra. Variables: user_name, product_name, quantity, total_price, order_id.',
ARRAY['user_name', 'product_name', 'quantity', 'total_price', 'order_id'])
ON CONFLICT (template_type, language) DO NOTHING;

-- ============================================================
-- SEED: dispute_opened (to seller when buyer opens a dispute)
-- ============================================================
INSERT INTO public.email_templates (template_type, language, subject, html_content, description, available_variables) VALUES
('dispute_opened', 'pt', 'Nova disputa aberta - Pedido #{{order_id}}',
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #ef4444;">Uma disputa foi aberta em um de seus pedidos</h2>
  <p>Olá {{seller_name}},</p>
  <p>Um cliente abriu uma disputa em um pedido. Veja os detalhes:</p>
  <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Pedido #:</td><td style="padding: 8px; border: 1px solid #ddd;">{{order_id}}</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Produto:</td><td style="padding: 8px; border: 1px solid #ddd;">{{product_name}}</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Cliente:</td><td style="padding: 8px; border: 1px solid #ddd;">{{customer_name}}</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Assunto:</td><td style="padding: 8px; border: 1px solid #ddd;">{{dispute_subject}}</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Mensagem:</td><td style="padding: 8px; border: 1px solid #ddd;">{{dispute_message}}</td></tr>
  </table>
  <p>Acesse seu painel de suporte do vendedor para responder à disputa.</p>
  <p style="color: #6b7280; font-size: 12px;">Este é um email automático, não responda.</p>
</div>',
'Enviado para o vendedor quando um cliente abre uma disputa. Variáveis: seller_name, order_id, product_name, customer_name, dispute_subject, dispute_message.',
ARRAY['seller_name', 'order_id', 'product_name', 'customer_name', 'dispute_subject', 'dispute_message'])
ON CONFLICT (template_type, language) DO NOTHING;

INSERT INTO public.email_templates (template_type, language, subject, html_content, description, available_variables) VALUES
('dispute_opened', 'en', 'New dispute opened - Order #{{order_id}}',
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #ef4444;">A dispute has been opened on one of your orders</h2>
  <p>Hello {{seller_name}},</p>
  <p>A customer has opened a dispute on an order. See the details:</p>
  <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Order #:</td><td style="padding: 8px; border: 1px solid #ddd;">{{order_id}}</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Product:</td><td style="padding: 8px; border: 1px solid #ddd;">{{product_name}}</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Customer:</td><td style="padding: 8px; border: 1px solid #ddd;">{{customer_name}}</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Subject:</td><td style="padding: 8px; border: 1px solid #ddd;">{{dispute_subject}}</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Message:</td><td style="padding: 8px; border: 1px solid #ddd;">{{dispute_message}}</td></tr>
  </table>
  <p>Access your seller support panel to respond to the dispute.</p>
  <p style="color: #6b7280; font-size: 12px;">This is an automated email, please do not reply.</p>
</div>',
'Sent to the seller when a customer opens a dispute. Variables: seller_name, order_id, product_name, customer_name, dispute_subject, dispute_message.',
ARRAY['seller_name', 'order_id', 'product_name', 'customer_name', 'dispute_subject', 'dispute_message'])
ON CONFLICT (template_type, language) DO NOTHING;

INSERT INTO public.email_templates (template_type, language, subject, html_content, description, available_variables) VALUES
('dispute_opened', 'es', 'Nueva disputa abierta - Pedido #{{order_id}}',
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #ef4444;">Se ha abierto una disputa en uno de tus pedidos</h2>
  <p>Hola {{seller_name}},</p>
  <p>Un cliente ha abierto una disputa en un pedido. Mira los detalles:</p>
  <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Pedido #:</td><td style="padding: 8px; border: 1px solid #ddd;">{{order_id}}</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Producto:</td><td style="padding: 8px; border: 1px solid #ddd;">{{product_name}}</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Cliente:</td><td style="padding: 8px; border: 1px solid #ddd;">{{customer_name}}</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Asunto:</td><td style="padding: 8px; border: 1px solid #ddd;">{{dispute_subject}}</td></tr>
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Mensaje:</td><td style="padding: 8px; border: 1px solid #ddd;">{{dispute_message}}</td></tr>
  </table>
  <p>Accede a tu panel de soporte de vendedor para responder a la disputa.</p>
  <p style="color: #6b7280; font-size: 12px;">Este es un correo automático, no respondas.</p>
</div>',
'Enviado al vendedor cuando un cliente abre una disputa. Variables: seller_name, order_id, product_name, customer_name, dispute_subject, dispute_message.',
ARRAY['seller_name', 'order_id', 'product_name', 'customer_name', 'dispute_subject', 'dispute_message'])
ON CONFLICT (template_type, language) DO NOTHING;

-- ============================================================
-- SEED: seller_approved (to user when approved as seller)
-- ============================================================
INSERT INTO public.email_templates (template_type, language, subject, html_content, description, available_variables) VALUES
('seller_approved', 'pt', 'Parabéns! Você foi aprovado como vendedor!',
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #10b981;">Você foi aprovado como vendedor!</h2>
  <p>Olá {{user_name}},</p>
  <p>Boas notícias! Sua solicitação para se tornar vendedor foi aprovada.</p>
  <p>Agora você pode:</p>
  <ul>
    <li>Criar e gerenciar produtos em sua loja</li>
    <li>Acompanhar vendas e pedidos</li>
    <li>Gerenciar seus ganhos</li>
  </ul>
  <p>Acesse seu painel de vendedor para começar a vender agora mesmo!</p>
  <p style="color: #6b7280; font-size: 12px;">Este é um email automático, não responda.</p>
</div>',
'Enviado para o usuário quando sua solicitação de vendedor é aprovada. Variáveis: user_name.',
ARRAY['user_name'])
ON CONFLICT (template_type, language) DO NOTHING;

INSERT INTO public.email_templates (template_type, language, subject, html_content, description, available_variables) VALUES
('seller_approved', 'en', 'Congratulations! You have been approved as a seller!',
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #10b981;">You have been approved as a seller!</h2>
  <p>Hello {{user_name}},</p>
  <p>Great news! Your request to become a seller has been approved.</p>
  <p>You can now:</p>
  <ul>
    <li>Create and manage products in your store</li>
    <li>Track sales and orders</li>
    <li>Manage your earnings</li>
  </ul>
  <p>Access your seller dashboard to start selling now!</p>
  <p style="color: #6b7280; font-size: 12px;">This is an automated email, please do not reply.</p>
</div>',
'Sent to the user when their seller request is approved. Variables: user_name.',
ARRAY['user_name'])
ON CONFLICT (template_type, language) DO NOTHING;

INSERT INTO public.email_templates (template_type, language, subject, html_content, description, available_variables) VALUES
('seller_approved', 'es', '¡Felicidades! Has sido aprobado como vendedor!',
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #10b981;">¡Has sido aprobado como vendedor!</h2>
  <p>Hola {{user_name}},</p>
  <p>¡Buenas noticias! Tu solicitud para convertirte en vendedor ha sido aprobada.</p>
  <p>Ahora puedes:</p>
  <ul>
    <li>Crear y gestionar productos en tu tienda</li>
    <li>Seguir ventas y pedidos</li>
    <li>Gestionar tus ganancias</li>
  </ul>
  <p>¡Accede a tu panel de vendedor para empezar a vender ahora mismo!</p>
  <p style="color: #6b7280; font-size: 12px;">Este es un correo automático, no respondas.</p>
</div>',
'Enviado al usuario cuando su solicitud de vendedor es aprobada. Variables: user_name.',
ARRAY['user_name'])
ON CONFLICT (template_type, language) DO NOTHING;

-- ============================================================
-- SEED: account_created (to user when account is created)
-- ============================================================
INSERT INTO public.email_templates (template_type, language, subject, html_content, description, available_variables) VALUES
('account_created', 'pt', 'Bem-vindo ao Marketplace!',
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #10b981;">Bem-vindo, {{user_name}}!</h2>
  <p>Sua conta foi criada com sucesso no Marketplace!</p>
  <p>Agora você pode:</p>
  <ul>
    <li>Navegar e comprar produtos</li>
    <li>Recarregar seu saldo</li>
    <li>Participar da nossa comunidade</li>
  </ul>
  <p>Se tiver alguma dúvida, não hesite em contatar nosso suporte.</p>
  <p style="color: #6b7280; font-size: 12px;">Este é um email automático, não responda.</p>
</div>',
'Enviado para o usuário quando cria sua conta no site. Variáveis: user_name.',
ARRAY['user_name'])
ON CONFLICT (template_type, language) DO NOTHING;

INSERT INTO public.email_templates (template_type, language, subject, html_content, description, available_variables) VALUES
('account_created', 'en', 'Welcome to the Marketplace!',
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #10b981;">Welcome, {{user_name}}!</h2>
  <p>Your account has been successfully created on the Marketplace!</p>
  <p>You can now:</p>
  <ul>
    <li>Browse and purchase products</li>
    <li>Recharge your balance</li>
    <li>Join our community</li>
  </ul>
  <p>If you have any questions, do not hesitate to contact our support.</p>
  <p style="color: #6b7280; font-size: 12px;">This is an automated email, please do not reply.</p>
</div>',
'Sent to the user when they create their account on the site. Variables: user_name.',
ARRAY['user_name'])
ON CONFLICT (template_type, language) DO NOTHING;

INSERT INTO public.email_templates (template_type, language, subject, html_content, description, available_variables) VALUES
('account_created', 'es', '¡Bienvenido al Marketplace!',
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #10b981;">¡Bienvenido, {{user_name}}!</h2>
  <p>¡Tu cuenta ha sido creada con éxito en el Marketplace!</p>
  <p>Ahora puedes:</p>
  <ul>
    <li>Navegar y comprar productos</li>
    <li>Recargar tu saldo</li>
    <li>Unirte a nuestra comunidad</li>
  </ul>
  <p>Si tienes alguna pregunta, no dudes en contactar a nuestro soporte.</p>
  <p style="color: #6b7280; font-size: 12px;">Este es un correo automático, no respondas.</p>
</div>',
'Enviado al usuario cuando crea su cuenta en el sitio. Variables: user_name.',
ARRAY['user_name'])
ON CONFLICT (template_type, language) DO NOTHING;

-- ============================================================
-- SEED: user_banned (to user when banned)
-- ============================================================
INSERT INTO public.email_templates (template_type, language, subject, html_content, description, available_variables) VALUES
('user_banned', 'pt', 'Sua conta foi banida',
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #ef4444;">Sua conta foi banida</h2>
  <p>Olá {{user_name}},</p>
  <p>Sua conta no Marketplace foi banida.</p>
  <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Motivo:</td><td style="padding: 8px; border: 1px solid #ddd;">{{ban_reason}}</td></tr>
  </table>
  <p>Se você acredita que isso é um erro, entre em contato com o suporte.</p>
  <p style="color: #6b7280; font-size: 12px;">Este é um email automático, não responda.</p>
</div>',
'Enviado para o usuário quando sua conta é banida. Variáveis: user_name, ban_reason.',
ARRAY['user_name', 'ban_reason'])
ON CONFLICT (template_type, language) DO NOTHING;

INSERT INTO public.email_templates (template_type, language, subject, html_content, description, available_variables) VALUES
('user_banned', 'en', 'Your account has been banned',
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #ef4444;">Your account has been banned</h2>
  <p>Hello {{user_name}},</p>
  <p>Your account on the Marketplace has been banned.</p>
  <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Reason:</td><td style="padding: 8px; border: 1px solid #ddd;">{{ban_reason}}</td></tr>
  </table>
  <p>If you believe this is an error, please contact support.</p>
  <p style="color: #6b7280; font-size: 12px;">This is an automated email, please do not reply.</p>
</div>',
'Sent to the user when their account is banned. Variables: user_name, ban_reason.',
ARRAY['user_name', 'ban_reason'])
ON CONFLICT (template_type, language) DO NOTHING;

INSERT INTO public.email_templates (template_type, language, subject, html_content, description, available_variables) VALUES
('user_banned', 'es', 'Tu cuenta ha sido baneada',
'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #ef4444;">Tu cuenta ha sido baneada</h2>
  <p>Hola {{user_name}},</p>
  <p>Tu cuenta en el Marketplace ha sido baneada.</p>
  <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Motivo:</td><td style="padding: 8px; border: 1px solid #ddd;">{{ban_reason}}</td></tr>
  </table>
  <p>Si crees que esto es un error, comunícate con soporte.</p>
  <p style="color: #6b7280; font-size: 12px;">Este es un correo automático, no respondas.</p>
</div>',
'Enviado al usuario cuando su cuenta es baneada. Variables: user_name, ban_reason.',
ARRAY['user_name', 'ban_reason'])
ON CONFLICT (template_type, language) DO NOTHING;
