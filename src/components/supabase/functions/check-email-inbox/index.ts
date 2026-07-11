import { createClient } from 'npm:@supabase/supabase-js@2.54.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface EmailCheckRequest {
  email: string;
  password: string;
  service_id: string;
}

interface StreamingService {
  id: string;
  name: string;
  email_domains: string[];
}

interface EmailMessage {
  subject: string;
  from: string;
  date: string;
  body_preview: string;
  full_body?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify admin access
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const requestData: EmailCheckRequest = await req.json();
    const { email, password, service_id } = requestData;

    // Validate input
    if (!email || !password || !service_id) {
      return new Response(
        JSON.stringify({ error: 'Email, password and service_id are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Get streaming services configuration
    const { data: configData, error: configError } = await supabaseAdmin
      .from('system_config')
      .select('value')
      .eq('key', 'streaming_services_config')
      .maybeSingle();

    if (configError || !configData?.value) {
      return new Response(
        JSON.stringify({ error: 'Streaming services not configured' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const services: StreamingService[] = configData.value;
    const selectedService = services.find(s => s.id === service_id);

    if (!selectedService) {
      return new Response(
        JSON.stringify({ error: 'Service not found' }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Check email inbox
    const emailResult = await checkEmailInbox(email, password, selectedService);

    return new Response(
      JSON.stringify({
        success: emailResult.success,
        latest_email: emailResult.latest_email,
        error: emailResult.error,
        service_name: selectedService.name
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error checking email inbox:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error.message 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function checkEmailInbox(email: string, password: string, service: StreamingService): Promise<{
  success: boolean;
  latest_email?: EmailMessage;
  error?: string;
}> {
  try {
    // Simulate email checking (in a real implementation, you would use IMAP)
    // For demonstration, we'll create a mock response
    
    console.log(`Checking inbox for ${email} looking for emails from ${service.email_domains.join(', ')}`);
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Mock email data based on service
    const mockEmails: Record<string, EmailMessage> = {
      disney: {
        subject: 'Bem-vindo ao Disney+ - Sua assinatura está ativa',
        from: 'noreply@disney.com',
        date: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        body_preview: 'Olá! Sua assinatura do Disney+ foi ativada com sucesso. Agora você pode assistir a todos os seus filmes e séries favoritos...',
        full_body: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #113CCF; padding: 20px; text-align: center;">
              <h1 style="color: white; margin: 0;">Bem-vindo ao Disney+</h1>
            </div>
            <div style="padding: 20px;">
              <h2>Sua assinatura está ativa!</h2>
              <p>Olá,</p>
              <p>Sua assinatura do Disney+ foi ativada com sucesso. Agora você pode assistir a todos os seus filmes e séries favoritos da Disney, Pixar, Marvel, Star Wars e National Geographic.</p>
              <p><strong>Detalhes da sua conta:</strong></p>
              <ul>
                <li>Plano: Disney+ Premium</li>
                <li>Data de ativação: ${new Date().toLocaleDateString('pt-BR')}</li>
                <li>Próxima cobrança: ${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR')}</li>
              </ul>
              <p>Aproveite o melhor entretenimento!</p>
              <p>Equipe Disney+</p>
            </div>
          </div>
        `
      },
      netflix: {
        subject: 'Netflix - Confirmação de pagamento recebida',
        from: 'info@netflix.com',
        date: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // 5 hours ago
        body_preview: 'Recebemos seu pagamento de R$ 45,90 para sua assinatura Netflix. Sua conta continuará ativa até...',
        full_body: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #E50914; padding: 20px; text-align: center;">
              <h1 style="color: white; margin: 0;">Netflix</h1>
            </div>
            <div style="padding: 20px;">
              <h2>Pagamento confirmado</h2>
              <p>Olá,</p>
              <p>Recebemos seu pagamento de <strong>R$ 45,90</strong> para sua assinatura Netflix.</p>
              <p><strong>Detalhes do pagamento:</strong></p>
              <ul>
                <li>Valor: R$ 45,90</li>
                <li>Plano: Netflix Padrão</li>
                <li>Data do pagamento: ${new Date().toLocaleDateString('pt-BR')}</li>
                <li>Próxima cobrança: ${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR')}</li>
              </ul>
              <p>Sua conta continuará ativa. Obrigado por escolher a Netflix!</p>
              <p>Equipe Netflix</p>
            </div>
          </div>
        `
      },
      prime: {
        subject: 'Amazon Prime Video - Sua assinatura foi renovada',
        from: 'digital-no-reply@amazon.com',
        date: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), // 1 hour ago
        body_preview: 'Sua assinatura do Amazon Prime Video foi renovada automaticamente. Valor cobrado: R$ 14,90...',
        full_body: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #00A8E1; padding: 20px; text-align: center;">
              <h1 style="color: white; margin: 0;">Amazon Prime Video</h1>
            </div>
            <div style="padding: 20px;">
              <h2>Assinatura renovada</h2>
              <p>Olá,</p>
              <p>Sua assinatura do Amazon Prime Video foi renovada automaticamente.</p>
              <p><strong>Detalhes da renovação:</strong></p>
              <ul>
                <li>Valor cobrado: R$ 14,90</li>
                <li>Plano: Prime Video Mensal</li>
                <li>Data da renovação: ${new Date().toLocaleDateString('pt-BR')}</li>
                <li>Próxima renovação: ${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('pt-BR')}</li>
              </ul>
              <p>Continue aproveitando milhares de filmes e séries!</p>
              <p>Equipe Amazon Prime Video</p>
            </div>
          </div>
        `
      }
    };

    // Return mock email for the selected service
    const mockEmail = mockEmails[service_id];
    
    if (mockEmail) {
      return {
        success: true,
        latest_email: mockEmail
      };
    } else {
      return {
        success: false,
        error: 'Nenhum email encontrado dos domínios configurados para este serviço'
      };
    }

  } catch (error) {
    console.error('Error checking email inbox:', error);
    return {
      success: false,
      error: `Erro ao verificar email: ${error.message}`
    };
  }
}

// In a real implementation, you would use an IMAP library like this:
/*
async function checkEmailInboxReal(email: string, password: string, service: StreamingService): Promise<{
  success: boolean;
  latest_email?: EmailMessage;
  error?: string;
}> {
  try {
    // Determine IMAP settings based on email provider
    const imapConfig = getImapConfig(email);
    
    // Connect to IMAP server
    const imap = new ImapClient(imapConfig.host, imapConfig.port, {
      secure: imapConfig.secure,
      auth: {
        user: email,
        pass: password
      }
    });

    await imap.connect();
    await imap.selectMailbox('INBOX');

    // Search for emails from streaming service domains
    const searchCriteria = service.email_domains.map(domain => `FROM ${domain}`).join(' OR ');
    const messages = await imap.search(searchCriteria, { limit: 1, sortBy: 'date' });

    if (messages.length === 0) {
      await imap.close();
      return {
        success: false,
        error: 'Nenhum email encontrado dos domínios configurados para este serviço'
      };
    }

    // Get the latest message
    const latestMessage = messages[0];
    const messageData = await imap.fetchMessage(latestMessage.uid, {
      headers: true,
      body: true
    });

    await imap.close();

    return {
      success: true,
      latest_email: {
        subject: messageData.headers.subject,
        from: messageData.headers.from,
        date: messageData.headers.date,
        body_preview: messageData.bodyText?.substring(0, 200) + '...',
        full_body: messageData.bodyHtml || messageData.bodyText
      }
    };

  } catch (error) {
    console.error('Error checking email inbox:', error);
    return {
      success: false,
      error: `Erro ao verificar email: ${error.message}`
    };
  }
}

function getImapConfig(email: string) {
  const domain = email.split('@')[1].toLowerCase();
  
  switch (domain) {
    case 'gmail.com':
      return {
        host: 'imap.gmail.com',
        port: 993,
        secure: true
      };
    case 'outlook.com':
    case 'hotmail.com':
    case 'live.com':
      return {
        host: 'outlook.office365.com',
        port: 993,
        secure: true
      };
    case 'yahoo.com':
      return {
        host: 'imap.mail.yahoo.com',
        port: 993,
        secure: true
      };
    default:
      // Generic IMAP settings
      return {
        host: `imap.${domain}`,
        port: 993,
        secure: true
      };
  }
}
*/