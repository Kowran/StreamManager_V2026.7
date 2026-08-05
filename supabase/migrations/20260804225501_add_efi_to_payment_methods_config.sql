/*
# Add EFI Bank to payment_methods_config

1. Inserts the EFI Bank payment method into the payment_methods_config table
   so it appears in the admin payment methods toggle panel.
*/

INSERT INTO payment_methods_config (method_id, name, is_active, status, display_order)
VALUES ('efi', 'EFI Bank', false, 'inactive', 11)
ON CONFLICT (method_id) DO NOTHING;
