import { useState, useEffect } from "react";
import Card from "@/components/shared/Containers/Card";
import { Semantic, Text } from "@/lib/theme";
const ScoreKPI = ({
  label,
  value,
  sub,
  color,
  delta,
  deltaLabel,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  delta?: number;
  deltaLabel?: string;
}) => {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 200);
    return () => clearTimeout(t);
  }, []);
  const up = (delta ?? 0) >= 0;
  return (
    <Card
      style={{
        flex: 1,
        minWidth: 140,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: Text.muted,
          fontFamily: "'DM Sans',sans-serif",
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 800,
          fontFamily: "'DM Mono',monospace",
          color,
          transition: "all 0.6s ease",
          transform: show ? "scale(1)" : "scale(0.8)",
          opacity: show ? 1 : 0,
          letterSpacing: "-0.03em",
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      {sub && (
        <div
          style={{
            fontSize: 11,
            color: Text.subtle,
            fontFamily: "'DM Sans',sans-serif",
          }}
        >
          {sub}
        </div>
      )}
      {delta !== undefined && (
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              fontFamily: "'DM Mono',monospace",
              color: up ? Semantic.positive : Semantic.negativeSoft,
            }}
          >
            {up ? "\u25b2" : "\u25bc"} {Math.abs(delta)}%
          </span>
          <span
            style={{
              fontSize: 10,
              color: Text.dim,
              fontFamily: "'DM Sans',sans-serif",
            }}
          >
            {deltaLabel || "vs last month"}
          </span>
        </div>
      )}
    </Card>
  );
};

export default ScoreKPI;
