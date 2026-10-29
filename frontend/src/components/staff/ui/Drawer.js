"use client";
import { useEffect } from "react";
import { X } from "lucide-react";

// Side panel for forms: <Drawer open={open} onClose={close} title="Add user" footer={<Buttons />}>...</Drawer>
export function Drawer({ open, onClose, title, footer, children }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/30" onClick={onClose}>
      <aside role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()} className="flex h-full w-full max-w-[440px] flex-col bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-line px-6 py-5">
          <h2 className="text-2xl font-extrabold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="grid size-10 place-items-center rounded-xl border border-line hover:bg-surface">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex gap-3 border-t border-line px-6 py-4">{footer}</div>}
      </aside>
    </div>
  );
}