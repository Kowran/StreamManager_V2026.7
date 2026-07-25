/*
# Discord Integration System

## Overview
Adds a complete Discord notification system: users can link their Discord account to receive
DM notifications for sales, disputes, cancellations, withdrawals, support tickets, and more.
Admins configure the Discord bot (token, guild), customize message templates per event type,
and manage the integration from a dedicated admin panel.

## New Tables

### discord_config (singleton, admin-managed)
- `id` (int, primary key, always 1)
- `bot_token` (text, encrypted bot token)
- `client_id` (text, Discord application client ID)
- `client_secret` (text, Discord application client secret)
- `guild_id` (text, Discord server ID where the bot operates)
- `enabled` (boolean, default false — master toggle)
- `bot_username` (text, cached bot username for display)
- `created_at`, `updated_at` (timestamps)

### discord_user_links
- `id` (uuid, primary key)
- `user_id` (uuid, references auth.users, unique — one Discord link per user)
- `discord_user_id` (text, Discord snowflake ID)
- `discord_username` (text, Discord username)
- `discord_avatar_url` (text, nullable)
- `verified` (boolean, default false)
- `verification_code` (text, nullable — 6-digit code sent to Discord DM)
- `verification_expires_at` (timestamptz, nullable)
- `notify_sales` (boolean, default true)
- `notify_disputes` (boolean, default true)
- `notify_cancellations` (boolean, default true)
- `notify_withdrawals` (boolean, default true)
- `notify_support` (boolean, default true)
- `notify_system` (boolean, default true)
- `linked_at` (timestamptz, default now)
- `updated_at` (timestamptz, default now)

### discord_message_templates
- `id` (uuid, primary key)
- `event_type` (text, unique)
- `event_label` (text, human-readable label)
- `title` (text, message title with {placeholders})
- `description` (text, message body with {placeholders})
- `color` (int, embed color, default 5814783)
- `enabled` (boolean, default true)
- `created_at`, `updated_at` (timestamps)

## Security
- RLS enabled on all tables.
- `discord_config`: admin-only CRUD.
- `discord_user_links`: users can read/insert/update/delete only their own row.
- `discord_message_templates`: admin-only write, admin-only read.
- Service role bypasses RLS for edge function operations.
*/

