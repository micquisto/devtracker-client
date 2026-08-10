import { PageAiSummary } from "@/components/shared/PageAiSummary";
import {
  buildAccountabilitiesSummaryPrompt,
  buildLocalAccountabilitiesSummary,
  type AccountabilitiesSummarySnapshot,
} from "@/lib/utils/scrum/accountabilitiesSummary.utils";

type AccountabilitiesAiSummaryProps = {
  snapshot: AccountabilitiesSummarySnapshot | null;
  disabled?: boolean;
};

function getSnapshotKey(snapshot: AccountabilitiesSummarySnapshot): string {
  return JSON.stringify(snapshot);
}

export function AccountabilitiesAiSummary({
  snapshot,
  disabled = false,
}: AccountabilitiesAiSummaryProps) {
  return (
    <PageAiSummary
      title="AI Accountability Summary:"
      snapshot={snapshot}
      disabled={disabled}
      emptyMessage="Select a year and month to generate an AI summary of this accountability report."
      loadingMessage="Preparing accountability summary…"
      buildLocalSummary={buildLocalAccountabilitiesSummary}
      buildPrompt={buildAccountabilitiesSummaryPrompt}
      getSnapshotKey={getSnapshotKey}
    />
  );
}
