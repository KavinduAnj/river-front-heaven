import { cx } from "@/lib/cx";

const variants = {
  primary: "bg-accent text-ink font-bold hover:bg-accent-dark", // main action (amber)
  outline: "border border-line bg-white font-semibold hover:bg-surface", // Cancel, Details
  link: "font-semibold text-brand hover:underline", // Edit, Reset password
  danger: "bg-red-600 font-bold text-white hover:bg-red-700", // Deactivate, Cancel booking
};

export function Button({ variant = "primary", className, type = "button", ...props }) {
  const size = variant === "link" ? "px-2 py-1" : "h-12 px-5";
  return (
    <button
      type={type}
      className={cx("inline-flex items-center justify-center gap-2 rounded-xl disabled:cursor-not-allowed disabled:opacity-50", size, variants[variant], className)}
      {...props}
    />
  );
}