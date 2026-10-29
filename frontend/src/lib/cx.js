// Joins class names and skips empty ones: cx("a", cond && "b")
export const cx = (...classes) => classes.filter(Boolean).join(" ");