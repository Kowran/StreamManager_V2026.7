-- Add withdrawal verification email template (pt-BR default + en + es)
INSERT INTO email_templates (template_type, language, subject, html_content, description, available_variables, enabled)
VALUES
  (
    'withdrawal_verification', 'pt',
    'Seu código de verificação para saque',
    '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #10b981;">Confirmação de Saque</h2>
      <p>Olá {full_name},</p>
      <p>Você solicitou um saque de <strong>{amount} {currency}</strong>.</p>
      <p>Use o código abaixo para confirmar sua solicitação:</p>
      <div style="text-align: center; margin: 24px 0;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #10b981; background: #f0fdf4; padding: 16px 32px; border-radius: 12px; display: inline-block;">{code}</span>
      </div>
      <p style="color: #6b7280; font-size: 14px;">Este código expira em 10 minutos. Se você não solicitou este saque, ignore este e-mail.</p>
    </div>',
    'Código de verificação para saque do vendedor',
    ARRAY['{full_name}', '{amount}', '{currency}', '{code}'],
    true
  ),
  (
    'withdrawal_verification', 'en',
    'Your withdrawal verification code',
    '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #10b981;">Withdrawal Confirmation</h2>
      <p>Hello {full_name},</p>
      <p>You requested a withdrawal of <strong>{amount} {currency}</strong>.</p>
      <p>Use the code below to confirm your request:</p>
      <div style="text-align: center; margin: 24px 0;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #10b981; background: #f0fdf4; padding: 16px 32px; border-radius: 12px; display: inline-block;">{code}</span>
      </div>
      <p style="color: #6b7280; font-size: 14px;">This code expires in 10 minutes. If you did not request this withdrawal, ignore this email.</p>
    </div>',
    'Seller withdrawal verification code',
    ARRAY['{full_name}', '{amount}', '{currency}', '{code}'],
    true
  ),
  (
    'withdrawal_verification', 'es',
    'Tu código de verificación para retiro',
    '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #10b981;">Confirmación de Retiro</h2>
      <p>Hola {full_name},</p>
      <p>Solicitaste un retiro de <strong>{amount} {currency}</strong>.</p>
      <p>Usa el código a continuación para confirmar tu solicitud:</p>
      <div style="text-align: center; margin: 24px 0;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #10b981; background: #f0fdf4; padding: 16px 32px; border-radius: 12px; display: inline-block;">{code}</span>
      </div>
      <p style="color: #6b7280; font-size: 14px;">Este código expira en 10 minutos. Si no solicitaste este retiro, ignora este correo.</p>
    </div>',
    'Código de verificación para retiro del vendedor',
    ARRAY['{full_name}', '{amount}', '{currency}', '{code}'],
    true
  )
ON CONFLICT (template_type, language) DO NOTHING;
