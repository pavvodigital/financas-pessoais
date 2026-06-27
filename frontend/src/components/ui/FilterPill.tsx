import type { ReactNode } from "react";

interface Props {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}

export default function FilterPill({ active, onClick, children }: Props) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
        active
          ? "bg-accent text-white"
          : "border border-hairline text-muted hover:text-ink hover:border-muted"
      }`}
    >
      {children}
    </button>
  );
}
