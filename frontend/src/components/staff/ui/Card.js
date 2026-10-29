import { cx } from "@/lib/cx";

// A white box. Add padding yourself: <Card className="p-6">
export function Card({ className, ...props }) {
  return <div className={cx("rounded-2xl border border-line bg-white", className)} {...props} />;
}