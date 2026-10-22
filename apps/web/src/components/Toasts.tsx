import { useUiStore } from "../store/uiStore";

export function Toasts() {
  const toasts = useUiStore((s) => s.toasts);
  const dismiss = useUiStore((s) => s.dismissToast);

  if (toasts.length === 0) return null;

  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast ${toast.tone}`}
          onClick={() => dismiss(toast.id)}
          role="button"
          tabIndex={0}
        >
          <span>{toast.tone === "error" ? "⛔" : toast.tone === "success" ? "✅" : "ℹ️"}</span>
          <span>{toast.message}</span>
        </div>
      ))}
    </div>
  );
}
