-- Fix 2: Email templates used {variable} but replaceVariables() expects {{variable}}.
-- Update all withdrawal_verification templates to use double braces.

UPDATE email_templates
SET subject = 'Seu código de verificação para saque',
    html_content = '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #10b981;">Confirmação de Saque</h2>
      <p>Olá {{full_name}},</p>
      <p>Você solicitou um saque de <strong>{{amount}} {{currency}}</strong>.</p>
      <p>Use o código abaixo para confirmar sua solicitação:</p>
      <div style="text-align: center; margin: 24px 0;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #10b981; background: #f0fdf4; padding: 16px 32px; border-radius: 12px; display: inline-block;">{{code}}</span>
      </div>
      <p style="color: #6b7280; font-size: 14px;">Este código expira em 10 minutos. Se você não solicitou este saque, ignore este e-mail.</p>
    </div>'
WHERE template_type = 'withdrawal_verification' AND language = 'pt';

UPDATE email_templates
SET subject = 'Your withdrawal verification code',
    html_content = '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #10b981;">Withdrawal Confirmation</h2>
      <p>Hello {{full_name}},</p>
      <p>You requested a withdrawal of <strong>{{amount}} {{currency}}</strong>.</p>
      <p>Use the code below to confirm your request:</p>
      <div style="text-align: center; margin: 24px 0;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #10b981; background: #f0fdf4; padding: 16px 32px; border-radius: 12px; display: inline-block;">{{code}}</span>
      </div>
      <p style="color: #6b7280; font-size: 14px;">This code expires in 10 minutes. If you did not request this withdrawal, ignore this email.</p>
    </div>'
WHERE template_type = 'withdrawal_verification' AND language = 'en';

UPDATE email_templates
SET subject = 'Tu código de verificación para retiro',
    html_content = '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #10b981;">Confirmación de Retiro</h2>
      <p>Hola {{full_name}},</p>
      <p>Solicitaste un retiro de <strong>{{amount}} {{currency}}</strong>.</p>
      <p>Usa el código a continuación para confirmar tu solicitud:</p>
      <div style="text-align: center; margin: 24px 0;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #10b981; background: #f0fdf4; padding: 16px 32px; border-radius: 12px; display: inline-block;">{{code}}</span>
      </div>
      <p style="color: #6b7280; font-size: 14px;">Este código expira en 10 minutos. Si no solicitaste este retiro, ignora este correo.</p>
    </div>'
WHERE template_type = 'withdrawal_verification' AND language = 'es';
