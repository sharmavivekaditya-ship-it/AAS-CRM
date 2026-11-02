// Supabase Edge Function: manage-users
// Lets the AAS CRM admin create logins, reset passwords, change roles and
// switch accounts on/off. Runs on Supabase's servers, so the secret
// service key never reaches the browser.
//
// Deploy: Supabase dashboard > Edge Functions > Deploy a new function >
// Via Editor > name it exactly "manage-users" > paste this file > Deploy.

import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

    // Who is calling?
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data: caller, error: callerErr } = await admin.auth.getUser(token);
    if (callerErr || !caller?.user) return json({ error: "Please sign in again." }, 401);

    const { data: me } = await admin
      .from("profiles").select("role, active").eq("id", caller.user.id).single();
    if (!me || me.role !== "admin" || !me.active) {
      return json({ error: "Only an admin can manage team logins." }, 403);
    }

    const body = await req.json();

    if (body.action === "create") {
      const email = String(body.email || "").trim().toLowerCase();
      const password = String(body.password || "");
      const full_name = String(body.full_name || "").trim();
      const role = body.role === "admin" ? "admin" : "user";
      if (!email || password.length < 8) {
        return json({ error: "Enter an email and a password of at least 8 characters." }, 400);
      }
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name },
        app_metadata: { role },
      });
      if (error) return json({ error: error.message }, 400);
      // The database trigger creates the profile; make sure name and role are right.
      await admin.from("profiles").upsert({ id: data.user.id, email, full_name, role, active: true });
      // Calls imported from the old Google Sheet carry only a name.
      // Link them to this login when the name matches (e.g. "Shweta").
      if (full_name) {
        const first = full_name.split(/\s+/)[0];
        await admin.from("activities").update({ by_id: data.user.id })
          .is("by_id", null).ilike("by_name", first);
      }
      return json({ ok: true, id: data.user.id });
    }

    if (body.action === "update") {
      const id = String(body.id || "");
      if (!id) return json({ error: "Missing user." }, 400);
      const isSelf = id === caller.user.id;
      if (isSelf && (body.role === "user" || body.active === false)) {
        return json({ error: "You can't remove your own admin access." }, 400);
      }

      const authPatch: Record<string, unknown> = {};
      if (body.password) {
        if (String(body.password).length < 8) {
          return json({ error: "Password must be at least 8 characters." }, 400);
        }
        authPatch.password = String(body.password);
      }
      if (body.active === false) authPatch.ban_duration = "876000h";
      if (body.active === true) authPatch.ban_duration = "none";
      if (body.role) authPatch.app_metadata = { role: body.role === "admin" ? "admin" : "user" };
      if (Object.keys(authPatch).length) {
        const { error } = await admin.auth.admin.updateUserById(id, authPatch);
        if (error) return json({ error: error.message }, 400);
      }

      const profilePatch: Record<string, unknown> = {};
      if (typeof body.full_name === "string") profilePatch.full_name = body.full_name.trim();
      if (body.role) profilePatch.role = body.role === "admin" ? "admin" : "user";
      if (typeof body.active === "boolean") profilePatch.active = body.active;
      if (Object.keys(profilePatch).length) {
        const { error } = await admin.from("profiles").update(profilePatch).eq("id", id);
        if (error) return json({ error: error.message }, 400);
      }
      return json({ ok: true });
    }

    return json({ error: "Unknown action." }, 400);
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
