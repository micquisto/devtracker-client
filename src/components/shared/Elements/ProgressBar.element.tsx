import { Background, Palette } from "@/lib/theme";

type ProgressBarProps = {
  value: number;
  max?: number;
  fillColor?: string;
  trackColor?: string;
  height?: number;
  transition?: string;
};

const ProgressBar = ({
  value,
  max = 100,
  fillColor = Palette.cyan,
  trackColor = Background.track,
  height = 4,
  transition = "width 1s ease",
}: ProgressBarProps) => {
  const percent = max > 0 ? Math.min(100, (value / max) * 100) : 0;

  return (
    <div
      style={{
        height,
        background: trackColor,
        borderRadius: 99,
        overflow: "hidden",
        marginTop: 2,
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${percent}%`,
          background: fillColor,
          borderRadius: 99,
          transition,
        }}
      />
    </div>
  );
};

export default ProgressBar;