-- ============================================================
-- discord_config (admin singleton)
-- ============================================================
CREATE TABLE IF NOT EXISTS discord_config (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  bot_token text,
  client_id text,
  client_secret text,
  guild_id text,
  enabled boolean NOT NULL DEFAULT false,
  bot_username text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE discord_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_read_discord_config" ON discord_config;
CREATE POLICY "admin_read_discord_config" ON discord_config FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "admin_write_discord_config" ON discord_config;
CREATE POLICY "admin_write_discord_config" ON discord_config FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "admin_insert_discord_config" ON discord_config;
CREATE POLICY "admin_insert_discord_config" ON discord_config FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- ============================================================
-- discord_user_links
-- ============================================================
CREATE TABLE IF NOT EXISTS discord_user_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  discord_user_id text,
  discord_username text,
  discord_avatar_url text,
  verified boolean NOT NULL DEFAULT false,
  verification_code text,
  verification_expires_at timestamptz,
  notify_sales boolean NOT NULL DEFAULT true,
  notify_disputes boolean NOT NULL DEFAULT true,
  notify_cancellations boolean NOT NULL DEFAULT true,
  notify_withdrawals boolean NOT NULL DEFAULT true,
  notify_support boolean NOT NULL DEFAULT true,
  notify_system boolean NOT NULL DEFAULT true,
  linked_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE discord_user_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_discord_link" ON discord_user_links;
CREATE POLICY "select_own_discord_link" ON discord_user_links FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_discord_link" ON discord_user_links;
CREATE POLICY "insert_own_discord_link" ON discord_user_links FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_discord_link" ON discord_user_links;
CREATE POLICY "update_own_discord_link" ON discord_user_links FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_discord_link" ON discord_user_links;
CREATE POLICY "delete_own_discord_link" ON discord_user_links FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- discord_message_templates
-- ============================================================
CREATE TABLE IF NOT EXISTS discord_message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL UNIQUE,
  event_label text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  color integer NOT NULL DEFAULT 5814783,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE discord_message_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_read_discord_templates" ON discord_message_templates;
CREATE POLICY "admin_read_discord_templates" ON discord_message_templates FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "admin_insert_discord_templates" ON discord_message_templates;
CREATE POLICY "admin_insert_discord_templates" ON discord_message_templates FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "admin_update_discord_templates" ON discord_message_templates;
CREATE POLICY "admin_update_discord_templates" ON discord_message_templates FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

DROP POLICY IF EXISTS "admin_delete_discord_templates" ON discord_message_templates;
CREATE POLICY "admin_delete_discord_templates" ON discord_message_templates FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- ============================================================
-- Seed default message templates
-- ============================================================
INSERT INTO discord_message_templates (event_type, event_label, title, description, color, enabled) VALUES
  ('sale_completed', 'Venda Concluída', '💰 Nova Venda!', 'Você vendeu **{product_name}** por **{amount}**.\nComprador: {customer_name}\nPedido: #{order_id}', 3066993, true),
  ('sale_pending', 'Venda Pendente', '⏳ Venda em Andamento', 'Nova venda de **{product_name}** aguardando confirmação de pagamento.\nValor: **{amount}**\nComprador: {customer_name}', 15844367, true),
  ('dispute_opened', 'Disputa Aberta', '⚖️ Nova Disputa', 'Uma disputa foi aberta para o pedido #{order_id}.\nProduto: {product_name}\nMotivo: {reason}', 15158332, true),
  ('dispute_resolved', 'Disputa Resolvida', '✅ Disputa Resolvida', 'A disputa do pedido #{order_id} foi resolvida.\nDecisão: {decision}', 3066993, true),
  ('sale_cancelled', 'Venda Cancelada', '❌ Venda Cancelada', 'A venda #{order_id} de **{product_name}** foi cancelada.\nMotivo: {reason}', 10038562, true),
  ('withdrawal_approved', 'Saque Aprovado', '💸 Saque Aprovado', 'Seu saque de **{amount}** foi aprovado e está sendo processado.', 3066993, true),
  ('withdrawal_rejected', 'Saque Rejeitado', '🚫 Saque Rejeitado', 'Seu saque de **{amount}** foi rejeitado.\nMotivo: {reason}', 15158332, true),
  ('support_ticket', 'Ticket de Suporte', '🎫 Novo Ticket de Suporte', 'Você recebeu uma nova mensagem no ticket #{ticket_id}.\nAssunto: {subject}', 3447003, true),
  ('product_rating', 'Avaliação de Produto', '⭐ Nova Avaliação', 'Seu produto **{product_name}** recebeu uma avaliação de {rating} estrela(s).\nComentário: {comment}', 15844367, true),
  ('system_notification', 'Notificação do Sistema', '📢 Notificação do Sistema', '{message}', 5814783, true),
  ('order_completed', 'Pedido Concluído', '🎉 Pedido Concluído', 'Seu pedido #{order_id} de **{product_name}** foi concluído com sucesso!', 3066993, true),
  ('expiring_account', 'Conta Expirando', '⚠️ Conta Expirando', 'Sua conta de **{product_name}** expira em {days} dia(s).\nRenove para evitar interrupção.', 15158332, true)
ON CONFLICT (event_type) DO NOTHING;

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_discord_user_links_user_id ON discord_user_links(user_id);
CREATE INDEX IF NOT EXISTS idx_discord_user_links_discord_id ON discord_user_links(discord_user_id);
CREATE INDEX IF NOT EXISTS idx_discord_message_templates_event ON discord_message_templates(event_type);