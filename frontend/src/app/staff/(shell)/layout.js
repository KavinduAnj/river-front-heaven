"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Waves, Bell, Plus, LogOut, UserRound } from "lucide-react";
import { api, getToken, clearToken } from "@/lib/api";
import { StaffContext } from "@/lib/staff-context";
import { NAV } from "@/components/staff/nav";

const Loading = () => <div className="grid min-h-screen place-items-center text-muted">Loading...</div>;

// Suspense is needed because the shell reads the current URL (usePathname)
export default function StaffLayout({ children }) {
    return (
        <Suspense fallback={<Loading />}>
            <StaffShell>{children}</StaffShell>
        </Suspense>
    );
}

function StaffShell({ children }) {
    const router = useRouter();
    const pathname = usePathname();
    const [user, setUser] = useState(null);

    // Not logged in, or token no longer valid: go to the login page
    useEffect(() => {
        if (!getToken()) {
            router.replace("/staff/login");
            return;
        }
        api("/auth/me")
            .then((data) => setUser(data.user))
            .catch(() => {
                clearToken();
                router.replace("/staff/login");
            });
    }, [router]);

    function signOut() {
        clearToken();
        router.replace("/staff/login");
    }

    if (!user) return <Loading />;

    const isAdmin = user.role === "ADMIN";
    const menu = NAV.filter((item) => !item.adminOnly || isAdmin);
    const isActive = (href) => (href === "/staff" ? pathname === href : pathname.startsWith(href));
    const current = menu.find((item) => isActive(item.href));

    return (
        <StaffContext.Provider value={user}>
            <div className="flex min-h-screen">
                <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-brand p-4 text-white lg:flex">
                    <div className="px-3 pb-6 pt-3">
                        <span className="grid size-11 place-items-center rounded-full border border-white/70">
                            <Waves size={22} />
                        </span>
                        <div className="mt-4 text-xl font-bold">River Front Heaven</div>
                        <div className="text-sm text-white/70">Hotel &amp; safari resort · Sri Lanka</div>
                    </div>

                    <div className="px-3 pb-2 text-xs font-semibold tracking-wider text-white/70">STAFF WORKSPACE</div>
                    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
                        {menu.map(({ href, label, icon: Icon }) => (
                            <Link
                                key={href}
                                href={href}
                                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-[15px] ${isActive(href) ? "bg-brand-soft font-semibold text-brand-dark" : "text-white/90 hover:bg-white/10"
                                    }`}
                            >
                                <Icon size={20} /> {label}
                            </Link>
                        ))}
                    </nav>

                    <div className="border-t border-white/20 pt-4">
                        <div className="flex items-center gap-3 px-3">
                            <span className="grid size-10 place-items-center rounded-full border border-white/40">
                                <UserRound size={20} />
                            </span>
                            <div className="min-w-0">
                                <div className="truncate font-semibold">{user.fullName}</div>
                                <div className="text-sm text-white/70">{isAdmin ? "Administrator" : "Staff"}</div>
                            </div>
                        </div>
                        <button onClick={signOut} className="mt-3 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-white/90 hover:bg-white/10">
                            <LogOut size={20} /> Sign out
                        </button>
                    </div>
                </aside>

                <div className="flex min-w-0 flex-1 flex-col">
                    <header className="flex h-20 items-center justify-between border-b border-line bg-white px-8">
                        <div className="text-sm text-muted">
                            Staff portal <span className="mx-2">&gt;</span>
                            <span className="font-semibold text-ink">{current ? current.label : ""}</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <button aria-label="Notifications" className="text-muted"><Bell size={20} /></button>
                            <Link href="/staff/reservations" className="flex items-center gap-2 rounded-xl bg-accent px-4 py-3 font-bold hover:bg-accent-dark">
                                <Plus size={18} /> New reservation
                            </Link>
                        </div>
                    </header>
                    <main className="flex-1 p-8">{children}</main>
                </div>
            </div>
        </StaffContext.Provider>
    );
}