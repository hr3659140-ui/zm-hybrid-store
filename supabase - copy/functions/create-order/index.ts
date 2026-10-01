import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ error: "Server configuration error" }, 500);

  try {
    const payload = await req.json();
    if (!payload || typeof payload !== "object") return json({ error: "Invalid request" }, 400);

    // Use the service role only inside the Edge Function, never in browser code.
    // The SQL function derives customer_id from auth.uid() when a user JWT is supplied.
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: {
        headers: {
          Authorization: req.headers.get("Authorization") || "",
        },
      },
    });

    const { data, error } = await admin.rpc("create_order_secure", { p_payload: payload });
    if (error) {
      console.error("create_order_secure:", error);
      return json({ error: error.message || "Could not create order" }, 400);
    }
    return json({ ok: true, order: data });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : "Invalid request" }, 400);
  }
});
