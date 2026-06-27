// Ícones SVG inline (estilo Lucide) — substituem emojis.
type P = { className?: string };
const base = "currentColor";

export const Search = ({ className = "w-4 h-4" }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke={base} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
  </svg>
);
export const ChevronLeft = ({ className = "w-4 h-4" }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke={base} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg>
);
export const ChevronRight = ({ className = "w-4 h-4" }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke={base} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
);
export const X = ({ className = "w-4 h-4" }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke={base} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
);
export const Sliders = ({ className = "w-4 h-4" }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke={base} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
    <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
    <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
    <line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" />
  </svg>
);
export const FileText = ({ className = "w-6 h-6" }: P) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke={base} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v5h5" /><path d="M9 13h6M9 17h6" />
  </svg>
);
