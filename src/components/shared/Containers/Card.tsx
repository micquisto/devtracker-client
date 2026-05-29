import { Background, Border } from "@/lib/theme";

const Card = ({
  children,
  className,
  style = {},
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) => {
  return (
    <div
      className={className}
      style={{
        background: Background.card,
        border: `1px solid ${Border.default}`,
        borderRadius: 16,
        padding: 22,
        transition: "border-color 0.3s",
        ...style,
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.borderColor = Border.hover)
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.borderColor = Border.default)
      }
    >
      {children}
    </div>
  );
};
export default Card;
