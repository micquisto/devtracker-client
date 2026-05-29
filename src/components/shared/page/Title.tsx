import type { ReactNode } from "react";
import "@/assets/styles/Title.css";

type TitleProps = {
  title: ReactNode;
  eyebrow?: ReactNode;
  subtitle?: ReactNode;
  meta?: ReactNode;
  align?: "left" | "center";
  size?: "default" | "large" | "sprint";
  className?: string;
  rowClassName?: string;
};

export default function Title({
  title,
  eyebrow,
  subtitle,
  meta,
  align = "left",
  size = "default",
  className,
  rowClassName,
}: TitleProps) {
  const classes = ["page-title", align === "center" ? "page-title--center" : "", className]
    .filter(Boolean)
    .join(" ");
  const headingClasses = [
    "page-title__heading",
    size === "large" ? "page-title__heading--large" : "",
    size === "sprint" ? "page-title__heading--sprint" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const rowClasses = ["page-title__row", rowClassName].filter(Boolean).join(" ");

  return (
    <div className={classes}>
      {eyebrow && <div className="page-title__eyebrow">{eyebrow}</div>}
      <div className={rowClasses}>
        <h2 className={headingClasses}>{title}</h2>
        {meta}
      </div>
      {subtitle && <div className="page-title__subtitle">{subtitle}</div>}
    </div>
  );
}
