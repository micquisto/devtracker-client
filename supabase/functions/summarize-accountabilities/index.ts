import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

type SummaryRequest = {
  snapshot?: unknown;
  prompt?: string;
  fallbackSummary?: string;
};

type OpenAiChatResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
  error?: {
    message?: string;
  };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  let payload: SummaryRequest;
  try {
    payload = (await request.json()) as SummaryRequest;
  } catch {
    return jsonResponse({ error: "Invalid JSON body." }, 400);
  }

  const fallbackSummary =
    typeof payload.fallbackSummary === "string" &&
    payload.fallbackSummary.trim()
      ? payload.fallbackSummary.trim()
      : null;

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    if (fallbackSummary) {
      return jsonResponse({
        summary: fallbackSummary,
        source: "local",
        warning:
          "OPENAI_API_KEY is not configured. Returned the local accountability summary.",
      });
    }

    return jsonResponse(
      {
        error:
          "OPENAI_API_KEY is not configured for summarize-accountabilities.",
      },
      500,
    );
  }

  const prompt =
    typeof payload.prompt === "string" && payload.prompt.trim()
      ? payload.prompt.trim()
      : null;

  if (!prompt) {
    return jsonResponse({ error: "Missing prompt." }, 400);
  }

  const model = Deno.env.get("OPENAI_MODEL") ?? "gpt-4.1-mini";

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content:
              "You write concise, factual engineering accountability summaries for leadership.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
      }),
    });

    const data = (await response.json()) as OpenAiChatResponse;
    if (!response.ok) {
      if (fallbackSummary) {
        return jsonResponse({
          summary: fallbackSummary,
          source: "local",
          warning:
            data.error?.message ??
            "OpenAI request failed. Returned the local accountability summary.",
        });
      }

      return jsonResponse(
        {
          error: data.error?.message ?? "OpenAI request failed.",
        },
        502,
      );
    }

    const summary = data.choices?.[0]?.message?.content?.trim();
    if (!summary) {
      if (fallbackSummary) {
        return jsonResponse({
          summary: fallbackSummary,
          source: "local",
          warning: "OpenAI returned an empty summary.",
        });
      }

      return jsonResponse({ error: "OpenAI returned an empty summary." }, 502);
    }

    return jsonResponse({
      summary,
      source: "ai",
    });
  } catch (error) {
    if (fallbackSummary) {
      return jsonResponse({
        summary: fallbackSummary,
        source: "local",
        warning:
          error instanceof Error
            ? error.message
            : "Unable to reach OpenAI. Returned the local accountability summary.",
      });
    }

    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to generate AI summary.",
      },
      500,
    );
  }
});
