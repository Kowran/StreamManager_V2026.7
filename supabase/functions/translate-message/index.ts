import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.54.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface TranslationResponse {
  translatedText: string;
  detectedSourceLang?: string;
}

const LANGUAGE_MAP: Record<string, string> = {
  pt: "Portuguese",
  en: "English",
  es: "Spanish",
  fr: "French",
  de: "German",
  it: "Italian",
  ja: "Japanese",
  ko: "Korean",
  zh: "Chinese",
  ru: "Russian",
  ar: "Arabic",
  nl: "Dutch",
  pl: "Polish",
  tr: "Turkish",
  hi: "Hindi",
};

async function translateText(text: string, targetLang: string): Promise<TranslationResponse> {
  const targetFullName = LANGUAGE_MAP[targetLang] || "English";

  // Using Google Translate's free unofficial endpoint
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(text)}`;

  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; ChatTranslator/1.0)",
    },
  });

  if (!response.ok) {
    throw new Error(`Translation API returned ${response.status}`);
  }

  const data = await response.json();

  // Google Translate returns [[["translated","original",...],...], [sourceLang]]
  if (!data || !data[0] || !Array.isArray(data[0])) {
    throw new Error("Invalid translation response format");
  }

  const translatedText = data[0]
    .map((segment: any[]) => segment[0])
    .join("");

  const detectedSourceLang = data[2] || data[1]?.[1]?.[0] || undefined;

  return { translatedText, detectedSourceLang };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify the user is authenticated
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { message_id, target_lang, text } = await req.json();

    if (!message_id || !target_lang || !text) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: message_id, target_lang, text" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (text.length > 5000) {
      return new Response(
        JSON.stringify({ error: "Text too long (max 5000 characters)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if translation already cached
    const { data: cached } = await supabase
      .from("message_translations")
      .select("translated_text, source_lang")
      .eq("message_id", message_id)
      .eq("target_lang", target_lang)
      .maybeSingle();

    if (cached) {
      return new Response(
        JSON.stringify({
          translatedText: cached.translated_text,
          sourceLang: cached.source_lang,
          cached: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Perform translation
    const result = await translateText(text, target_lang);

    // Cache the translation
    await supabase.from("message_translations").insert({
      message_id,
      target_lang,
      translated_text: result.translatedText,
      source_lang: result.detectedSourceLang || null,
    });

    return new Response(
      JSON.stringify({
        translatedText: result.translatedText,
        sourceLang: result.detectedSourceLang,
        cached: false,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Translation failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
