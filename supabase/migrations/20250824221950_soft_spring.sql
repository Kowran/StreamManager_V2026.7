/*
  # Create footer configuration

  1. System Configuration
    - Add footer_config to system_config table for admin-editable footer
    - Includes site name, description, social links, and copyright

  2. Default Configuration
    - Set default footer configuration values
    - Includes WhatsApp, email, and website links
*/

-- Insert default footer configuration
INSERT INTO system_config (key, value, description) VALUES (
  'footer_config',
  '{
    "site_name": "StreamManager",
    "description": "Plataforma completa para gerenciamento de contas de streaming",
    "social_links": {
      "whatsapp": "+5584996105167",
      "email": "contato@streammanager.com",
      "website": "https://streammanager.com"
    },
    "copyright": "© 2025 StreamManager. Todos os direitos reservados.",
    "configured": true
  }'::jsonb,
  'Configurações do rodapé da página inicial'
) ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = now();