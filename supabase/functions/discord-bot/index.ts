import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function createSupabaseClient() {
  return {
    from(table: string) {
      return {
        select: (columns?: string) => ({
          eq: (col: string, val: any) => ({
            maybeSingle: async () => {
              const url = `${SUPABASE_URL}/rest/v1/${table}?select=${columns || "*"}&${col}=eq.${encodeURIComponent(String(val))}`;
              const res = await fetch(url, {
                headers: {
                  apikey: SERVICE_ROLE_KEY,
                  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
                },
              });
              const arr = await res.json();
              return { data: Array.isArray(arr) && arr.length > 0 ? arr[0] : null, error: null };
            },
            limit: async (n: number) => {
              const url = `${SUPABASE_URL}/rest/v1/${table}?select=${columns || "*"}&${col}=eq.${encodeURIComponent(String(val))}&limit=${n}`;
              const res = await fetch(url, {
                headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
              });
              const arr = await res.json();
              return { data: arr, error: null };
            },
          }),
          order: (col: string, opts?: any) => ({
            limit: async (n: number) => {
              const dir = opts?.ascending === false ? "desc" : "asc";
              const url = `${SUPABASE_URL}/rest/v1/${table}?select=${columns || "*"}&order=${col}.${dir}&limit=${n}`;
              const res = await fetch(url, {
                headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
              });
              const arr = await res.json();
              return { data: arr, error: null };
            },
          }),
        }),
        insert: (data: any) => ({
          select: (cols?: string) => ({
            single: async () => {
              const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=${cols || "*"}`, {
                method: "POST",
                headers: {
                  apikey: SERVICE_ROLE_KEY,
                  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
                  "Content-Type": "application/json",
                  Prefer: "return=representation",
                },
                body: JSON.stringify(data),
              });
              const json = await res.json();
              return { data: Array.isArray(json) ? json[0] : json, error: null };
            },
          }),
        }),
        update: (data: any) => ({
          eq: (col: string, val: any) => ({
            select: (cols?: string) => ({
              single: async () => {
                const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${col}=eq.${encodeURIComponent(String(val))}&select=${cols || "*"}`, {
                  method: "PATCH",
                  headers: {
                    apikey: SERVICE_ROLE_KEY,
                    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
                    "Content-Type": "application/json",
                    Prefer: "return=representation",
                  },
                  body: JSON.stringify(data),
                });
                const json = await res.json();
                return { data: Array.isArray(json) ? json[0] : json, error: null };
              },
            }),
          }),
        }),
      };
    },
  };
}

const sb = createSupabaseClient();

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function fillTemplate(text: string, vars: Record<string, string>): string {
  let result = text;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), String(value || "—"));
  }
  return result;
}

async function getBotToken(): Promise<string | null> {
  const { data } = await sb.from("discord_config").select("*").eq("id", 1).maybeSingle();
  if (!data || !data.enabled || !data.bot_token) return null;
  return data.bot_token;
}

async function createDMChannel(botToken: string, userId: string): Promise<string | null> {
  try {
    const res = await fetch(`https://discord.com/api/v10/users/@me/channels`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ recipient_id: userId }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.id;
  } catch {
    return null;
  }
}

