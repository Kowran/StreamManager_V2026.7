/*
  # Fix store banners configuration storage

  1. Updates
    - Ensure store_banners configuration is properly stored in system_config
    - Add validation for banner configuration structure
    - Create function to validate banner JSON structure

  2. Functions
    - validate_banner_config: Validates banner configuration JSON
    - update_store_banners: Updates store banners with validation
*/

-- Function to validate banner configuration
CREATE OR REPLACE FUNCTION validate_banner_config(config_json jsonb)
RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  banner jsonb;
  required_fields text[] := ARRAY['id', 'title', 'description', 'image_url', 'active', 'order'];
  field text;
BEGIN
  -- Check if config is an array
  IF jsonb_typeof(config_json) != 'array' THEN
    RAISE EXCEPTION 'Banner configuration must be an array';
  END IF;

  -- Validate each banner
  FOR banner IN SELECT jsonb_array_elements(config_json)
  LOOP
    -- Check required fields
    FOREACH field IN ARRAY required_fields
    LOOP
      IF NOT (banner ? field) THEN
        RAISE EXCEPTION 'Banner missing required field: %', field;
      END IF;
    END LOOP;

    -- Validate field types
    IF jsonb_typeof(banner->'id') != 'string' THEN
      RAISE EXCEPTION 'Banner id must be a string';
    END IF;

    IF jsonb_typeof(banner->'title') != 'string' THEN
      RAISE EXCEPTION 'Banner title must be a string';
    END IF;

    IF jsonb_typeof(banner->'description') != 'string' THEN
      RAISE EXCEPTION 'Banner description must be a string';
    END IF;

    IF jsonb_typeof(banner->'image_url') != 'string' THEN
      RAISE EXCEPTION 'Banner image_url must be a string';
    END IF;

    IF jsonb_typeof(banner->'active') != 'boolean' THEN
      RAISE EXCEPTION 'Banner active must be a boolean';
    END IF;

    IF jsonb_typeof(banner->'order') != 'number' THEN
      RAISE EXCEPTION 'Banner order must be a number';
    END IF;

    -- Validate optional fields if present
    IF (banner ? 'link_url') AND jsonb_typeof(banner->'link_url') != 'string' THEN
      RAISE EXCEPTION 'Banner link_url must be a string';
    END IF;

    IF (banner ? 'button_text') AND jsonb_typeof(banner->'button_text') != 'string' THEN
      RAISE EXCEPTION 'Banner button_text must be a string';
    END IF;
  END LOOP;

  RETURN true;
END;
$$;

-- Function to safely update store banners
CREATE OR REPLACE FUNCTION update_store_banners(new_config jsonb)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Validate the configuration
  IF NOT validate_banner_config(new_config) THEN
    RAISE EXCEPTION 'Invalid banner configuration';
  END IF;

  -- Update or insert the configuration
  INSERT INTO system_config (key, value, description, updated_at)
  VALUES (
    'store_banners',
    new_config,
    'Configuração dos banners da loja',
    now()
  )
  ON CONFLICT (key) 
  DO UPDATE SET
    value = EXCLUDED.value,
    description = EXCLUDED.description,
    updated_at = EXCLUDED.updated_at;

  RETURN true;
END;
$$;

-- Ensure default banner configuration exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM system_config WHERE key = 'store_banners'
  ) THEN
    INSERT INTO system_config (key, value, description, created_at, updated_at)
    VALUES (
      'store_banners',
      '[
        {
          "id": "1",
          "title": "Bem-vindo à StreamManager Store",
          "description": "Encontre os melhores produtos premium com preços incríveis",
          "image_url": "https://images.pexels.com/photos/4009402/pexels-photo-4009402.jpeg?auto=compress&cs=tinysrgb&w=1200",
          "button_text": "Explorar Produtos",
          "active": true,
          "order": 1
        },
        {
          "id": "2",
          "title": "Produtos Premium Disponíveis", 
          "description": "Netflix, Disney+, Spotify e muito mais com entrega automática",
          "image_url": "https://images.pexels.com/photos/7991579/pexels-photo-7991579.jpeg?auto=compress&cs=tinysrgb&w=1200",
          "button_text": "Ver Catálogo",
          "active": true,
          "order": 2
        },
        {
          "id": "3",
          "title": "Entrega Instantânea",
          "description": "Receba suas credenciais imediatamente após a compra",
          "image_url": "https://images.pexels.com/photos/4050315/pexels-photo-4050315.jpeg?auto=compress&cs=tinysrgb&w=1200", 
          "button_text": "Comprar Agora",
          "active": true,
          "order": 3
        }
      ]'::jsonb,
      'Configuração padrão dos banners da loja',
      now(),
      now()
    );
  END IF;
END $$;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_system_config_key_banners 
ON system_config (key) 
WHERE key = 'store_banners';