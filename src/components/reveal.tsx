import type { CSSProperties, ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** Delay before this element starts revealing, in ms. */
  delay?: number;
  /** Use plain fade-in instead of fade-rise. */
  fade?: boolean;
  className?: string;
  /** Inline style override (merged). */
  style?: CSSProperties;
  as?: keyof React.JSX.IntrinsicElements;
};

/**
 * Wrap content in a subtle entrance animation. Renders as a span by default,
 * pass `as="div"` for block elements. Respects prefers-reduced-motion.
 */
export function Reveal({
  children,
  delay = 0,
  fade = false,
  className = "",
  style,
  as = "div",
}: Props) {
  const Tag = as as keyof React.JSX.IntrinsicElements;
  const cls = `${fade ? "animate-fade-in" : "animate-fade-rise"} ${className}`.trim();
  const mergedStyle: CSSProperties = {
    ...style,
    ["--reveal-delay" as string]: `${delay}ms`,
  };
  return (
    <Tag className={cls} style={mergedStyle}>
      {children}
    </Tag>
  );
}
