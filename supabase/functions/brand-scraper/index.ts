import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { url } = await req.json();
    if (!url || typeof url !== "string" || url.trim().length < 4) {
      return new Response(JSON.stringify({ error: "A valid URL is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!firecrawlKey) {
      return new Response(JSON.stringify({ error: "Website import is not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith("http://") && !formattedUrl.startsWith("https://")) {
      formattedUrl = `https://${formattedUrl}`;
    }

    console.log("Scraping URL:", formattedUrl);

    // Step 1: Firecrawl scrape
    const scrapeRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${firecrawlKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: formattedUrl,
        formats: ["branding", "markdown"],
        onlyMainContent: false,
        waitFor: 3000,
      }),
    });

    const scrapeData = await scrapeRes.json();
    if (!scrapeRes.ok) {
      console.error("Firecrawl error:", scrapeData);
      return new Response(
        JSON.stringify({ error: scrapeData.error || "Failed to scrape website" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const branding = scrapeData.data?.branding || scrapeData.branding || {};
    const markdown = scrapeData.data?.markdown || scrapeData.markdown || "";
    const metadata = scrapeData.data?.metadata || scrapeData.metadata || {};

    console.log("Branding extracted, analyzing with AI...");

    // Step 2: AI analysis
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) {
      return new Response(JSON.stringify({ error: "AI gateway not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are a brand analyst. Given website branding data and page content, extract structured brand identity information.

IMPORTANT RULES:
- For colors: extract actual hex colors from the branding data. Map them to primary (1-3), secondary (1-3), and accent (1-3) categories.
- For typography: map detected fonts to the closest Google Font from this list: DM Sans, Inter, Poppins, Playfair Display, Montserrat, Lora, Raleway, Oswald, Merriweather, Roboto Slab, Space Grotesk, Outfit. If no match, default to "DM Sans" for primary and "Playfair Display" for secondary.
- For vibe: choose exactly ONE from: Minimal, Bold, Luxury, Playful, Corporate, Cinematic.
- For personality_traits: choose 3-5 from: Witty, Warm, Bold, Sophisticated, Approachable, Energetic, Calm, Edgy, Playful, Authoritative, Inspiring, Trustworthy.
- For tone_of_voice: write 1-2 sentences describing how the brand communicates.
- For audience: infer basic JTBD inputs from the website content.
- Return ONLY valid JSON matching the schema exactly.`;

    const userPrompt = `Analyze this website and extract brand identity:

BRANDING DATA:
${JSON.stringify(branding, null, 2)}

PAGE METADATA:
Title: ${metadata.title || ""}
Description: ${metadata.description || ""}

PAGE CONTENT (first 3000 chars):
${markdown.substring(0, 3000)}

Return a JSON object with this exact schema:
{
  "name": "string - brand/company name",
  "tagline": "string or null - brand tagline if found",
  "description": "string - 1-2 sentence brand description",
  "logo_url": "string or null - logo URL if found in branding data",
  "primary_colors": ["hex color strings"],
  "secondary_colors": ["hex color strings"],
  "accent_colors": ["hex color strings"],
  "typography_primary": "Google Font name for body text",
  "typography_secondary": "Google Font name for headings",
  "vibe": "one of: Minimal, Bold, Luxury, Playful, Corporate, Cinematic",
  "tone_of_voice": "1-2 sentence description",
  "personality_traits": ["3-5 trait strings"],
  "audience_raw_inputs": {
    "who_buys": "string",
    "life_stage": "string",
    "improving": "string",
    "frustrations": "string",
    "success_looks_like": "string"
  }
}`;

    const aiRes = await fetch("https://ai.lovable.dev/api/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.1-pro-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    const aiData = await aiRes.json();
    if (!aiRes.ok) {
      console.error("AI error:", aiData);
      return new Response(
        JSON.stringify({ error: "AI analysis failed" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const content = aiData.choices?.[0]?.message?.content;
    if (!content) {
      return new Response(
        JSON.stringify({ error: "No AI response" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let brandData;
    try {
      brandData = JSON.parse(content);
    } catch {
      console.error("Failed to parse AI response:", content);
      return new Response(
        JSON.stringify({ error: "Failed to parse brand analysis" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use logo from branding data if AI didn't extract one
    if (!brandData.logo_url) {
      brandData.logo_url = branding.images?.logo || branding.logo || null;
    }

    console.log("Brand analysis complete:", brandData.name);

    return new Response(JSON.stringify({ success: true, brand: brandData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Brand scraper error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
