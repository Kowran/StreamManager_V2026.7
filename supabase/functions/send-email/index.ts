import { createClient } from "npm:@supabase/supabase-js@2.54.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  from_email: string;
  from_name: string;
  enabled: boolean;
}

interface SendEmailRequest {
  template_type: string;
  recipient_id?: string;
  recipient_email?: string;
  language?: string;
  variables?: Record<string, string | number>;
}

async function sendSmtpEmail(
  config: SmtpConfig,
  to: string,
  subject: string,
  html: string
): Promise<void> {
  const CRLF = "\r\n";
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  let conn: Deno.Conn;

  if (config.secure) {
    conn = await Deno.connectTls({ hostname: config.host, port: config.port });
  } else {
    conn = await Deno.connect({ hostname: config.host, port: config.port });
  }

  const readLine = async (): Promise<string> => {
    const buf: number[] = [];
    while (true) {
      const chunk = new Uint8Array(1);
      const n = await conn.read(chunk);
      if (n === null) break;
      buf.push(chunk[0]);
      if (chunk[0] === 0x0a) break;
    }
    return decoder.decode(new Uint8Array(buf)).trimEnd();
  };

  const sendCmd = async (cmd: string): Promise<string> => {
    await conn.write(encoder.encode(cmd + CRLF));
    const resp = await readLine();
    console.log(`SMTP < ${resp}`);
    return resp;
  };

  try {
    let greeting = await readLine();
    console.log(`SMTP < ${greeting}`);
    while (!greeting.startsWith("220 ")) {
      greeting = await readLine();
    }

    let resp = await sendCmd("EHLO marketplace.local");
    while (resp.startsWith("250-")) {
      resp = await readLine();
      console.log(`SMTP < ${resp}`);
    }
    if (!resp.startsWith("250 ")) {
      throw new Error(`EHLO failed: ${resp}`);
    }

    if (!config.secure) {
      resp = await sendCmd("STARTTLS");
      if (!resp.startsWith("220")) {
        throw new Error(`STARTTLS failed: ${resp}`);
      }
      conn = await Deno.startTls(conn, { hostname: config.host });
      resp = await sendCmd("EHLO marketplace.local");
      while (resp.startsWith("250-")) {
        resp = await readLine();
        console.log(`SMTP < ${resp}`);
      }
      if (!resp.startsWith("250 ")) {
        throw new Error(`EHLO after TLS failed: ${resp}`);
      }
    }

    resp = await sendCmd("AUTH LOGIN");
    if (!resp.startsWith("334")) {
      throw new Error(`AUTH LOGIN failed: ${resp}`);
    }
    resp = await sendCmd(btoa(config.username));
    if (!resp.startsWith("334")) {
      throw new Error(`Username auth failed: ${resp}`);
    }
    resp = await sendCmd(btoa(config.password));
    if (!resp.startsWith("235")) {
      throw new Error(`Password auth failed: ${resp}`);
    }

    resp = await sendCmd(`MAIL FROM:<${config.from_email}>`);
    if (!resp.startsWith("250")) {
      throw new Error(`MAIL FROM failed: ${resp}`);
    }
    resp = await sendCmd(`RCPT TO:<${to}>`);
    if (!resp.startsWith("250")) {
      throw new Error(`RCPT TO failed: ${resp}`);
    }
    resp = await sendCmd("DATA");
    if (!resp.startsWith("354")) {
      throw new Error(`DATA failed: ${resp}`);
    }

    const dateStr = new Date().toUTCString();
    const messageId = `<${Date.now()}.${Math.random().toString(36).substring(7)}@marketplace.local>`;
    const headers = [
      `From: "${config.from_name}" <${config.from_email}>`,
      `To: <${to}>`,
      `Subject: ${subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/html; charset=UTF-8`,
      `Date: ${dateStr}`,
      `Message-ID: ${messageId}`,
      "",
      "",
    ].join(CRLF);

    await conn.write(encoder.encode(headers + html + CRLF + "." + CRLF));
    resp = await readLine();
    console.log(`SMTP < ${resp}`);
    if (!resp.startsWith("250")) {
      throw new Error(`DATA send failed: ${resp}`);
    }

    await sendCmd("QUIT");
  } finally {
    try {
      conn.close();
    } catch {
      // ignore
    }
  }
}

function replaceVariables(
  template: string,
  variables: Record<string, string | number>
): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), String(value));
  }
  return result;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const body: SendEmailRequest = await req.json();
    const {
      template_type,
      recipient_id,
      recipient_email,
      language = "pt",
      variables = {},
    } = body;

    if (!template_type) {
      return new Response(
        JSON.stringify({ error: "template_type is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolve recipient email
    let email = recipient_email || "";
    let lang = language;

    if (recipient_id && !email) {
      const { data: profile, error: profileError } = await supabaseAdmin
        .from("profiles")
        .select("email, language, full_name")
        .eq("id", recipient_id)
        .maybeSingle();

      if (profileError || !profile) {
        return new Response(
          JSON.stringify({ error: "Could not fetch recipient profile" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      email = profile.email;
      if (!lang || lang === "pt") {
        lang = profile.language || "pt";
      }
    }

    if (!email) {
      return new Response(
        JSON.stringify({ error: "No recipient email resolved" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize language
    if (lang !== "pt" && lang !== "en" && lang !== "es") {
      lang = "pt";
    }

    // Fetch email template
    const { data: template, error: templateError } = await supabaseAdmin
      .from("email_templates")
      .select("subject, html_content, enabled")
      .eq("template_type", template_type)
      .eq("language", lang)
      .maybeSingle();

    if (templateError || !template) {
      // Fallback to Portuguese
      const { data: fallbackTemplate } = await supabaseAdmin
        .from("email_templates")
        .select("subject, html_content, enabled")
        .eq("template_type", template_type)
        .eq("language", "pt")
        .maybeSingle();

      if (!fallbackTemplate) {
        return new Response(
          JSON.stringify({ error: `Template '${template_type}' not found" ` }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      Object.assign(template, fallbackTemplate);
    }

    if (!template.enabled) {
      return new Response(
        JSON.stringify({ message: "Template is disabled, skipping email" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch SMTP config
    const { data: smtpConfig, error: smtpError } = await supabaseAdmin
      .from("smtp_config")
      .select("host, port, secure, username, password, from_email, from_name, enabled")
      .eq("enabled", true)
      .limit(1)
      .maybeSingle();

    if (smtpError || !smtpConfig) {
      return new Response(
        JSON.stringify({ error: "SMTP config not available or disabled" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Replace variables in subject and HTML
    const finalSubject = replaceVariables(template.subject, variables);
    const finalHtml = replaceVariables(template.html_content, variables);

    // Send email
    await sendSmtpEmail(smtpConfig as SmtpConfig, email, finalSubject, finalHtml);

    return new Response(
      JSON.stringify({ success: true, message: `Email sent to ${email}` }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("send-email error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Failed to send email" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
