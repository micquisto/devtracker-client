type SupabaseLikeError = {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
};

export function getBackgroundProcessErrorMessage(
  error: unknown,
  fallback: string,
): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;

  if (error && typeof error === "object") {
    const supabaseError = error as SupabaseLikeError;
    const parts = [
      supabaseError.message,
      supabaseError.details,
      supabaseError.hint,
      supabaseError.code ? `Code: ${String(supabaseError.code)}` : undefined,
    ].filter((item): item is string => typeof item === "string" && item.length > 0);

    if (parts.length > 0) return parts.join(" ");
    return JSON.stringify(error);
  }

  return fallback;
}
