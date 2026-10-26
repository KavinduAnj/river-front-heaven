"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Waves, ShieldCheck, Eye, EyeOff, CircleAlert } from "lucide-react";
import { api, setToken } from "@/lib/api";

export default function StaffLogin() {
    const router = useRouter();
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [show, setShow] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    async function onSubmit(e) {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            const data = await api("/auth/staff/login", { method: "POST", body: { username, password } });
            setToken(data.token);
            router.replace("/staff");
        } catch (err) {
            if (!err.status) setError("Cannot reach the server. Is the backend running?");
            else if (err.status === 401) setError("Incorrect username or password");
            else setError(err.message);
            setLoading(false);
        }
    }

    const input = `h-14 w-full rounded-xl border px-4 outline-none focus:ring-2 focus:ring-brand/30 ${error ? "border-red-600" : "border-line"
        }`;

    return (
        <div className="min-h-screen bg-surface p-4">
            <div
                className="relative flex min-h-[calc(100vh-2rem)] flex-col items-center justify-center rounded-3xl p-6 text-white"
                style={{ backgroundImage: "linear-gradient(135deg, #0b4f5c, #0a3640)" }}
            >
                <div className="absolute left-8 top-8 flex items-center gap-2 text-sm font-medium tracking-wide">
                    <ShieldCheck size={18} /> STAFF PORTAL
                </div>
                <div className="absolute right-8 top-8 hidden text-sm text-white/80 sm:block">Hotel &amp; safari resort · Sri Lanka</div>

                <form onSubmit={onSubmit} className="w-full max-w-[480px] rounded-2xl bg-white p-10 text-ink shadow-xl">
                    <div className="flex items-center justify-center gap-3">
                        <span className="grid size-10 place-items-center rounded-full bg-brand text-white">
                            <Waves size={20} />
                        </span>
                        <div>
                            <div className="font-bold leading-tight">River Front Heaven</div>
                            <div className="text-sm text-muted">Sri Lanka</div>
                        </div>
                    </div>

                    <h1 className="mt-6 text-center text-3xl font-extrabold">Staff sign in</h1>
                    <p className="mt-2 text-center text-muted">Use your staff credentials to access the hotel operations workspace.</p>

                    <label htmlFor="username" className="mt-6 block text-sm font-semibold">Username</label>
                    <input id="username" className={`${input} mt-2`} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required />

                    <label htmlFor="password" className="mt-4 block text-sm font-semibold">Password</label>
                    <div className="relative mt-2">
                        <input id="password" className={`${input} pr-12`} type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
                        <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-4 top-1/2 -translate-y-1/2 text-brand">
                            {show ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                    </div>

                    <button type="submit" disabled={loading} className="mt-5 h-14 w-full rounded-xl bg-accent font-bold hover:bg-accent-dark disabled:opacity-60">
                        {loading ? "Signing in..." : "Sign in"}
                    </button>

                    {error && (
                        <div role="alert" className="mt-4 flex items-center gap-2 rounded-xl bg-red-100 p-4 text-sm text-red-800">
                            <CircleAlert size={18} /> {error}
                        </div>
                    )}

                    <p className="mt-6 border-t border-line pt-5 text-center text-sm text-muted">Need access? Contact your manager.</p>
                </form>

                <div className="mt-6 rounded-xl bg-white/15 px-4 py-3 text-sm">For authorised River Front Heaven staff only.</div>
            </div>
        </div>
    );
}