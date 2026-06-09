import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type CreateUserRequest = {
  emails: string[];
  password: string;
  trello?: {
    organizationId?: string;
    apiKey?: string;
    token?: string;
  };
};

type CreateUserResult = {
  email: string;
  status: "created" | "skipped" | "failed";
  userId?: string;
  message: string;
  member?: {
    status: "created" | "skipped" | "failed";
    message: string;
    trelloUsername?: string;
  };
};

type TrelloOrganizationMember = {
  id: string;
  username: string;
  fullName?: string;
  initials?: string;
  avatarUrl?: string;
};

type MemberProfile = {
  full_name: string;
  first_name: string;
  last_name: string;
  email: string;
};

type MemberRow = {
  auth_user_id: string;
  trello_member_id: string;
  trello_username: string;
  full_name: string;
  email: string;
  first_name: string;
  last_name: string;
};

const MEMBER_PROFILES_BY_EMAIL: Record<string, MemberProfile> = {
  "michaelq@plumbersstock.com": {
    full_name: "Jan Michael Quisto",
    first_name: "Jan Michael",
    last_name: "Quisto",
    email: "michaelq@plumbersstock.com",
  },
  "doerr@plumbersstock.com": {
    full_name: "Doer Rosales",
    first_name: "Doer",
    last_name: "Rosales",
    email: "doerr@plumbersstock.com",
  },
  "joshuab@plumbersstock.com": {
    full_name: "Joshua Balansa",
    first_name: "Joshua",
    last_name: "Balansa",
    email: "joshuab@plumbersstock.com",
  },
  "joshuap@plumbersstock.com": {
    full_name: "Joshua Panganiban",
    first_name: "Joshua",
    last_name: "Panganiban",
    email: "joshuap@plumbersstock.com",
  },
  "louiegualingco01@gmail.com": {
    full_name: "Louie Gualingco",
    first_name: "Louie",
    last_name: "Gualingco",
    email: "louiegualingco01@gmail.com",
  },
  "thomasz@plumbersstock.com": {
    full_name: "Thomas Zaragoza",
    first_name: "Thomas",
    last_name: "Zaragoza",
    email: "thomasz@plumbersstock.com",
  },
};

const EMAIL_BY_TRELLO_USERNAME: Record<string, string> = {
  doerrosales1: "doerr@plumbersstock.com",
  janmichaelquisto1: "michaelq@plumbersstock.com",
  joshuabalansa: "joshuab@plumbersstock.com",
  jpangs: "joshuap@plumbersstock.com",
  louiefranzgualingco: "louiegualingco01@gmail.com",
  thomasandrewzaragoza1: "thomasz@plumbersstock.com",
};

const TRELLO_USERNAME_BY_EMAIL = Object.fromEntries(
  Object.entries(EMAIL_BY_TRELLO_USERNAME).map(([username, email]) => [email, username]),
);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function isAlreadyRegisteredMessage(message: string): boolean {
  const normalized = message.toLowerCase();

  return (
    normalized.includes("already registered") ||
    normalized.includes("already exists") ||
    normalized.includes("user already")
  );
}

function hasMemberChanged(
  existingMember: Partial<MemberRow>,
  nextMember: MemberRow,
): boolean {
  return (
    existingMember.auth_user_id !== nextMember.auth_user_id ||
    existingMember.trello_member_id !== nextMember.trello_member_id ||
    existingMember.trello_username !== nextMember.trello_username ||
    existingMember.full_name !== nextMember.full_name ||
    existingMember.email !== nextMember.email ||
    existingMember.first_name !== nextMember.first_name ||
    existingMember.last_name !== nextMember.last_name
  );
}

