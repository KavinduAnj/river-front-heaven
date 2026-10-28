import { notFound } from "next/navigation";
import { NAV } from "@/components/staff/nav";

// Placeholder for every menu page that has not been built yet.
// When someone builds a real page (for example src/app/staff/(shell)/reservations/page.js),
// it automatically takes priority over this file.
export default async function Placeholder({ params }) {
    const { section } = await params;
    const item = NAV.find((n) => n.href === `/staff/${section}`);
    if (!item) notFound();

    return (
        <div>
            <h1 className="text-4xl font-extrabold">{item.label}</h1>
            <p className="mt-2 text-muted">This page is not built yet.</p>
        </div>
    );
}