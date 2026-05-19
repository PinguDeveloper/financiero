import { motion, type HTMLMotionProps } from "framer-motion";
import type { ReactNode } from "react";

export const fadeUp = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

export function MotionCard({
  children,
  className = "",
  delay = 0,
  ...rest
}: HTMLMotionProps<"article"> & { delay?: number }) {
  return (
    <motion.article
      {...fadeUp}
      transition={{ duration: 0.35, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{
        y: -3,
        boxShadow: "0 20px 40px -12px rgba(0,0,0,0.45)",
        borderColor: "rgba(148,163,184,0.35)",
      }}
      className={className}
      {...rest}
    >
      {children}
    </motion.article>
  );
}

export function MotionSection({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      {...fadeUp}
      transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export { motion };
