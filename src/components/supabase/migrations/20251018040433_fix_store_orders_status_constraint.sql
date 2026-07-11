/*
  # Corrigir Constraint de Status do store_orders
  
  1. Problema
    - A constraint permite apenas: pending, paid, delivered, cancelled, refunded
    - Mas o trigger create_pending_delivery() tenta usar 'processing'
    
  2. Solução
    - Adicionar 'processing' aos status válidos
*/

-- Remover constraint antiga
ALTER TABLE store_orders DROP CONSTRAINT IF EXISTS store_orders_status_check;

-- Adicionar nova constraint com status 'processing'
ALTER TABLE store_orders ADD CONSTRAINT store_orders_status_check 
CHECK (status = ANY (ARRAY[
  'pending'::text,
  'processing'::text,
  'paid'::text,
  'delivered'::text,
  'cancelled'::text,
  'refunded'::text
]));