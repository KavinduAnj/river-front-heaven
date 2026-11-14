
"use client";

import { useEffect, useState } from "react";
import {
    Plus,
    Search,
    Pencil,
    Activity as ActivityIcon,
    Users,
    IndianRupee,
    RefreshCw,
} from "lucide-react";

import { api } from "@/lib/api";
import { useStaff } from "@/lib/staff-context";
import { Button } from "@/components/staff/ui/Button";
import { Card } from "@/components/staff/ui/Card";
import { Badge } from "@/components/staff/ui/Badge";
import { Drawer } from "@/components/staff/ui/Drawer";

const EMPTY_FORM = {
    name: "",
    category: "Safari",
    description: "",
    pricePerPerson: "",
    maxParticipants: "",
    isActive: true,
};

const CATEGORIES = ["All", "Safari", "Outdoor activity"];

const DEMO_ACTIVITIES = [
    {
        id: "demo-1",
        name: "Sunrise River Safari",
        category: "Safari",
        description: "Enjoy a peaceful early morning river safari and explore the surrounding wildlife.",
        pricePerPerson: 5000,
        maxParticipants: 8,
        isActive: true,
    },
    {
        id: "demo-2",
        name: "Bird Watching",
        category: "Outdoor activity",
        description: "Discover local bird species during a guided nature experience.",
        pricePerPerson: 2500,
        maxParticipants: 6,
        isActive: true,
    },
    {
        id: "demo-3",
        name: "Evening Boat Safari",
        category: "Safari",
        description: "Experience the river and its natural surroundings during the evening.",
        pricePerPerson: 4000,
        maxParticipants: 8,
        isActive: false,
    },
];