async function sendDiscordEmbed(botToken: string, channelId: string, embed: any): Promise<{ ok: boolean; error: string | null }> {
  try {
    const res = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ embeds: [embed] }),
    });
    if (!res.ok) {
      const errBody = await res.text();
      return { ok: false, error: `Discord API ${res.status}: ${errBody}` };
    }
    return { ok: true, error: null };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function fetchDiscordUser(botToken: string, discordUserId: string): Promise<any> {
  try {
    const res = await fetch(`https://discord.com/api/v10/users/${discordUserId}`, {
      headers: { Authorization: `Bot ${botToken}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function getBotInfo(botToken: string): Promise<any> {
  try {
    const res = await fetch(`https://discord.com/api/v10/users/@me`, {
      headers: { Authorization: `Bot ${botToken}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const action = body.action;

    // ─── SEND VERIFICATION CODE ───────────────────────────
    if (action === "send_verification") {
      const { user_id, discord_user_id } = body;
      if (!user_id || !discord_user_id) {
        return new Response(JSON.stringify({ error: "Missing user_id or discord_user_id" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const botToken = await getBotToken();
      if (!botToken) {
        return new Response(JSON.stringify({ error: "Discord bot not configured or disabled" }), {
          status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const discordUser = await fetchDiscordUser(botToken, discord_user_id);
      if (!discordUser) {
        return new Response(JSON.stringify({ error: "Discord user not found. Check the ID and make sure the bot shares a server with this user." }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const dmChannel = await createDMChannel(botToken, discord_user_id);
      if (!dmChannel) {
        return new Response(JSON.stringify({ error: "Could not send DM. The user must share a server with the bot and have DMs enabled." }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const code = generateCode();
      const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      const avatarUrl = discordUser.avatar
        ? `https://cdn.discordapp.com/avatars/${discord_user_id}/${discordUser.avatar}.png`
        : null;
      const username = discordUser.global_name || discordUser.username || discord_user_id;

      const { data: existing } = await sb.from("discord_user_links").select("*").eq("user_id", user_id).maybeSingle();

      if (existing) {
        await sb.from("discord_user_links").update({
          discord_user_id,
          discord_username: username,
          discord_avatar_url: avatarUrl,
          verification_code: code,
          verification_expires_at: expires,
          verified: false,
          updated_at: new Date().toISOString(),
        }).eq("user_id", user_id).select("*").single();
      } else {
        await sb.from("discord_user_links").insert({
          user_id,
          discord_user_id,
          discord_username: username,
          discord_avatar_url: avatarUrl,
          verification_code: code,
          verification_expires_at: expires,
          verified: false,
        }).select("*").single();
      }

      const dmResult = await sendDiscordEmbed(botToken, dmChannel, {
        title: "🔐 Verificação de Conta",
        description: `Seu código de verificação é:\n\n# **${code}**\n\nEste código expira em 10 minutos. Digite-o no site para vincular sua conta Discord.`,
        color: 5814783,
        footer: { text: "Se você não solicitou isso, ignore esta mensagem." },
      });

      if (!dmResult.ok) {
        return new Response(JSON.stringify({ error: `Não foi possível enviar a mensagem no Discord. Verifique se o bot compartilha um servidor com você e se suas DMs estão abertas. (${dmResult.error})` }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: true, message: "Verification code sent to Discord DM" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── VERIFY CODE ──────────────────────────────────────
    if (action === "verify_code") {
      const { user_id, code } = body;
      if (!user_id || !code) {
        return new Response(JSON.stringify({ error: "Missing user_id or code" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: link } = await sb.from("discord_user_links").select("*").eq("user_id", user_id).maybeSingle();
      if (!link) {
        return new Response(JSON.stringify({ error: "No pending verification. Request a code first." }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (link.verified) {
        return new Response(JSON.stringify({ error: "Account already verified" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (link.verification_code !== String(code).trim()) {
        return new Response(JSON.stringify({ error: "Invalid verification code" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (link.verification_expires_at && new Date(link.verification_expires_at) < new Date()) {
        return new Response(JSON.stringify({ error: "Verification code expired. Request a new one." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      await sb.from("discord_user_links").update({
        verified: true,
        verification_code: null,
        verification_expires_at: null,
        updated_at: new Date().toISOString(),
      }).eq("user_id", user_id).select("*").single();

      const botToken = await getBotToken();
      if (botToken && link.discord_user_id) {
        const dmChannel = await createDMChannel(botToken, link.discord_user_id);
        if (dmChannel) {
          await sendDiscordEmbed(botToken, dmChannel, {
            title: "✅ Conta Vinculada!",
            description: "Sua conta Discord foi vinculada com sucesso! Você receberá notificações aqui.",
            color: 3066993,
          });
        }
        // confirmation DM is best-effort; verification already succeeded
      }

      return new Response(JSON.stringify({ success: true, message: "Discord account verified" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── SEND NOTIFICATION ────────────────────────────────
    if (action === "send_notification") {
      const { user_id, event_type, variables } = body;
      if (!user_id || !event_type) {
        return new Response(JSON.stringify({ error: "Missing user_id or event_type" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const botToken = await getBotToken();
      if (!botToken) {
        return new Response(JSON.stringify({ error: "Discord bot not configured" }), {
          status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: link } = await sb.from("discord_user_links").select("*").eq("user_id", user_id).maybeSingle();
      if (!link || !link.verified || !link.discord_user_id) {
        return new Response(JSON.stringify({ error: "User has no verified Discord link" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const notifyMap: Record<string, string> = {
        sale_completed: "notify_sales",
        sale_pending: "notify_sales",
        sale_cancelled: "notify_cancellations",
        dispute_opened: "notify_disputes",
        dispute_resolved: "notify_disputes",
        withdrawal_approved: "notify_withdrawals",
        withdrawal_rejected: "notify_withdrawals",
        support_ticket: "notify_support",
        product_rating: "notify_sales",
        system_notification: "notify_system",
        order_completed: "notify_sales",
        expiring_account: "notify_system",
      };
      const prefCol = notifyMap[event_type];
      if (prefCol && link[prefCol] === false) {
        return new Response(JSON.stringify({ success: true, message: "User has disabled this notification type" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: template } = await sb.from("discord_message_templates").select("*").eq("event_type", event_type).maybeSingle();
      if (!template || !template.enabled) {
        return new Response(JSON.stringify({ error: "Template not found or disabled" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const vars = variables || {};
      const title = fillTemplate(template.title, vars);
      const description = fillTemplate(template.description, vars);

      const dmChannel = await createDMChannel(botToken, link.discord_user_id);
      if (!dmChannel) {
        return new Response(JSON.stringify({ error: "Could not create DM channel" }), {
          status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const sent = await sendDiscordEmbed(botToken, dmChannel, {
        title,
        description,
        color: template.color,
        timestamp: new Date().toISOString(),
        footer: { text: "Notificações da Plataforma" },
      });

      return new Response(JSON.stringify({ success: sent.ok, message: sent.ok ? "Notification sent" : `Failed to send: ${sent.error}` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── TEST BOT CONNECTION ───────────────────────────────
    if (action === "test_bot") {
      const { bot_token } = body;
      if (!bot_token) {
        return new Response(JSON.stringify({ error: "Missing bot_token" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const botInfo = await getBotInfo(bot_token);
      if (!botInfo) {
        return new Response(JSON.stringify({ error: "Invalid bot token or Discord API unreachable" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        success: true,
        bot_username: botInfo.username,
        bot_id: botInfo.id,
        bot_avatar: botInfo.avatar ? `https://cdn.discordapp.com/avatars/${botInfo.id}/${botInfo.avatar}.png` : null,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});