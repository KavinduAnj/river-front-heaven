import { cx } from "@/lib/cx";

const tones = {
  amber: "bg-amber-100 text-amber-800",
  green: "bg-emerald-100 text-emerald-800",
  blue: "bg-sky-100 text-sky-800",
  teal: "bg-teal-100 text-teal-800",
  grey: "bg-slate-100 text-slate-600",
  red: "bg-red-100 text-red-800",
};

// Which colour each status gets (the values are the database enums)
const STATUS_TONE = {
  PENDING: "amber", PLACED: "amber",
  CONFIRMED: "green", BOOKED: "green", ACTIVE: "green",
  CHECKED_IN: "blue", PREPARING: "blue",
  READY: "teal",
  CHECKED_OUT: "grey", COMPLETED: "grey", DELIVERED: "grey", DEACTIVATED: "grey",
  CANCELLED: "red", NO_SHOW: "red",
};

// <Badge status="CHECKED_IN" /> shows "Checked-in". Use tone="..." for anything else.
export function Badge({ status, tone, children, className }) {
  const text = children ?? status.charAt(0) + status.slice(1).toLowerCase().replace("_", "-");
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium", tones[tone ?? STATUS_TONE[status] ?? "grey"], className)}>
      <span className="size-1.5 rounded-full bg-current" />
      {text}
    </span>
  );
}