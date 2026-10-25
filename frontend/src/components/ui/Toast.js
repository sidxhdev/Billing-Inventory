import React from "react";
import { useStore } from "../../context/StoreContext";

export default function Toast() {
  const { toast, dismissToast } = useStore();
  if (!toast) return null;

  return (
    <div className="toast-stack" role="status" aria-live="polite">
      <div className={`toast toast-${toast.type}`}>
        <span className="toast-message">{toast.message}</span>
        <button
          type="button"
          className="toast-close"
          onClick={dismissToast}
          aria-label="Dismiss notification"
        >
          Close
        </button>
      </div>
    </div>
  );
}
