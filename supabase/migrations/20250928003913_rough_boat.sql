/*
  # Sistema de Avaliação de Produtos

  1. Novas Tabelas
    - `product_ratings`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key para auth.users)
      - `product_id` (uuid, foreign key para store_products)
      - `rating` (integer, 1-5 estrelas)
      - `comment` (text, comentário opcional)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Views
    - `product_rating_summary`
      - Resumo das avaliações por produto incluindo média e distribuição

  3. Segurança
    - Enable RLS em `product_ratings`
    - Políticas para usuários lerem todas as avaliações
    - Políticas para usuários criarem/editarem apenas suas próprias avaliações
    - Restrição: usuários só podem avaliar produtos que compraram

  4. Funções
    - `can_user_rate_product` - verifica se usuário pode avaliar produto
    - Trigger para atualizar timestamp de `updated_at`

  5. Índices
    - Índices para performance em consultas de avaliações
*/

-- Criar tabela de avaliações de produtos
CREATE TABLE IF NOT EXISTS product_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES store_products(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, product_id) -- Um usuário só pode avaliar cada produto uma vez
);

-- Habilitar RLS
ALTER TABLE product_ratings ENABLE ROW LEVEL SECURITY;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_product_ratings_product_id ON product_ratings(product_id);
CREATE INDEX IF NOT EXISTS idx_product_ratings_user_id ON product_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_product_ratings_rating ON product_ratings(rating);
CREATE INDEX IF NOT EXISTS idx_product_ratings_created_at ON product_ratings(created_at DESC);

-- Função para verificar se usuário pode avaliar produto
CREATE OR REPLACE FUNCTION can_user_rate_product(p_user_id uuid, p_product_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verificar se o usuário comprou este produto
  RETURN EXISTS (
    SELECT 1 
    FROM user_purchases up
    WHERE up.user_id = p_user_id 
    AND up.product_id = p_product_id
    AND up.purchase_date < (now() - interval '1 hour') -- Pelo menos 1 hora após a compra
  );
END;
$$;

-- Políticas RLS para product_ratings
CREATE POLICY "Anyone can read product ratings"
  ON product_ratings
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create own ratings"
  ON product_ratings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can only rate purchased products"
  ON product_ratings
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND can_user_rate_product(auth.uid(), product_id));

CREATE POLICY "Users can update own ratings"
  ON product_ratings
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own ratings"
  ON product_ratings
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all ratings"
  ON product_ratings
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_product_ratings_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_product_ratings_updated_at
  BEFORE UPDATE ON product_ratings
  FOR EACH ROW
  EXECUTE FUNCTION update_product_ratings_updated_at();

-- View para resumo das avaliações por produto
CREATE OR REPLACE VIEW product_rating_summary AS
SELECT 
  p.id,
  p.name,
  p.category,
  p.price_usdt,
  p.active,
  COALESCE(ROUND(AVG(pr.rating)::numeric, 1), 0) as average_rating,
  COUNT(pr.id) as total_ratings,
  COUNT(CASE WHEN pr.rating = 5 THEN 1 END) as five_star_count,
  COUNT(CASE WHEN pr.rating = 4 THEN 1 END) as four_star_count,
  COUNT(CASE WHEN pr.rating = 3 THEN 1 END) as three_star_count,
  COUNT(CASE WHEN pr.rating = 2 THEN 1 END) as two_star_count,
  COUNT(CASE WHEN pr.rating = 1 THEN 1 END) as one_star_count
FROM store_products p
LEFT JOIN product_ratings pr ON p.id = pr.product_id
GROUP BY p.id, p.name, p.category, p.price_usdt, p.active;

-- Comentar a view
COMMENT ON VIEW product_rating_summary IS 'Resumo das avaliações por produto incluindo média e distribuição';

-- Função para obter produtos mais bem avaliados
CREATE OR REPLACE FUNCTION get_top_rated_products(limit_count integer DEFAULT 10)
RETURNS TABLE (
  product_id uuid,
  product_name text,
  average_rating numeric,
  total_ratings bigint,
  category text,
  price_usdt numeric
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    prs.id as product_id,
    prs.name as product_name,
    prs.average_rating,
    prs.total_ratings,
    prs.category,
    prs.price_usdt
  FROM product_rating_summary prs
  WHERE prs.active = true 
  AND prs.total_ratings > 0
  ORDER BY prs.average_rating DESC, prs.total_ratings DESC
  LIMIT limit_count;
$$;

-- Função para obter avaliações recentes
CREATE OR REPLACE FUNCTION get_recent_ratings(limit_count integer DEFAULT 20)
RETURNS TABLE (
  rating_id uuid,
  product_id uuid,
  product_name text,
  user_name text,
  user_email text,
  rating integer,
  comment text,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT 
    pr.id as rating_id,
    pr.product_id,
    sp.name as product_name,
    COALESCE(p.full_name, p.email) as user_name,
    p.email as user_email,
    pr.rating,
    pr.comment,
    pr.created_at
  FROM product_ratings pr
  JOIN store_products sp ON pr.product_id = sp.id
  JOIN profiles p ON pr.user_id = p.id
  WHERE sp.active = true
  ORDER BY pr.created_at DESC
  LIMIT limit_count;
$$;