import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type RequestBody = {
  email?: string;
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function findUserByEmail(adminClient: any, email: string) {
  // No direct lookup by email in admin API; iterate through pages.
  const perPage = 200;
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users ?? [];
    const found = users.find((u: any) => (u.email ?? "").toLowerCase() === email);
    if (found) return found;
    if (users.length < perPage) break;
  }
  return null;
}

// Ensures an existing auth user appears in the app by creating missing
// vendedores + user_roles records (admin only).
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { success: false, error: "Method not allowed" });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return json(500, { success: false, error: "Server not configured" });
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
      return json(401, { success: false, error: "Unauthorized" });
    }

    const { data: isAdmin, error: roleErr } = await userClient.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (roleErr) throw roleErr;
    if (!isAdmin) return json(403, { success: false, error: "Forbidden" });

    const body: RequestBody = await req.json().catch(() => ({}));
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!email || email.length > 255 || !isValidEmail(email)) {
      return json(200, { success: false, error: "Email inválido" });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const found = await findUserByEmail(adminClient, email);
    if (!found?.id) {
      return json(200, { success: false, error: "Conta não encontrada na autenticação" });
    }

    const name =
      String((found.user_metadata as any)?.full_name ?? "").trim() ||
      String((found.user_metadata as any)?.name ?? "").trim() ||
      email;

    // Ensure vendedor (WITHOUT relying on ON CONFLICT; table may have duplicate user_id)
    const { data: updatedVendedores, error: updateErr } = await adminClient
      .from("vendedores")
      .update({ nome: name, email, ativo: true })
      .eq("user_id", found.id)
      .select("id");

    if (updateErr) throw updateErr;

    if (!updatedVendedores || updatedVendedores.length === 0) {
      const { error: insertErr } = await adminClient.from("vendedores").insert({
        user_id: found.id,
        nome: name,
        email,
        ativo: true,
      });
      if (insertErr) throw insertErr;
    }

    // Ensure role vendedor exists (you can change later in UI)
    const { error: roleInsertErr } = await adminClient
      .from("user_roles")
      .upsert({ user_id: found.id, role: "vendedor" }, { onConflict: "user_id,role" });
    if (roleInsertErr) throw roleInsertErr;

    return json(200, { success: true, userId: found.id });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : JSON.stringify(error);
    return json(500, { success: false, error: message });
  }
});
