type PlanningPokerVoteProgressProps = {
  voted: number;
  total: number;
  compact?: boolean;
};

export default function PlanningPokerVoteProgress({
  voted,
  total,
  compact = false,
}: PlanningPokerVoteProgressProps) {
  const percent = total > 0 ? Math.round((voted / total) * 100) : 0;
  const isComplete = total > 0 && voted >= total;

  return (
    <div
      className={`planning-poker-vote-indicator${
        compact ? " planning-poker-vote-indicator--compact" : ""
      }${isComplete ? " planning-poker-vote-indicator--complete" : ""}`}
      aria-label={`${voted} of ${total} required votes submitted`}
    >
      <div className="planning-poker-vote-indicator__header">
        <span className="planning-poker-vote-indicator__label">Required votes</span>
        <span className="planning-poker-vote-indicator__count">
          {voted}/{total}
        </span>
      </div>
      <div className="planning-poker-vote-indicator__track">
        <div
          className="planning-poker-vote-indicator__fill"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