async function getTrelloOrganizationMembers({
  organizationId,
  apiKey,
  token,
}: {
  organizationId: string;
  apiKey: string;
  token: string;
}): Promise<TrelloOrganizationMember[]> {
  const url = new URL(
    `https://api.trello.com/1/organizations/${organizationId}/members`,
  );
  url.searchParams.set("key", apiKey);
  url.searchParams.set("token", token);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Trello organization members request failed (${response.status}): ${await response.text()}`,
    );
  }

  return (await response.json()) as TrelloOrganizationMember[];
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return Response.json(
      { error: "Method not allowed." },
      { status: 405, headers: corsHeaders },
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json(
      { error: "Missing Supabase admin environment variables." },
      { status: 500, headers: corsHeaders },
    );
  }

  const { emails, password, trello } = (await request.json()) as CreateUserRequest;

  if (!Array.isArray(emails) || emails.length === 0 || !password) {
    return Response.json(
      { error: "emails and password are required." },
      { status: 400, headers: corsHeaders },
    );
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  const token = request.headers.get("Authorization")?.replace("Bearer ", "");

  if (!token) {
    return Response.json(
      { error: "Unauthorized." },
      { status: 401, headers: corsHeaders },
    );
  }

  const { data: authUser, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !authUser.user) {
    return Response.json(
      { error: "Unauthorized." },
      { status: 401, headers: corsHeaders },
    );
  }

  const results: CreateUserResult[] = [];

  for (const email of emails) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (error) {
      results.push({
        email,
        status: isAlreadyRegisteredMessage(error.message) ? "skipped" : "failed",
        message: error.message,
      });
      continue;
    }

    results.push({
      email,
      status: "created",
      userId: data.user.id,
      message: "User created without email confirmation.",
    });
  }

  const trelloOrganizationId =
    trello?.organizationId ?? Deno.env.get("TRELLO_ORGANIZATION_ID");
  const trelloApiKey = trello?.apiKey ?? Deno.env.get("TRELLO_API_KEY");
  const trelloToken = trello?.token ?? Deno.env.get("TRELLO_TOKEN");

  if (!trelloOrganizationId || !trelloApiKey || !trelloToken) {
    return Response.json(
      results.map((result) => ({
        ...result,
        member: {
          status: "skipped",
          message: "Missing Trello organization/API credentials.",
        },
      })),
      { headers: corsHeaders },
    );
  }

  const [trelloMembers, authUsers] = await Promise.all([
    getTrelloOrganizationMembers({
      organizationId: trelloOrganizationId,
      apiKey: trelloApiKey,
      token: trelloToken,
    }),
    supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);

  if (authUsers.error) {
    return Response.json(
      results.map((result) => ({
        ...result,
        member: {
          status: "failed",
          message: authUsers.error.message,
        },
      })),
      { headers: corsHeaders },
    );
  }

  const authUserByEmail = new Map(
    authUsers.data.users.map((user) => [user.email?.toLowerCase(), user]),
  );
  const targetEmails = emails.map((email) => email.toLowerCase());
  const { data: existingMembers, error: existingMembersError } = await supabaseAdmin
    .from("members")
    .select(
      "auth_user_id,trello_member_id,trello_username,full_name,email,first_name,last_name",
    )
    .in("email", targetEmails);

  if (existingMembersError) {
    return Response.json(
      results.map((result) => ({
        ...result,
        member: {
          status: "failed",
          message: existingMembersError.message,
        },
      })),
      { headers: corsHeaders },
    );
  }

  const existingMemberByEmail = new Map(
    ((existingMembers ?? []) as Partial<MemberRow>[]).map((member) => [
      String(member.email).toLowerCase(),
      member,
    ]),
  );
  const memberRows = trelloMembers.flatMap<MemberRow>((trelloMember) => {
    const email = EMAIL_BY_TRELLO_USERNAME[trelloMember.username]?.toLowerCase();
    const profile = email ? MEMBER_PROFILES_BY_EMAIL[email] : undefined;
    const authUser = email ? authUserByEmail.get(email) : undefined;
    const trelloUsername = email ? TRELLO_USERNAME_BY_EMAIL[email] : undefined;

    if (!email || !trelloUsername || !profile || !authUser) return [];

    const nextMember = {
      auth_user_id: authUser.id,
      trello_member_id: trelloMember.id,
      trello_username: trelloUsername,
      full_name: profile.full_name,
      email: profile.email,
      first_name: profile.first_name,
      last_name: profile.last_name,
    };
    const existingMember = existingMemberByEmail.get(email);

    return !existingMember || hasMemberChanged(existingMember, nextMember)
      ? [nextMember]
      : [];
  });

  const { error: upsertError } = memberRows.length
    ? await supabaseAdmin.from("members").upsert(memberRows, { onConflict: "email" })
    : { error: null };

  return Response.json(
    results.map((result) => {
      const trelloMember = trelloMembers.find(
        (member) =>
          EMAIL_BY_TRELLO_USERNAME[member.username]?.toLowerCase() ===
          result.email.toLowerCase(),
      );
      const existingMember = existingMemberByEmail.get(result.email.toLowerCase());
      const changedMember = memberRows.find(
        (member) => member.email.toLowerCase() === result.email.toLowerCase(),
      );

      return {
        ...result,
        member: {
          status: upsertError
            ? "failed"
            : changedMember
              ? "created"
              : "skipped",
          message: upsertError
            ? upsertError.message
            : changedMember
              ? existingMember
                ? "Member profile updated from Supabase user and Trello data."
                : "Member profile created from Supabase user and Trello data."
              : existingMember
                ? "Member record already up to date."
                : trelloMember
                  ? "Supabase auth user is not available for this email."
                  : "No matching Trello organization member found.",
          trelloUsername: trelloMember?.username ?? TRELLO_USERNAME_BY_EMAIL[result.email],
        },
      };
    }),
    { headers: corsHeaders },
  );
});
