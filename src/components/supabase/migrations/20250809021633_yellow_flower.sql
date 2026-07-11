/*
  # Sistema de Gerenciamento de Contas Streaming

  1. Tabelas Criadas
    - `sellers` - Vendedores responsáveis pelas vendas
    - `clients` - Clientes que compram as contas
    - `streaming_services` - Serviços de streaming disponíveis
    - `streaming_accounts` - Contas de streaming principais
    - `account_profiles` - Perfis dentro de cada conta

  2. Segurança
    - Habilitar RLS em todas as tabelas
    - Políticas para usuários autenticados lerem e modificarem dados
*/

-- Tabela de vendedores
CREATE TABLE IF NOT EXISTS sellers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE,
  phone text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabela de clientes
CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabela de serviços de streaming
CREATE TABLE IF NOT EXISTS streaming_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  max_profiles integer DEFAULT 4,
  monthly_price decimal(10,2),
  logo_url text,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Tabela de contas de streaming
CREATE TABLE IF NOT EXISTS streaming_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid REFERENCES streaming_services(id) ON DELETE CASCADE,
  seller_id uuid REFERENCES sellers(id) ON DELETE SET NULL,
  email text NOT NULL,
  password text NOT NULL,
  purchase_date date DEFAULT CURRENT_DATE,
  expiry_date date,
  total_profiles integer DEFAULT 4,
  used_profiles integer DEFAULT 0,
  monthly_price decimal(10,2) NOT NULL,
  status text DEFAULT 'active' CHECK (status IN ('active', 'expired', 'suspended')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabela de perfis das contas
CREATE TABLE IF NOT EXISTS account_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid REFERENCES streaming_accounts(id) ON DELETE CASCADE,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  profile_name text NOT NULL,
  assigned_date date DEFAULT CURRENT_DATE,
  price_paid decimal(10,2) NOT NULL,
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Inserir alguns serviços de streaming padrão
INSERT INTO streaming_services (name, max_profiles, monthly_price, logo_url) VALUES
  ('Netflix', 4, 55.90, 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=100&h=100&fit=crop'),
  ('Prime Video', 6, 14.90, 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=100&h=100&fit=crop'),
  ('Disney+', 4, 33.90, 'https://images.unsplash.com/photo-1543512214-318c7553f230?w=100&h=100&fit=crop'),
  ('HBO Max', 3, 34.90, 'https://images.unsplash.com/photo-1489599162163-13d5b447ab82?w=100&h=100&fit=crop'),
  ('Spotify', 1, 21.90, 'https://images.unsplash.com/photo-1611339555312-e607c8352fd7?w=100&h=100&fit=crop'),
  ('YouTube Premium', 5, 23.90, 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=100&h=100&fit=crop')
ON CONFLICT (name) DO NOTHING;

-- Habilitar RLS
ALTER TABLE sellers ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE streaming_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE streaming_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_profiles ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Usuários podem ler vendedores" ON sellers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuários podem inserir vendedores" ON sellers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Usuários podem atualizar vendedores" ON sellers FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Usuários podem deletar vendedores" ON sellers FOR DELETE TO authenticated USING (true);

CREATE POLICY "Usuários podem ler clientes" ON clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuários podem inserir clientes" ON clients FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Usuários podem atualizar clientes" ON clients FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Usuários podem deletar clientes" ON clients FOR DELETE TO authenticated USING (true);

CREATE POLICY "Usuários podem ler serviços" ON streaming_services FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuários podem inserir serviços" ON streaming_services FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Usuários podem atualizar serviços" ON streaming_services FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Usuários podem ler contas" ON streaming_accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuários podem inserir contas" ON streaming_accounts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Usuários podem atualizar contas" ON streaming_accounts FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Usuários podem deletar contas" ON streaming_accounts FOR DELETE TO authenticated USING (true);

CREATE POLICY "Usuários podem ler perfis" ON account_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Usuários podem inserir perfis" ON account_profiles FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Usuários podem atualizar perfis" ON account_profiles FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Usuários podem deletar perfis" ON account_profiles FOR DELETE TO authenticated USING (true);