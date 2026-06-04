import { supabase } from "./client";
import type { Session } from "@supabase/supabase-js";

export type CreateSupabaseAuthUserResult = {
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

function isAlreadyRegisteredMessage(message: string): boolean {
  const normalized = message.toLowerCase();

  return (
    normalized.includes("already registered") ||
    normalized.includes("already exists") ||
    normalized.includes("user already")
  );
}

function getCreateUsersFunctionErrorMessage(message: string): string {
  if (message.toLowerCase().includes("failed to send a request")) {
    return [
      "Failed to reach the create-users Edge Function.",
      "Make sure the function is deployed with `supabase functions deploy create-users`,",
      "or served locally with `supabase functions serve create-users`.",
      "Also confirm VITE_SUPABASE_URL points to the Supabase project URL.",
    ].join(" ");
  }

  return message;
}

export async function createSupabaseAuthUsers(
  emails: string[],
  password: string,
): Promise<CreateSupabaseAuthUserResult[]> {
  const { data, error } = await supabase.functions.invoke<CreateSupabaseAuthUserResult[]>(
    "create-users",
    {
      body: {
        emails,
        password,
        trello: {
          organizationId: import.meta.env.VITE_TRELLO_ORGANIZATION_ID,
          apiKey: import.meta.env.VITE_TRELLO_API_KEY,
          token: import.meta.env.VITE_TRELLO_TOKEN,
        },
      },
    },
  );

  if (error) {
    if (isAlreadyRegisteredMessage(error.message)) {
      return emails.map((email) => ({
        email,
        status: "skipped",
        message: error.message,
      }));
    }

    throw new Error(getCreateUsersFunctionErrorMessage(error.message));
  }

  return data ?? [];
}

export async function signInWithEmailPassword(
  email: string,
  password: string,
): Promise<Session> {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw error;
  }

  if (!data.session) {
    throw new Error("No session returned after login.");
  }

  return data.session;
}

export async function signOutSupabaseUser(): Promise<void> {
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}

export async function getSupabaseSession(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  return data.session;
}
