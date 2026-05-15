import { useEffect, useRef, useState } from "react";

function easeOutCubic(t: number) {
  return 1 - (1 - t) ** 3;
}

/** Interpola número com animação curta (valores monetários, contagens). */
export function AnimatedNumber({
  value,
  formatter,
  duration = 520,
  className,
}: {
  value: number;
  formatter: (n: number) => string;
  duration?: number;
  className?: string;
}) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) return;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      fromRef.current = to;
      setDisplay(to);
      return;
    }
    let start: number | null = null;
    const step = (now: number) => {
      if (start == null) start = now;
      const raw = Math.min(1, (now - start) / duration);
      const t = easeOutCubic(raw);
      setDisplay(from + (to - from) * t);
      if (raw < 1) frameRef.current = requestAnimationFrame(step);
      else {
        fromRef.current = to;
        setDisplay(to);
      }
    };
    frameRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameRef.current);
  }, [value, duration]);

  return <span className={className}>{formatter(display)}</span>;
}
