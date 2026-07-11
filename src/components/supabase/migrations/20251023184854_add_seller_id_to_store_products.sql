/*
  # Adicionar suporte para vendedores criarem produtos

  1. Alterações
    - Adiciona coluna `seller_id` em `store_products` para identificar o vendedor do produto
    - Atualiza políticas RLS para permitir que vendedores gerenciem seus próprios produtos
    - Admin pode gerenciar todos os produtos
    - Vendedores só podem gerenciar produtos que eles criaram

  2. Segurança
    - Vendedores só podem criar produtos se tiverem role='seller'
    - Vendedores só podem editar/deletar seus próprios produtos
    - Admin mantém acesso total a todos os produtos
    - Produtos sem seller_id são considerados produtos do admin (legado)
*/

-- Adicionar coluna seller_id à tabela store_products
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'store_products' AND column_name = 'seller_id'
  ) THEN
    ALTER TABLE store_products ADD COLUMN seller_id uuid REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Criar índice para melhorar performance de queries por vendedor
CREATE INDEX IF NOT EXISTS idx_store_products_seller_id ON store_products(seller_id);

-- Remover políticas antigas se existirem
DROP POLICY IF EXISTS "Anyone can view active products" ON store_products;
DROP POLICY IF EXISTS "Admins can manage all products" ON store_products;
DROP POLICY IF EXISTS "Sellers can view their own products" ON store_products;
DROP POLICY IF EXISTS "Sellers can create products" ON store_products;
DROP POLICY IF EXISTS "Sellers can update their own products" ON store_products;
DROP POLICY IF EXISTS "Sellers can delete their own products" ON store_products;

-- Política: Todos podem visualizar produtos ativos
CREATE POLICY "Anyone can view active products"
  ON store_products
  FOR SELECT
  TO authenticated
  USING (active = true OR EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND (profiles.role = 'admin' OR profiles.id = store_products.seller_id)
  ));

-- Política: Vendedores podem criar seus próprios produtos
CREATE POLICY "Sellers can create products"
  ON store_products
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (profiles.role = 'seller' OR profiles.role = 'admin')
    )
    AND (seller_id = auth.uid() OR seller_id IS NULL)
  );

-- Política: Admins podem atualizar todos os produtos, vendedores apenas os seus
CREATE POLICY "Sellers and admins can update products"
  ON store_products
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (
        profiles.role = 'admin'
        OR (profiles.role = 'seller' AND store_products.seller_id = auth.uid())
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (
        profiles.role = 'admin'
        OR (profiles.role = 'seller' AND seller_id = auth.uid())
      )
    )
  );

-- Política: Admins podem deletar todos os produtos, vendedores apenas os seus
CREATE POLICY "Sellers and admins can delete products"
  ON store_products
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (
        profiles.role = 'admin'
        OR (profiles.role = 'seller' AND store_products.seller_id = auth.uid())
      )
    )
  );