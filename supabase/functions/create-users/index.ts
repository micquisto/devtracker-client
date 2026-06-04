import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type CreateUserRequest = {
  emails: string[];
  password: string;
};

type CreateUserResult = {
  email: string;
  status: "created" | "skipped" | "failed";
  userId?: string;
  message: string;
};

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

  const { emails, password } = (await request.json()) as CreateUserRequest;

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

  return Response.json(results, { headers: corsHeaders });
});
