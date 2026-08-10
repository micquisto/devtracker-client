import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  buildAccountabilitiesSummaryPrompt,
  buildLocalAccountabilitiesSummary,
  type AccountabilitiesSummaryResult,
  type AccountabilitiesSummarySnapshot,
} from "@/lib/utils/scrum/accountabilitiesSummary.utils";

type AccountabilitiesAiSummaryProps = {
  snapshot: AccountabilitiesSummarySnapshot | null;
  disabled?: boolean;
};

function getSnapshotKey(snapshot: AccountabilitiesSummarySnapshot): string {
  return JSON.stringify({
    periodLabel: snapshot.periodLabel,
    overallScore: snapshot.overallScore,
    teamGrade: snapshot.teamGrade,
    outputTotals: snapshot.outputTotals,
    skillRadar: snapshot.skillRadar,
    metrics: snapshot.metrics.map((metric) => ({
      key: metric.key,
      current: metric.current,
      previous: metric.previous,
      changeDirection: metric.changeDirection,
      changeDelta: metric.changeDelta,
      comments: metric.comments,
    })),
    projects: snapshot.projects,
    challenges: snapshot.challenges,
    plans: snapshot.plans,
    teamGoals: snapshot.teamGoals,
    notableHighlights: snapshot.notableHighlights,
    ranking: snapshot.ranking,
  });
}

export function AccountabilitiesAiSummary({
  snapshot,
  disabled = false,
}: AccountabilitiesAiSummaryProps) {
  const [summary, setSummary] = useState<string | null>(null);
  const [source, setSource] = useState<AccountabilitiesSummaryResult["source"] | null>(
    null,
  );
  const [warning, setWarning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const requestIdRef = useRef(0);

  const snapshotKey = useMemo(
    () => (snapshot ? getSnapshotKey(snapshot) : null),
    [snapshot],
  );

  async function generateSummary(
    nextSnapshot: AccountabilitiesSummarySnapshot,
    options?: { manual?: boolean },
  ) {
    const requestId = ++requestIdRef.current;
    setIsGenerating(true);
    setError(null);
    setWarning(null);

    const localSummary = buildLocalAccountabilitiesSummary(nextSnapshot);
    const prompt = buildAccountabilitiesSummaryPrompt(nextSnapshot);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke<{
        summary?: string;
        source?: "ai" | "local";
        warning?: string;
        error?: string;
      }>("summarize-accountabilities", {
        body: {
          snapshot: nextSnapshot,
          prompt,
          fallbackSummary: localSummary,
        },
      });

      if (requestId !== requestIdRef.current) {
        return;
      }

      if (invokeError) {
        setSummary(localSummary);
        setSource("local");
        setWarning(
          "AI service unavailable. Showing an on-device accountability summary instead.",
        );
        return;
      }

      if (data?.error && !data.summary) {
        throw new Error(data.error);
      }

      const nextSummary = data?.summary?.trim() || localSummary;
      setSummary(nextSummary);
      setSource(data?.source ?? (data?.summary ? "ai" : "local"));
      setWarning(data?.warning ?? null);
    } catch (generateError) {
      if (requestId !== requestIdRef.current) {
        return;
      }

      setSummary(localSummary);
      setSource("local");
      if (options?.manual) {
        setError(
          generateError instanceof Error
            ? generateError.message
            : "Unable to generate AI summary.",
        );
      }
      setWarning(
        "Fell back to a local accountability summary built from the page data.",
      );
    } finally {
      if (requestId === requestIdRef.current) {
        setIsGenerating(false);
      }
    }
  }

  useEffect(() => {
    if (disabled || !snapshot || !snapshotKey) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void generateSummary(snapshot);
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
      requestIdRef.current += 1;
    };
  }, [disabled, snapshot, snapshotKey]);

  return (
    <section
      className="accountabilities-section"
      aria-labelledby="accountabilities-ai-summary-title"
    >
      <div className="accountabilities-section__header">
        <h3
          id="accountabilities-ai-summary-title"
          className="accountabilities-section__title"
        >
          AI Accountability Summary:
        </h3>
        <button
          type="button"
          className="accountabilities-metric-details__button accountabilities-metric-details__button--primary"
          disabled={disabled || !snapshot || isGenerating}
          onClick={() => {
            if (!snapshot) {
              return;
            }
            void generateSummary(snapshot, { manual: true });
          }}
        >
          {isGenerating ? "Generating…" : "Refresh summary"}
        </button>
      </div>

      <div className="scard accountabilities-ai-summary">
        {disabled || !snapshot ? (
          <div className="accountabilities-section__status">
            Select a year and month to generate an AI summary of this accountability report.
          </div>
        ) : null}

        {error ? (
          <div className="accountabilities-section__status accountabilities-section__status--error">
            {error}
          </div>
        ) : null}

        {warning ? (
          <div className="accountabilities-ai-summary__warning">{warning}</div>
        ) : null}

        {summary ? (
          <div className="accountabilities-ai-summary__body">
            {source ? (
              <div className="accountabilities-ai-summary__source">
                {source === "ai" ? "Generated by AI agent" : "Local data summary"}
              </div>
            ) : null}
            <div className="accountabilities-ai-summary__text">{summary}</div>
          </div>
        ) : !disabled && snapshot ? (
          <div className="accountabilities-section__status">
            {isGenerating
              ? "Generating AI summary…"
              : "Preparing accountability summary…"}
          </div>
        ) : null}
      </div>
    </section>
  );
}
