import type { ReactNode } from "react";

export default function SectionTitle({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <h2 className={`text-[11px] uppercase tracking-wider text-muted mb-3 ${className}`}>
      {children}
    </h2>
  );
}
