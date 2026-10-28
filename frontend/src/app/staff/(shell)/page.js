"use client";
import { useStaff } from "@/lib/staff-context";

// Live numbers arrive with the dashboard task. For now the cards show placeholders.
const CARDS = [
    { title: "Cabana today", note: "One private cabana" },
    { title: "Today's check-in", note: "Scheduled arrival" },
    { title: "Today's check-out", note: "Scheduled departure" },
    { title: "Open food orders", note: "Pending and preparing" },
];

export default function Dashboard() {
    const user = useStaff();
    return (
        <div>
            <h1 className="text-4xl font-extrabold">Dashboard</h1>
            <p className="mt-2 text-muted">Welcome, {user.fullName}. A clear view of arrivals, stays and service.</p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {CARDS.map((c) => (
                    <div key={c.title} className="rounded-2xl border border-line bg-white p-5">
                        <div className="text-sm font-semibold">{c.title}</div>
                        <div className="mt-2 text-4xl font-extrabold">--</div>
                        <div className="mt-1 text-sm text-muted">{c.note}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}