export default function ActivitiesPage() {
    const user = useStaff();
    const isAdmin = user?.role === "ADMIN";

    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [search, setSearch] = useState("");
    const [category, setCategory] = useState("All");

    const [drawerOpen, setDrawerOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState("");

    const isDemoMode =
        typeof window !== "undefined" &&
        localStorage.getItem("rfh_token") === "demo_staff_token";

    async function loadActivities() {
        setLoading(true);
        setError("");

        if (isDemoMode) {
            setActivities(DEMO_ACTIVITIES);
            setLoading(false);
            return;
        }

        try {
            const result = await api("/activities");
            setActivities(result.data || []);
        } catch (err) {
            setError(err.message || "Unable to load activities.");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        let cancelled = false;

        async function fetchActivities() {
            const token = localStorage.getItem("rfh_token");

            if (token === "demo_staff_token") {
                setActivities(DEMO_ACTIVITIES);
                setLoading(false);
                return;
            }

            if (!token) {
                setError("Please sign in to view activities.");
                setLoading(false);
                return;
            }

            try {
                const result = await api("/activities");

                if (!cancelled) {
                    setActivities(result.data || []);
                    setError("");
                }
            } catch (err) {
                if (!cancelled) {
                    setError(err.message || "Unable to load activities.");
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        fetchActivities();

        return () => {
            cancelled = true;
        };
    }, []);

    function openAddDrawer() {
        setEditingId(null);
        setForm({ ...EMPTY_FORM });
        setFormError("");
        setDrawerOpen(true);
    }

    function openEditDrawer(activity) {
        setEditingId(activity.id);
        setForm({
            name: activity.name,
            category: activity.category,
            description: activity.description || "",
            pricePerPerson: String(activity.pricePerPerson),
            maxParticipants: String(activity.maxParticipants),
            isActive: activity.isActive,
        });
        setFormError("");
        setDrawerOpen(true);
    }

    function updateField(event) {
        const { name, value, type, checked } = event.target;

        setForm((previous) => ({
            ...previous,
            [name]: type === "checkbox" ? checked : value,
        }));
    }

    async function handleSubmit(event) {
        event.preventDefault();
        setFormError("");

        if (isDemoMode) {
            setFormError("Activity changes are unavailable in Demo Mode.");
            return;
        }

        const price = Number(form.pricePerPerson);
        const participants = Number(form.maxParticipants);

        if (!form.name.trim() || !form.description.trim()) {
            setFormError("Please complete all required fields.");
            return;
        }

        if (!Number.isFinite(price) || price <= 0) {
            setFormError("Enter a valid price greater than zero.");
            return;
        }

        if (!Number.isInteger(participants) || participants < 1) {
            setFormError("Enter a valid maximum participant count.");
            return;
        }

        const payload = {
            name: form.name.trim(),
            category: form.category,
            description: form.description.trim(),
            pricePerPerson: price,
            maxParticipants: participants,
            isActive: form.isActive,
        };

        setSaving(true);

        try {
            if (editingId !== null) {
                await api(`/activities/${editingId}`, {
                    method: "PATCH",
                    body: payload,
                });
            } else {
                await api("/activities", {
                    method: "POST",
                    body: payload,
                });
            }

            setDrawerOpen(false);
            await loadActivities();
        } catch (err) {
            setFormError(err.message || "Unable to save activity.");
        } finally {
            setSaving(false);
        }
    }

    const filteredActivities = activities.filter((activity) => {
        const matchesSearch = activity.name
            .toLowerCase()
            .includes(search.toLowerCase());

        const matchesCategory =
            category === "All" || activity.category === category;

        return matchesSearch && matchesCategory;
    });

    const activeCount = activities.filter((a) => a.isActive).length;

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-ink">
                        Activities and Safaris
                    </h1>
                    <p className="mt-2 text-sm text-muted">
                        Manage activities and safari experiences.
                    </p>
                    {isDemoMode && (
                        <p className="mt-2 text-xs text-amber-700">
                            Demo Mode — showing sample activities.
                        </p>
                    )}
                </div>

                {isAdmin && !isDemoMode && (
                    <Button onClick={openAddDrawer}>
                        <Plus size={18} />
                        Add Activity
                    </Button>
                )}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
                <Card className="p-5">
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-muted">Total activities</p>
                        <ActivityIcon className="text-brand" size={22} />
                    </div>
                    <p className="mt-3 text-3xl font-bold text-ink">
                        {activities.length}
                    </p>
                </Card>

                <Card className="p-5">
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-muted">Active activities</p>
                        <span className="text-emerald-600">●</span>
                    </div>
                    <p className="mt-3 text-3xl font-bold text-ink">
                        {activeCount}
                    </p>
                </Card>

                <Card className="p-5">
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-muted">Inactive activities</p>
                        <span className="text-slate-400">●</span>
                    </div>
                    <p className="mt-3 text-3xl font-bold text-ink">
                        {activities.length - activeCount}
                    </p>
                </Card>
            </div>

            <Card className="overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line p-5">
                    <div>
                        <h2 className="font-bold text-ink">All activities</h2>
                        <p className="mt-1 text-sm text-muted">
                            View available experiences.
                        </p>
                    </div>

                    <button
                        onClick={loadActivities}
                        disabled={loading}
                        className="rounded-lg border border-line p-2 text-muted hover:bg-surface disabled:opacity-50"
                        title="Refresh activities"
                    >
                        <RefreshCw size={18} />
                    </button>
                </div>

                <div className="flex flex-col gap-3 border-b border-line p-5 md:flex-row">
                    <div className="relative flex-1">
                        <Search
                            size={18}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                        />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search activities..."
                            className="h-11 w-full rounded-xl border border-line pl-10 pr-4 outline-none focus:border-brand"
                        />
                    </div>

                    <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="h-11 rounded-xl border border-line bg-white px-4 outline-none focus:border-brand"
                    >
                        {CATEGORIES.map((item) => (
                            <option key={item} value={item}>
                                {item}
                            </option>
                        ))}
                    </select>
                </div>

                {error && (
                    <div className="m-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
                        {error}
                    </div>
                )}

                {loading ? (
                    <div className="p-10 text-center text-muted">
                        Loading activities...
                    </div>
                ) : filteredActivities.length === 0 ? (
                    <div className="p-10 text-center text-muted">
                        No activities found.
                    </div>
                ) : (
                    <div className="divide-y divide-line">
                        {filteredActivities.map((activity) => (
                            <div
                                key={activity.id}
                                className="flex flex-col justify-between gap-4 p-5 md:flex-row md:items-center"
                            >
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h3 className="font-semibold text-ink">
                                            {activity.name}
                                        </h3>
                                        <Badge
                                            status={
                                                activity.isActive
                                                    ? "ACTIVE"
                                                    : "DEACTIVATED"
                                            }
                                        />
                                    </div>

                                    <p className="mt-2 text-sm text-muted">
                                        {activity.description}
                                    </p>

                                    <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted">
                                        <span>{activity.category}</span>
                                        <span className="flex items-center gap-1">
                                            <IndianRupee size={15} />
                                            {Number(
                                                activity.pricePerPerson
                                            ).toLocaleString("en-LK")}
                                            {" "}per person
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Users size={15} />
                                            Maximum {activity.maxParticipants}
                                        </span>
                                    </div>
                                </div>

                                {isAdmin && !isDemoMode && (
                                    <Button
                                        variant="outline"
                                        onClick={() => openEditDrawer(activity)}
                                    >
                                        <Pencil size={16} />
                                        Edit
                                    </Button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </Card>

            <Drawer
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
                title={
                    editingId !== null
                        ? "Edit activity"
                        : "Add new activity"
                }
                footer={
                    <>
                        <Button
                            variant="outline"
                            onClick={() => setDrawerOpen(false)}
                            disabled={saving}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={() =>
                                document
                                    .getElementById("activity-form")
                                    ?.requestSubmit()
                            }
                            disabled={saving}
                        >
                            {saving
                                ? "Saving..."
                                : editingId !== null
                                    ? "Save changes"
                                    : "Save activity"}
                        </Button>
                    </>
                }
            >
                <form
                    id="activity-form"
                    onSubmit={handleSubmit}
                    className="space-y-5"
                >
                    <div>
                        <label className="mb-2 block text-sm font-semibold text-ink">
                            Activity name *
                        </label>
                        <input
                            name="name"
                            value={form.name}
                            onChange={updateField}
                            required
                            maxLength={100}
                            placeholder="e.g. Sunrise river safari"
                            className="h-11 w-full rounded-xl border border-line px-3 outline-none focus:border-brand"
                        />
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-semibold text-ink">
                            Category *
                        </label>
                        <select
                            name="category"
                            value={form.category}
                            onChange={updateField}
                            className="h-11 w-full rounded-xl border border-line bg-white px-3 outline-none focus:border-brand"
                        >
                            <option value="Safari">Safari</option>
                            <option value="Outdoor activity">
                                Outdoor activity
                            </option>
                        </select>
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-semibold text-ink">
                            Description *
                        </label>
                        <textarea
                            name="description"
                            value={form.description}
                            onChange={updateField}
                            required
                            rows={4}
                            placeholder="Describe this experience..."
                            className="w-full rounded-xl border border-line p-3 outline-none focus:border-brand"
                        />
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-semibold text-ink">
                            Price per person (LKR) *
                        </label>
                        <input
                            name="pricePerPerson"
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={form.pricePerPerson}
                            onChange={updateField}
                            required
                            placeholder="5000"
                            className="h-11 w-full rounded-xl border border-line px-3 outline-none focus:border-brand"
                        />
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-semibold text-ink">
                            Maximum participants *
                        </label>
                        <input
                            name="maxParticipants"
                            type="number"
                            min="1"
                            step="1"
                            value={form.maxParticipants}
                            onChange={updateField}
                            required
                            placeholder="8"
                            className="h-11 w-full rounded-xl border border-line px-3 outline-none focus:border-brand"
                        />
                    </div>

                    <label className="flex items-center gap-3 rounded-xl bg-surface p-4">
                        <input
                            type="checkbox"
                            name="isActive"
                            checked={form.isActive}
                            onChange={updateField}
                            className="size-4 accent-teal-700"
                        />
                        <span>
                            <span className="block text-sm font-semibold text-ink">
                                Active availability
                            </span>
                            <span className="text-xs text-muted">
                                Make this activity available in the system.
                            </span>
                        </span>
                    </label>

                    {formError && (
                        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
                            {formError}
                        </p>
                    )}
                </form>
            </Drawer>
        </div>
    );
}
