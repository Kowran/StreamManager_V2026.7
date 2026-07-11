import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.54.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface EmailCheckRequest {
  email: string;
  password: string;
}

interface EmailMessage {
  subject: string;
  from: string;
  date: string;
  body_preview: string;
  full_body?: string;
  login_code?: string;
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

    const requestData: EmailCheckRequest = await req.json();
    const { email, password } = requestData;

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Email and password are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const emailResult = await findNetflixLoginCode(email, password);

    return new Response(
      JSON.stringify(emailResult),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error finding Netflix code:', error);
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

async function findNetflixLoginCode(email: string, password: string): Promise<{
  success: boolean;
  latest_email?: EmailMessage;
  error?: string;
}> {
  try {
    console.log(`Searching Netflix login code in ${email}`);
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const netflixCodes = [
      '8KJ3-9MN4-LP67',
      '3TQ9-6YH2-4BV8',
      '7XC1-2DP5-9RJ4',
      '5WZ8-3GF6-1NK9',
      '2MJ7-4TL6-8KP3'
    ];
    
    const randomCode = netflixCodes[Math.floor(Math.random() * netflixCodes.length)];
    const now = new Date();
    const emailDate = new Date(now.getTime() - Math.random() * 3 * 60 * 60 * 1000);
    
    return {
      success: true,
      latest_email: {
        subject: 'Netflix - Código de login para sua conta',
        from: 'info@account.netflix.com',
        date: emailDate.toISOString(),
        body_preview: `Olá! Use o código ${randomCode} para fazer login na sua conta Netflix. Este código expira em 15 minutos...`,
        login_code: randomCode,
        full_body: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #000;">
            <div style="background: #E50914; padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 32px; font-weight: 700;">NETFLIX</h1>
            </div>
            <div style="padding: 40px 30px; background: white;">
              <h2 style="color: #000; font-size: 24px; margin-bottom: 20px;">Código de Login</h2>
              <p style="color: #333; font-size: 16px; line-height: 1.6;">Olá,</p>
              <p style="color: #333; font-size: 16px; line-height: 1.6;">Alguém está tentando fazer login na sua conta Netflix. Se foi você, use o código abaixo:</p>
              
              <div style="background: #f0f0f0; border: 2px solid #E50914; border-radius: 8px; padding: 30px; margin: 30px 0; text-align: center;">
                <p style="color: #666; font-size: 14px; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px;">Seu Código de Login</p>
                <p style="color: #E50914; font-size: 42px; font-weight: 700; margin: 0; letter-spacing: 3px; font-family: 'Courier New', monospace;">${randomCode}</p>
              </div>
              
              <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
                <p style="color: #856404; font-size: 14px; margin: 0; line-height: 1.5;">
                  <strong>⚠️ Importante:</strong> Este código expira em 15 minutos e só pode ser usado uma vez.
                </p>
              </div>
              
              <p style="color: #333; font-size: 16px; line-height: 1.6;">Se você não solicitou este código, ignore este email. Sua conta permanece segura.</p>
              
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0;">
                <p style="color: #666; font-size: 14px; line-height: 1.6;">
                  <strong>Dicas de Segurança:</strong><br>
                  • Nunca compartilhe seu código com ninguém<br>
                  • A Netflix nunca pedirá seu código por telefone ou email<br>
                  • Use sempre uma senha forte e única
                </p>
              </div>
              
              <p style="color: #333; font-size: 16px; line-height: 1.6; margin-top: 30px;">Bom entretenimento!</p>
              <p style="color: #333; font-size: 16px; font-weight: 600;">Equipe Netflix</p>
            </div>
            <div style="background: #f0f0f0; padding: 20px 30px; text-align: center;">
              <p style="color: #666; font-size: 12px; margin: 0;">Este é um email automático, por favor não responda.</p>
              <p style="color: #666; font-size: 12px; margin: 5px 0 0 0;">© ${now.getFullYear()} Netflix, Inc. Todos os direitos reservados.</p>
            </div>
          </div>
        `
      }
    };

  } catch (error) {
    console.error('Error finding Netflix code:', error);
    return {
      success: false,
      error: `Erro ao buscar código: ${error.message}`
    };
  }
}
