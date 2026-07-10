import { Text } from "@/lib/theme";

const SectionTitle = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  const classes = ["section-title", className].filter(Boolean).join(" ");

  return (
    <div
      className={classes}
      style={{
        fontSize: 10,
        fontFamily: "'DM Mono',monospace",
        fontWeight: 700,
        color: Text.section,
        textTransform: "uppercase" as const,
        letterSpacing: "0.15em",
        marginBottom: 16,
      }}
    >
      {children}
    </div>
  );
};
export default SectionTitle;
