/*
  # Separação de dados por usuário

  1. Alterações nas tabelas
    - Adicionar `user_id` às tabelas que não possuem
    - Atualizar dados existentes para pertencerem ao admin
    - Criar índices para performance

  2. Políticas de segurança
    - Atualizar RLS para filtrar por usuário
    - Manter acesso admin a todos os dados
    - Usuários só veem seus próprios dados

  3. Funções auxiliares
    - Função para identificar admin
    - Triggers para auto-preenchimento de user_id
*/

-- Primeiro, vamos identificar o usuário admin (primeiro usuário cadastrado)
DO $$
DECLARE
    admin_user_id uuid;
BEGIN
    -- Buscar o primeiro usuário cadastrado (assumindo que é o admin)
    SELECT id INTO admin_user_id 
    FROM auth.users 
    ORDER BY created_at ASC 
    LIMIT 1;
    
    -- Se não houver usuários, criar uma variável temporária
    IF admin_user_id IS NULL THEN
        admin_user_id := '00000000-0000-0000-0000-000000000000'::uuid;
    END IF;
    
    -- Adicionar user_id às tabelas que não possuem
    
    -- Tabela clients
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'clients' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE clients ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
        
        -- Atribuir dados existentes ao admin
        UPDATE clients SET user_id = admin_user_id WHERE user_id IS NULL;
        
        -- Criar índice
        CREATE INDEX IF NOT EXISTS idx_clients_user_id ON clients(user_id);
    END IF;
    
    -- Tabela sellers (já tem user_id, mas vamos garantir que dados existentes sejam do admin)
    UPDATE sellers SET user_id = admin_user_id WHERE user_id IS NULL;
    
    -- Tabela streaming_services (já tem user_id, mas vamos garantir que dados existentes sejam do admin)
    UPDATE streaming_services SET user_id = admin_user_id WHERE user_id IS NULL;
    
    -- Tabela streaming_accounts (já tem user_id, mas vamos garantir que dados existentes sejam do admin)
    UPDATE streaming_accounts SET user_id = admin_user_id WHERE user_id IS NULL;
END $$;

-- Função para verificar se o usuário é admin
CREATE OR REPLACE FUNCTION is_admin_user()
RETURNS boolean AS $$
DECLARE
    admin_user_id uuid;
BEGIN
    -- Buscar o primeiro usuário cadastrado (admin)
    SELECT id INTO admin_user_id 
    FROM auth.users 
    ORDER BY created_at ASC 
    LIMIT 1;
    
    RETURN auth.uid() = admin_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para auto-preencher user_id
CREATE OR REPLACE FUNCTION set_user_id()
RETURNS trigger AS $$
BEGIN
    IF NEW.user_id IS NULL THEN
        NEW.user_id := auth.uid();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para auto-preenchimento de user_id
DROP TRIGGER IF EXISTS set_user_id_clients ON clients;
CREATE TRIGGER set_user_id_clients
    BEFORE INSERT ON clients
    FOR EACH ROW EXECUTE FUNCTION set_user_id();

DROP TRIGGER IF EXISTS set_user_id_sellers ON sellers;
CREATE TRIGGER set_user_id_sellers
    BEFORE INSERT ON sellers
    FOR EACH ROW EXECUTE FUNCTION set_user_id();

DROP TRIGGER IF EXISTS set_user_id_streaming_services ON streaming_services;
CREATE TRIGGER set_user_id_streaming_services
    BEFORE INSERT ON streaming_services
    FOR EACH ROW EXECUTE FUNCTION set_user_id();

DROP TRIGGER IF EXISTS set_user_id_streaming_accounts ON streaming_accounts;
CREATE TRIGGER set_user_id_streaming_accounts
    BEFORE INSERT ON streaming_accounts
    FOR EACH ROW EXECUTE FUNCTION set_user_id();

-- Atualizar políticas RLS

-- Políticas para clients
DROP POLICY IF EXISTS "All authenticated users can manage clients" ON clients;

CREATE POLICY "Users can manage own clients"
    ON clients
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid() OR is_admin_user())
    WITH CHECK (user_id = auth.uid() OR is_admin_user());

-- Políticas para sellers
DROP POLICY IF EXISTS "All authenticated users can manage sellers" ON sellers;

CREATE POLICY "Users can manage own sellers"
    ON sellers
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid() OR is_admin_user())
    WITH CHECK (user_id = auth.uid() OR is_admin_user());

-- Políticas para streaming_services
DROP POLICY IF EXISTS "All authenticated users can manage streaming services" ON streaming_services;

CREATE POLICY "Users can manage own streaming services"
    ON streaming_services
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid() OR is_admin_user())
    WITH CHECK (user_id = auth.uid() OR is_admin_user());

-- Políticas para streaming_accounts
DROP POLICY IF EXISTS "All authenticated users can manage streaming accounts" ON streaming_accounts;

CREATE POLICY "Users can manage own streaming accounts"
    ON streaming_accounts
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid() OR is_admin_user())
    WITH CHECK (user_id = auth.uid() OR is_admin_user());

-- Políticas para account_profiles (baseado no user_id da conta)
DROP POLICY IF EXISTS "All authenticated users can manage account profiles" ON account_profiles;

CREATE POLICY "Users can manage own account profiles"
    ON account_profiles
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM streaming_accounts 
            WHERE streaming_accounts.id = account_profiles.account_id 
            AND (streaming_accounts.user_id = auth.uid() OR is_admin_user())
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM streaming_accounts 
            WHERE streaming_accounts.id = account_profiles.account_id 
            AND (streaming_accounts.user_id = auth.uid() OR is_admin_user())
        )
    );