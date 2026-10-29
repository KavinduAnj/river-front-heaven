import { CircleAlert, CircleCheck, Info } from "lucide-react";
import { cx } from "@/lib/cx";

const tones = {
  error: { style: "bg-red-100 text-red-800", Icon: CircleAlert },
  success: { style: "bg-emerald-100 text-emerald-800", Icon: CircleCheck },
  info: { style: "bg-surface text-muted", Icon: Info },
};

// <Alert tone="error">Message</Alert>
export function Alert({ tone = "info", className, children }) {
  const { style, Icon } = tones[tone];
  return (
    <div role={tone === "error" ? "alert" : undefined} className={cx("flex items-start gap-2 rounded-xl p-4 text-sm", style, className)}>
      <Icon size={18} className="mt-0.5 shrink-0" />
      <div>{children}</div>
    </div>
  );
}