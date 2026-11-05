import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type RequestBody = {
  name?: string;
  email?: string;
  password?: string;
};

function isValidEmail(email: string) {
  // Simple, safe validation (full RFC is unnecessary here)
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Creates a new auth user + default domain records (admin only).
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
    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    // Return 200 with success=false for validation errors so the web client can
    // show a friendly message without triggering FunctionsHttpError.
    if (!name || name.length > 80) {
      return json(200, { success: false, error: "Nome inválido" });
    }
    if (!email || email.length > 255 || !isValidEmail(email)) {
      return json(200, { success: false, error: "Email inválido" });
    }
    // Supabase recommends 6+, we enforce 8 for safety.
    if (!password || password.length < 8 || password.length > 72) {
      return json(200, {
        success: false,
        error: "Senha inválida (mínimo 8 caracteres)",
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name },
    });

    if (createErr || !created?.user?.id) {
      // Common case: email already exists.
      return json(200, {
        success: false,
        error: createErr?.message ?? "Falha ao criar usuário",
      });
    }

    const newUserId = created.user.id;

    // Create/ensure default domain records.
    // 1) vendedor row (avoid ON CONFLICT; vendedores.user_id may not be unique)
    const { data: updatedVendedores, error: updateErr } = await adminClient
      .from("vendedores")
      .update({ nome: name, email, ativo: true })
      .eq("user_id", newUserId)
      .select("id");

    if (updateErr) throw updateErr;

    if (!updatedVendedores || updatedVendedores.length === 0) {
      const { error: insertErr } = await adminClient.from("vendedores").insert({
        user_id: newUserId,
        nome: name,
        email,
        ativo: true,
      });
      if (insertErr) throw insertErr;
    }

    // 2) default role vendedor
    const { error: roleInsertErr } = await adminClient
      .from("user_roles")
      .upsert(
        { user_id: newUserId, role: "vendedor" },
        { onConflict: "user_id,role" },
      );

    if (roleInsertErr) throw roleInsertErr;

    return json(200, { success: true, userId: newUserId });
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
