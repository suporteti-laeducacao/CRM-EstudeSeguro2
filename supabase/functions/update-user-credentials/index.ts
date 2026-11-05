import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type RequestBody = {
  userId?: string;
  name?: string;
  email?: string;
  password?: string;
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    .test(v);
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Admin-only: update user email/password in auth and keep vendedores.email in sync.
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
    const userId = String(body.userId ?? "").trim();
    const name = body.name == null ? undefined : String(body.name).trim();
    const email = body.email == null ? undefined : String(body.email).trim().toLowerCase();
    const password = body.password == null ? undefined : String(body.password);

    if (!userId || !isUuid(userId)) {
      return json(200, { success: false, error: "ID de usuário inválido" });
    }

    if (!name && !email && !password) {
      return json(200, { success: false, error: "Informe nome, email e/ou senha" });
    }

    if (name) {
      if (name.length < 1 || name.length > 80) {
        return json(200, { success: false, error: "Nome inválido" });
      }
    }

    if (email) {
      if (email.length > 255 || !isValidEmail(email)) {
        return json(200, { success: false, error: "Email inválido" });
      }
    }

    if (password) {
      if (password.length < 8 || password.length > 72) {
        return json(200, {
          success: false,
          error: "Senha inválida (mínimo 8 caracteres)",
        });
      }
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const updatePayload: Record<string, unknown> = {};
    if (email) {
      updatePayload.email = email;
      // Avoid blocking access due to email confirmation when admin changes it.
      updatePayload.email_confirm = true;
    }
    if (password) updatePayload.password = password;

    let updatedAuthId = userId;
    if (Object.keys(updatePayload).length > 0) {
      const { data: updated, error: updateErr } = await adminClient.auth.admin.updateUserById(
        userId,
        updatePayload,
      );
      if (updateErr) {
        return json(200, { success: false, error: updateErr.message });
      }
      updatedAuthId = updated.user?.id ?? userId;
    }

    // Sync vendedores fields if needed.
    if (email || name) {
      const vendedorPayload: Record<string, unknown> = {};
      if (email) vendedorPayload.email = email;
      if (name) vendedorPayload.nome = name;

      const { data: updatedRows, error: vErr } = await adminClient
        .from("vendedores")
        .update(vendedorPayload)
        .eq("user_id", userId)
        .select("id");

      if (vErr) throw vErr;

      // If there's no vendedor row yet, create one.
      if (!updatedRows || updatedRows.length === 0) {
        const { error: insertErr } = await adminClient.from("vendedores").insert({
          user_id: userId,
          nome: name ?? (email ? email.split("@")[0] : "Usuário"),
          email: email ?? null,
          ativo: true,
        });
        if (insertErr) throw insertErr;
      }
    }

    return json(200, { success: true, userId: updatedAuthId });
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
