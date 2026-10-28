import { ChevronDown } from "lucide-react";
import { cx } from "@/lib/cx";

const box = "w-full rounded-xl border bg-white px-4 outline-none focus:ring-2 focus:ring-brand/30 disabled:bg-surface disabled:text-muted";
const border = (error) => (error ? "border-red-600" : "border-line");

// Label, the input, and a hint or error message under it
export function Field({ label, htmlFor, hint, error, children }) {
  return (
    <div className="mb-4">
      {label && <label htmlFor={htmlFor} className="mb-2 block text-sm font-semibold">{label}</label>}
      {children}
      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : hint && <p className="mt-2 text-sm text-muted">{hint}</p>}
    </div>
  );
}

export function Input({ error, className, ...props }) {
  return <input className={cx(box, "h-12", border(error), className)} {...props} />;
}

export function Textarea({ error, className, ...props }) {
  return <textarea className={cx(box, "min-h-24 py-3", border(error), className)} {...props} />;
}

export function Select({ error, className, children, ...props }) {
  return (
    <div className="relative">
      <select className={cx(box, "h-12 appearance-none pr-10", border(error), className)} {...props}>
        {children}
      </select>
      <ChevronDown size={18} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted" />
    </div>
  );
}