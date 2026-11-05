import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  includeInactive?: boolean;
}

// Lists vendedores for the Sales page (authenticated users). Uses service role to bypass RLS.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, error: "Method not allowed" }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Server not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: RequestBody = await req.json().catch(() => ({}));

    // Only admin/supervisor/gerente can include inactive vendedores.
    const [{ data: isAdmin }, { data: isSupervisor }, { data: isGerente }] = await Promise.all([
      userClient.rpc("has_role", { _user_id: user.id, _role: "admin" }),
      userClient.rpc("has_role", { _user_id: user.id, _role: "supervisor" }),
      userClient.rpc("has_role", { _user_id: user.id, _role: "gerente" }),
    ]);
    const canSeeInactive = Boolean(isAdmin || isSupervisor || isGerente);
    const includeInactive = canSeeInactive && Boolean(body.includeInactive);

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    let query = adminClient
      .from("vendedores")
      // Minimal fields needed for "Nova Venda"; avoids exposing unnecessary PII.
      .select("id, nome, ativo")
      .order("nome", { ascending: true });

    if (!includeInactive) {
      query = query.eq("ativo", true);
    }

    const { data, error } = await query;
    if (error) throw error;

    return new Response(JSON.stringify({ success: true, data: data ?? [] }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
