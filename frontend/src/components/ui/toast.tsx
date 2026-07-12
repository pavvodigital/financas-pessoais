import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type Kind = "success" | "error";
interface Toast { id: number; kind: Kind; message: string }

const ToastCtx = createContext<(kind: Kind, message: string) => void>(() => {});

export function useToast() {
  return useContext(ToastCtx);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((kind: Kind, message: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, kind, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-5 right-5 z-50 space-y-2" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`bg-surface border border-hairline shadow-md rounded-lg px-4 py-2.5 text-sm text-ink border-l-4 ${
              t.kind === "success" ? "border-l-accent" : "border-l-danger"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
