/*
  # Sincronizar produtos da loja com serviços de streaming

  1. Operações
     - Inserir produtos na tabela store_products baseados nos streaming_services existentes
     - Configurar preços padrão e categorias apropriadas
     - Manter produtos existentes intactos

  2. Configurações
     - Categoria padrão: 'streaming'
     - Auto delivery: true (entrega automática)
     - Status: active (ativo)
     - Preços baseados no monthly_price dos serviços

  3. Segurança
     - Usar INSERT ... ON CONFLICT para evitar duplicatas
     - Manter integridade dos dados existentes
*/

-- Inserir produtos baseados nos serviços de streaming existentes
INSERT INTO store_products (
  name,
  description,
  price_brl,
  price_usdt,
  category,
  image_url,
  stock_quantity,
  auto_delivery,
  active
)
SELECT 
  ss.name,
  'Assinatura de ' || ss.name || ' com ' || ss.max_profiles || ' perfis disponíveis. Acesso completo à plataforma de streaming.',
  ss.monthly_price,
  ROUND(ss.monthly_price / 5.5, 2), -- Conversão aproximada BRL para USDT
  'streaming',
  ss.logo_url,
  100, -- Stock padrão
  true, -- Auto delivery
  ss.active
FROM streaming_services ss
WHERE ss.active = true
  AND NOT EXISTS (
    SELECT 1 
    FROM store_products sp 
    WHERE sp.name = ss.name 
      AND sp.category = 'streaming'
  );

-- Atualizar produtos existentes que correspondem aos serviços
UPDATE store_products 
SET 
  description = 'Assinatura de ' || ss.name || ' com ' || ss.max_profiles || ' perfis disponíveis. Acesso completo à plataforma de streaming.',
  price_brl = ss.monthly_price,
  price_usdt = ROUND(ss.monthly_price / 5.5, 2),
  image_url = COALESCE(store_products.image_url, ss.logo_url),
  active = ss.active,
  updated_at = now()
FROM streaming_services ss
WHERE store_products.name = ss.name 
  AND store_products.category = 'streaming';