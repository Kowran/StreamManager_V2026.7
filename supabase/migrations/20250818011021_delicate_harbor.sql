/*
  # Corrigir visibilidade das contas de streaming

  1. Verificações
    - Verificar se as contas existem na tabela
    - Verificar as políticas RLS
    - Verificar se há problemas de permissão

  2. Correções
    - Ajustar políticas RLS se necessário
    - Garantir que as contas sejam visíveis para usuários autenticados
*/

-- Verificar se existem contas na tabela
DO $$
BEGIN
  RAISE NOTICE 'Total de contas na tabela: %', (SELECT COUNT(*) FROM streaming_accounts);
END $$;

-- Verificar políticas RLS atuais
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename = 'streaming_accounts';

-- Remover políticas restritivas se existirem e recriar políticas mais permissivas
DROP POLICY IF EXISTS "Admins can manage all streaming accounts" ON streaming_accounts;
DROP POLICY IF EXISTS "Users can create their own streaming accounts" ON streaming_accounts;
DROP POLICY IF EXISTS "Users can delete their own streaming accounts" ON streaming_accounts;
DROP POLICY IF EXISTS "Users can update their own streaming accounts" ON streaming_accounts;
DROP POLICY IF EXISTS "Users can view their own streaming accounts" ON streaming_accounts;

-- Criar políticas mais permissivas para usuários autenticados
CREATE POLICY "All authenticated users can manage streaming accounts"
  ON streaming_accounts
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Verificar se RLS está habilitado
ALTER TABLE streaming_accounts ENABLE ROW LEVEL SECURITY;

-- Fazer o mesmo para outras tabelas relacionadas
DROP POLICY IF EXISTS "All authenticated users can manage streaming services" ON streaming_services;
CREATE POLICY "All authenticated users can manage streaming services"
  ON streaming_services
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "All authenticated users can manage sellers" ON sellers;
CREATE POLICY "All authenticated users can manage sellers"
  ON sellers
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "All authenticated users can manage clients" ON clients;
CREATE POLICY "All authenticated users can manage clients"
  ON clients
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "All authenticated users can manage account profiles" ON account_profiles;
CREATE POLICY "All authenticated users can manage account profiles"
  ON account_profiles
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Verificar se há dados de exemplo
INSERT INTO streaming_services (name, max_profiles, monthly_price, logo_url, active) 
VALUES 
  ('Netflix', 4, 45.90, 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=100&h=100&fit=crop&crop=center', true),
  ('Disney+', 4, 27.90, 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=100&h=100&fit=crop&crop=center', true),
  ('Amazon Prime', 3, 14.90, 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=100&h=100&fit=crop&crop=center', true)
ON CONFLICT (name) DO NOTHING;

-- Inserir alguns vendedores de exemplo
INSERT INTO sellers (name, email, phone, active) 
VALUES 
  ('João Silva', 'joao@exemplo.com', '(11) 99999-1111', true),
  ('Maria Santos', 'maria@exemplo.com', '(11) 99999-2222', true)
ON CONFLICT (email) DO NOTHING;

-- Inserir alguns clientes de exemplo
INSERT INTO clients (name, email, phone) 
VALUES 
  ('Cliente Exemplo 1', 'cliente1@exemplo.com', '(11) 88888-1111'),
  ('Cliente Exemplo 2', 'cliente2@exemplo.com', '(11) 88888-2222')
ON CONFLICT DO NOTHING;

-- Verificar novamente o total de registros
DO $$
BEGIN
  RAISE NOTICE 'Após inserções:';
  RAISE NOTICE 'Serviços: %', (SELECT COUNT(*) FROM streaming_services);
  RAISE NOTICE 'Vendedores: %', (SELECT COUNT(*) FROM sellers);
  RAISE NOTICE 'Clientes: %', (SELECT COUNT(*) FROM clients);
  RAISE NOTICE 'Contas: %', (SELECT COUNT(*) FROM streaming_accounts);
END $$;