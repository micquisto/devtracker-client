import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type ConfirmEmailRequest = {
  memberId?: string;
};

type MemberRow = {
  id: string;
  auth_user_id: string | null;
  email: string | null;
  role?: string | null;
};

type AccessControlRow = {
  page_id: string;
  can_access: boolean;
};

const CHANGE_PASSWORDS_PAGE_ID = "admin-user-change-passwords";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: corsHeaders,
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "Missing Supabase admin environment variables." }, 500);
  }

  const token = request.headers.get("Authorization")?.replace("Bearer ", "");

  if (!token) {
    return jsonResponse({ error: "Unauthorized." }, 401);
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  const { data: authUser, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !authUser.user) {
    return jsonResponse({ error: "Unauthorized." }, 401);
  }

  const { memberId } = (await request.json()) as ConfirmEmailRequest;

  if (!memberId) {
    return jsonResponse({ error: "memberId is required." }, 400);
  }

  const [requesterByAuthId, requesterByEmail] = await Promise.all([
    supabaseAdmin
      .from("members")
      .select("id,auth_user_id,email,role")
      .eq("auth_user_id", authUser.user.id)
      .maybeSingle(),
    authUser.user.email
      ? supabaseAdmin
        .from("members")
        .select("id,auth_user_id,email,role")
        .eq("email", authUser.user.email)
        .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (requesterByAuthId.error || requesterByEmail.error) {
    return jsonResponse(
      { error: requesterByAuthId.error?.message ?? requesterByEmail.error?.message },
      500,
    );
  }

  const requester = (requesterByAuthId.data ?? requesterByEmail.data) as MemberRow | null;
  const requesterRole = requester?.role?.trim().toLowerCase();

  if (!requesterRole) {
    return jsonResponse({ error: "Unable to verify admin access for this user." }, 403);
  }

  const { data: aclRows, error: aclError } = await supabaseAdmin
    .from("access_control_lists")
    .select("page_id,can_access")
    .eq("role", requesterRole);

  if (aclError) {
    return jsonResponse({ error: aclError.message }, 500);
  }

  const hasAclRows = Boolean(aclRows?.length);
  const canAccessChangePasswords = (aclRows as AccessControlRow[] | null)?.some(
    (row) => row.page_id === CHANGE_PASSWORDS_PAGE_ID && row.can_access,
  );

  if (hasAclRows && !canAccessChangePasswords) {
    return jsonResponse({ error: "You do not have access to confirm user emails." }, 403);
  }

  const { data: member, error: memberError } = await supabaseAdmin
    .from("members")
    .select("id,auth_user_id,email")
    .eq("id", memberId)
    .maybeSingle();

  if (memberError) {
    return jsonResponse({ error: memberError.message }, 500);
  }

  const targetMember = member as MemberRow | null;

  if (!targetMember?.auth_user_id) {
    return jsonResponse(
      { error: "Selected member does not have a linked Supabase auth user." },
      400,
    );
  }

  const { data: updatedUser, error: updateError } =
    await supabaseAdmin.auth.admin.updateUserById(targetMember.auth_user_id, {
      email_confirm: true,
    });

  if (updateError) {
    return jsonResponse({ error: updateError.message }, 400);
  }

  return jsonResponse({
    memberId: targetMember.id,
    authUserId: updatedUser.user.id,
    email: updatedUser.user.email ?? targetMember.email ?? "",
    message: "Email confirmed successfully.",
  });
});
