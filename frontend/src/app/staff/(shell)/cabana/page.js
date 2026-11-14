
"use client";

import { useEffect, useState } from "react";
import {
    BedDouble,
    Pencil,
    Users,
    Heart,
    UserRound,
    Check,
    X,
    Plus,
    Trash2,
    Save,
    CalendarDays,
    ChevronLeft,
    ChevronRight,
} from "lucide-react";

import { api } from "@/lib/api";
import { useStaff } from "@/lib/staff-context";

import { Button } from "@/components/staff/ui/Button";
import { Card } from "@/components/staff/ui/Card";
import { Badge } from "@/components/staff/ui/Badge";
import { Alert } from "@/components/staff/ui/Alert";

const DEMO_CABANA = {
    name: "River Front Heaven",
    description: "A peaceful private riverside cabana surrounded by nature.",
    maxGuests: 4,
    facilities: ["Air Conditioning", "Hot Water", "River View", "Wi-Fi"],
    photoUrls: [],
    status: "AVAILABLE",
};

const DEMO_PACKAGES = [
    {
        id: 1,
        name: "Couple Package",
        description: "A relaxing riverside stay for two.",
        pricePerNight: 15000,
        maxAdults: 2,
        maxChildren: 0,
        inclusions: [
            "Private cabana accommodation",
            "Breakfast for two",
            "River view",
        ],
        isActive: true,
    },
    {
        id: 2,
        name: "Family Package",
        description: "A comfortable stay for families.",
        pricePerNight: 22000,
        maxAdults: 2,
        maxChildren: 2,
        inclusions: [
            "Private cabana accommodation",
            "Family breakfast",
            "River view",
            "Outdoor activities",
        ],
        isActive: true,
    },
];

const emptyPackage = {
    name: "",
    description: "",
    pricePerNight: "",
    maxAdults: 2,
    maxChildren: 0,
    inclusions: [],
    isActive: true,
};

export default function CabanaPage() {
    const user = useStaff();
    const isAdmin = user?.role === "ADMIN";

    const [cabana, setCabana] = useState(null);

    const [packages, setPackages] = useState([]);
    const [packagesLoading, setPackagesLoading] = useState(true);
    const [packagesError, setPackagesError] = useState("");
    const [editingPackage, setEditingPackage] = useState(null);
    const [packageSaving, setPackageSaving] = useState(false);
    const [newInclusion, setNewInclusion] = useState("");

    const [form, setForm] = useState({
        name: "",
        description: "",
        maxGuests: 1,
        facilities: "",
        photoUrls: "",
    });

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    // Blocked dates
const [blockedPeriods, setBlockedPeriods] = useState([]);
const [blockedLoading, setBlockedLoading] = useState(true);
const [blockedError, setBlockedError] = useState("");
const [blockedSuccess, setBlockedSuccess] = useState("");
const [blockSaving, setBlockSaving] = useState(false);

const [selectedStartDate, setSelectedStartDate] = useState("");
const [selectedEndDate, setSelectedEndDate] = useState("");
const [blockReason, setBlockReason] = useState("");

const [calendarMonth, setCalendarMonth] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1)
);

    // Load cabana and package information
    useEffect(() => {
        let isMounted = true;

        async function fetchCabana() {
            const token =
                typeof window !== "undefined"
                    ? localStorage.getItem("rfh_token")
                    : null;

            // Demo Mode
            if (!token || token === "demo_staff_token") {
                if (!isMounted) return;

                setCabana(DEMO_CABANA);

                setForm({
                    name: DEMO_CABANA.name,
                    description: DEMO_CABANA.description,
                    maxGuests: DEMO_CABANA.maxGuests,
                    facilities: DEMO_CABANA.facilities.join(", "),
                    photoUrls: DEMO_CABANA.photoUrls.join("\n"),
                });

                setPackages(DEMO_PACKAGES);
                setLoading(false);
                setPackagesLoading(false);
                return;
            }

            try {
                const result = await api("/cabana");

                if (!isMounted) return;

                setCabana(result);

                setForm({
                    name: result.name || "",
                    description: result.description || "",
                    maxGuests: result.maxGuests || 1,
                    facilities: (result.facilities || []).join(", "),
                    photoUrls: (result.photoUrls || []).join("\n"),
                });

                setError("");
            } catch (err) {
                if (isMounted) {
                    setError(
                        err.message || "Unable to load cabana details."
                    );
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        }

        async function fetchPackages() {
            const token =
                typeof window !== "undefined"
                    ? localStorage.getItem("rfh_token")
                    : null;

            if (!token || token === "demo_staff_token") {
                if (isMounted) {
                    setPackages(DEMO_PACKAGES);
                    setPackagesLoading(false);
                }
                return;
            }

            try {
                const result = await api("/packages");

                if (!isMounted) return;

                setPackages(result.data || []);
                setPackagesError("");
            } catch (err) {
                if (isMounted) {
                    setPackagesError(
                        err.message || "Unable to load stay packages."
                    );
                }
            } finally {
                if (isMounted) {
                    setPackagesLoading(false);
                }
            }
        }

        async function fetchBlockedPeriods() {
    const token =
        typeof window !== "undefined"
            ? localStorage.getItem("rfh_token")
            : null;

    // Demo mode
    if (!token || token === "demo_staff_token") {
        if (isMounted) {
            setBlockedPeriods([]);
            setBlockedLoading(false);
        }
        return;
    }

    try {
        const result = await api("/blocked-periods");

        if (!isMounted) return;

        setBlockedPeriods(result.data || []);
        setBlockedError("");
    } catch (err) {
        if (isMounted) {
            setBlockedError(
                err.message || "Unable to load blocked dates."
            );
        }
    } finally {
        if (isMounted) {
            setBlockedLoading(false);
        }
    }
}

        fetchCabana();
        fetchPackages();
        fetchBlockedPeriods();

        return () => {
            isMounted = false;
        };

    }, []);

    // Update cabana form fields
    function updateField(event) {
        const { name, value } = event.target;

        setForm((previous) => ({
            ...previous,
            [name]: value,
        }));
    }

    // Save cabana details
    async function handleSave(event) {
        event.preventDefault();

        setError("");
        setSuccess("");

        const photoUrls = form.photoUrls
            .split("\n")
            .map((url) => url.trim())
            .filter(Boolean);

        const payload = {
            name: form.name.trim(),
            description: form.description.trim(),
            maxGuests: Number(form.maxGuests),
            facilities: form.facilities
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean),
            photoUrls,
        };

        if (!payload.name || payload.maxGuests < 1) {
            setError(
                "Enter a valid cabana name and maximum guest count."
            );
            return;
        }

        if (localStorage.getItem("rfh_token") === "demo_staff_token") {
            setCabana({
                ...cabana,
                ...payload,
            });
            setSuccess("Demo cabana details updated.");
            return;
        }

        setSaving(true);

        try {
            const result = await api("/cabana", {
                method: "PATCH",
                body: payload,
            });

            setCabana(result);
            setSuccess("Cabana details updated successfully.");
        } catch (err) {
            setError(
                err.message || "Unable to save cabana details."
            );
        } finally {
            setSaving(false);
        }
    }

    // Start editing a package
    function startEditingPackage(pkg) {
        setEditingPackage({
            ...pkg,
            inclusions: [...(pkg.inclusions || [])],
        });
        setNewInclusion("");
        setPackagesError("");
    }

    // Update package form fields
    function updatePackageField(event) {
        const { name, value, type, checked } = event.target;

        setEditingPackage((previous) => ({
            ...previous,
            [name]:
                type === "checkbox"
                    ? checked
                    : value,
        }));
    }

    // Add package inclusion
    function addInclusion() {
        const value = newInclusion.trim();

        if (!value) return;

        setEditingPackage((previous) => ({
            ...previous,
            inclusions: [...previous.inclusions, value],
        }));

        setNewInclusion("");
    }

    // Remove package inclusion
    function removeInclusion(index) {
        setEditingPackage((previous) => ({
            ...previous,
            inclusions: previous.inclusions.filter(
                (_, i) => i !== index
            ),
        }));
    }

    // Save package
    async function savePackage(event) {
        event.preventDefault();

        if (!editingPackage) return;

        setPackagesError("");

        const payload = {
            name: editingPackage.name.trim(),
            description: editingPackage.description.trim(),
            pricePerNight: Number(editingPackage.pricePerNight),
            maxAdults: Number(editingPackage.maxAdults),
            maxChildren: Number(editingPackage.maxChildren),
            inclusions: editingPackage.inclusions,
            isActive: Boolean(editingPackage.isActive),
        };

        if (
            !payload.name ||
            payload.pricePerNight <= 0 ||
            payload.maxAdults < 1 ||
            payload.maxChildren < 0
        ) {
            setPackagesError("Please enter valid package details.");
            return;
        }

        const isDemo =
            localStorage.getItem("rfh_token") === "demo_staff_token";

        setPackageSaving(true);

        try {
            let savedPackage;

            if (isDemo) {
                savedPackage = {
                    ...editingPackage,
                    ...payload,
                };
            } else if (editingPackage.id) {
                savedPackage = await api(
                    `/packages/${editingPackage.id}`,
                    {
                        method: "PATCH",
                        body: payload,
                    }
                );
            } else {
                savedPackage = await api("/packages", {
                    method: "POST",
                    body: payload,
                });
            }

            setPackages((previous) => {
                const exists = previous.some(
                    (pkg) => pkg.id === savedPackage.id
                );

                if (exists) {
                    return previous.map((pkg) =>
                        pkg.id === savedPackage.id
                            ? savedPackage
                            : pkg
                    );
                }

                return [...previous, savedPackage];
            });

            setEditingPackage(null);
            setPackagesError("");
        } catch (err) {
            setPackagesError(
                err.message || "Unable to save package."
            );
        } finally {
            setPackageSaving(false);
        }
    }

    // Create a new package
    function createPackage() {
        setEditingPackage(emptyPackage);
        setNewInclusion("");
        setPackagesError("");
    }

        // Format a date as YYYY-MM-DD using local date values
    function formatDateKey(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");

        return `${year}-${month}-${day}`;
    }

    // Calendar values
    const todayKey = formatDateKey(new Date());
    const calendarYear = calendarMonth.getFullYear();
    const calendarMonthIndex = calendarMonth.getMonth();

    const firstDayOffset =
        (new Date(calendarYear, calendarMonthIndex, 1).getDay() + 6) % 7;

    const calendarDays = Array.from({ length: 42 }, (_, index) => {
        return new Date(
            calendarYear,
            calendarMonthIndex,
            index - firstDayOffset + 1
        );
    });

    function changeCalendarMonth(amount) {
        setCalendarMonth(
            new Date(
                calendarYear,
                calendarMonthIndex + amount,
                1
            )
        );
    }

    function selectCalendarDate(date) {
        const dateKey = formatDateKey(date);

        if (dateKey < todayKey) return;

        const alreadyBlocked = blockedPeriods.some((period) => {
            const start = String(period.startDate).slice(0, 10);
            const end = String(period.endDate).slice(0, 10);

            return dateKey >= start && dateKey < end;
        });

        if (alreadyBlocked) return;

        if (
            !selectedStartDate ||
            selectedEndDate ||
            dateKey <= selectedStartDate
        ) {
            setSelectedStartDate(dateKey);
            setSelectedEndDate("");
        } else {
            setSelectedEndDate(dateKey);
        }

        setBlockedError("");
        setBlockedSuccess("");
    }

    // Save a new blocked period
    async function handleBlockDates(event) {
        event.preventDefault();

        setBlockedError("");
        setBlockedSuccess("");

        if (!isAdmin) {
            setBlockedError("Only administrators can block dates.");
            return;
        }

        if (!selectedStartDate || !selectedEndDate) {
            setBlockedError("Please select a start date and an end date.");
            return;
        }

        if (selectedEndDate <= selectedStartDate) {
            setBlockedError("End date must be after the start date.");
            return;
        }

        if (!blockReason.trim()) {
            setBlockedError("Please enter a reason for blocking these dates.");
            return;
        }

        setBlockSaving(true);

        try {
            await api("/blocked-periods", {
                method: "POST",
                body: {
                    startDate: selectedStartDate,
                    endDate: selectedEndDate,
                    reason: blockReason.trim(),
                },
            });

            const result = await api("/blocked-periods");

            setBlockedPeriods(result.data || []);
            setSelectedStartDate("");
            setSelectedEndDate("");
            setBlockReason("");
            setBlockedSuccess("Blocked dates saved successfully.");
        } catch (err) {
            setBlockedError(
                err.message || "Unable to save blocked dates."
            );
        } finally {
            setBlockSaving(false);
        }
    }

    // Remove an existing blocked period
    async function handleRemoveBlockedPeriod(id) {
        if (!isAdmin) return;

        const confirmed = window.confirm(
            "Are you sure you want to remove this blocked period?"
        );

        if (!confirmed) return;

        setBlockedError("");
        setBlockedSuccess("");

        try {
            await api(`/blocked-periods/${id}`, {
                method: "DELETE",
            });

            const result = await api("/blocked-periods");

            setBlockedPeriods(result.data || []);
            setBlockedSuccess("Blocked period removed successfully.");
        } catch (err) {
            setBlockedError(
                err.message || "Unable to remove blocked period."
            );
        }
    }

    return (
        <div className="space-y-6">

            {/* Page heading */}
            <div>
                <h1 className="text-3xl font-bold text-ink">
                    Cabana and packages
                </h1>

                <p className="mt-2 text-sm text-muted">
                    Manage your private cabana, stay packages and maintenance dates.
                </p>
            </div>

            {/* General messages */}
            {error && <Alert tone="error">{error}</Alert>}
            {success && <Alert tone="success">{success}</Alert>}

            {/* CABANA DETAILS */}
            <Card className="p-6">
                <div className="mb-5">
                    <h2 className="text-xl font-bold text-ink">
                        Cabana details
                    </h2>

                    <p className="mt-1 text-sm text-muted">
                        The details guests see for your riverside stay.
                    </p>
                </div>

                {loading ? (
                    <p className="py-8 text-center text-muted">
                        Loading cabana details...
                    </p>
                ) : !cabana ? (
                    <p className="py-8 text-center text-muted">
                        Cabana details are not available.
                    </p>
                ) : (
                    <form onSubmit={handleSave} className="space-y-6">
                        <div className="grid gap-6 lg:grid-cols-2">

                            {/* Photo gallery */}
                            <div>
                                <div className="mb-3 flex items-center justify-between">
                                    <h3 className="font-semibold text-ink">
                                        Photo gallery
                                    </h3>

                                    <span className="text-xs text-muted">
                                        {cabana.photoUrls?.length || 0} photos
                                    </span>
                                </div>

                                {cabana.photoUrls?.length > 0 ? (
                                    <div className="grid grid-cols-2 gap-3">
                                        {cabana.photoUrls.map((url, index) => (
                                            <div
                                                key={index}
                                                className={`overflow-hidden rounded-xl border border-line ${
                                                    index === 0 ? "col-span-2" : ""
                                                }`}
                                            >
                                                <img
                                                    src={url}
                                                    alt={`Cabana photo ${index + 1}`}
                                                    className={`w-full object-cover ${
                                                        index === 0 ? "h-48" : "h-28"
                                                    }`}
                                                />

                                                {index === 0 && (
                                                    <p className="bg-surface px-3 py-2 text-xs font-medium">
                                                        Cover photo
                                                    </p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="grid h-48 place-items-center rounded-xl bg-surface text-muted">
                                        <div className="text-center">
                                            <BedDouble
                                                size={32}
                                                className="mx-auto mb-2"
                                            />
                                            No photos added yet
                                        </div>
                                    </div>
                                )}

                                {isAdmin && (
                                    <div className="mt-4">
                                        <label className="mb-2 block text-sm font-semibold text-ink">
                                            Photo URLs (one per line)
                                        </label>

                                        <textarea
                                            name="photoUrls"
                                            value={form.photoUrls}
                                            onChange={updateField}
                                            rows={3}
                                            placeholder="https://example.com/cabana-photo.jpg"
                                            className="w-full rounded-xl border border-line p-3 text-sm outline-none focus:border-brand"
                                        />

                                        <p className="mt-1 text-xs text-muted">
                                            The first URL will be used as the cover photo.
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Cabana information */}
                            <div className="space-y-5">
                                <div>
                                    <label className="mb-2 block text-sm font-semibold text-ink">
                                        Cabana name
                                    </label>

                                    <input
                                        name="name"
                                        value={form.name}
                                        onChange={updateField}
                                        disabled={!isAdmin}
                                        className="h-11 w-full rounded-xl border border-line px-3 disabled:bg-surface"
                                    />
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-semibold text-ink">
                                        Description
                                    </label>

                                    <textarea
                                        name="description"
                                        value={form.description}
                                        onChange={updateField}
                                        disabled={!isAdmin}
                                        rows={4}
                                        className="w-full rounded-xl border border-line p-3 disabled:bg-surface"
                                    />
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-semibold text-ink">
                                        Facilities
                                    </label>

                                    <input
                                        name="facilities"
                                        value={form.facilities}
                                        onChange={updateField}
                                        disabled={!isAdmin}
                                        placeholder="AC, Hot water, River view, Wi-Fi"
                                        className="h-11 w-full rounded-xl border border-line px-3 disabled:bg-surface"
                                    />

                                    <p className="mt-1 text-xs text-muted">
                                        Separate facilities with commas.
                                    </p>
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-semibold text-ink">
                                        Maximum guests
                                    </label>

                                    <div className="flex items-center gap-2">
                                        <Users size={18} className="text-muted" />

                                        <input
                                            name="maxGuests"
                                            type="number"
                                            min="1"
                                            value={form.maxGuests}
                                            onChange={updateField}
                                            disabled={!isAdmin}
                                            className="h-11 w-full rounded-xl border border-line px-3 disabled:bg-surface"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="mb-2 block text-sm font-semibold text-ink">
                                        Current status
                                    </label>

                                    <Badge tone="blue">
                                        {cabana.status?.replaceAll("_", " ") || "Unknown"}
                                    </Badge>

                                    <p className="mt-2 text-xs text-muted">
                                        Status changes are not currently supported by the backend.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {isAdmin && (
                            <div className="flex justify-end border-t border-line pt-5">
                                <Button type="submit" disabled={saving}>
                                    <Pencil size={16} />
                                    {saving ? "Saving..." : "Save cabana details"}
                                </Button>
                            </div>
                        )}
                    </form>
                )}
            </Card>

            {/* STAY PACKAGES */}
            <Card className="p-6">
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-xl font-bold text-ink">
                            Stay packages
                        </h2>

                        <p className="mt-1 text-sm text-muted">
                            Manage the available accommodation packages and their prices.
                        </p>
                    </div>

                    {isAdmin && (
                        <Button onClick={createPackage}>
                            <Plus size={17} />
                            Add package
                        </Button>
                    )}
                </div>

                {packagesError && (
                    <Alert tone="error">{packagesError}</Alert>
                )}

                {packagesLoading ? (
                    <p className="py-8 text-center text-muted">
                        Loading stay packages...
                    </p>
                ) : packages.length === 0 ? (
                    <p className="py-8 text-center text-muted">
                        No stay packages available.
                    </p>
                ) : (
                    <div className="grid gap-5 lg:grid-cols-2">
                        {packages.map((pkg) => (
                            <div
                                key={pkg.id}
                                className="rounded-2xl border border-line p-5"
                            >
                                <div className="mb-4 flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className="grid size-11 place-items-center rounded-xl bg-surface text-brand">
                                            {pkg.name.toLowerCase().includes("couple") ? (
                                                <Heart size={21} />
                                            ) : (
                                                <Users size={21} />
                                            )}
                                        </div>

                                        <div>
                                            <h3 className="font-bold text-ink">
                                                {pkg.name}
                                            </h3>

                                            <Badge
                                                tone={pkg.isActive ? "green" : "grey"}
                                            >
                                                {pkg.isActive ? "Active" : "Inactive"}
                                            </Badge>
                                        </div>
                                    </div>

                                    {isAdmin && (
                                        <Button
                                            variant="outline"
                                            onClick={() => startEditingPackage(pkg)}
                                        >
                                            <Pencil size={15} />
                                            Edit
                                        </Button>
                                    )}
                                </div>

                                <p className="mb-4 text-sm text-muted">
                                    {pkg.description || "No description added."}
                                </p>

                                <div className="mb-5 rounded-xl bg-surface p-4">
                                    <p className="text-xs text-muted">
                                        Price per night
                                    </p>

                                    <p className="mt-1 text-2xl font-bold text-ink">
                                        LKR {Number(pkg.pricePerNight).toLocaleString("en-LK")}
                                    </p>
                                </div>

                                <div className="mb-5 grid grid-cols-2 gap-3">
                                    <div className="rounded-xl border border-line p-3">
                                        <UserRound size={17} className="mb-2 text-muted" />
                                        <p className="text-lg font-bold text-ink">
                                            {pkg.maxAdults}
                                        </p>
                                        <p className="text-xs text-muted">
                                            Maximum adults
                                        </p>
                                    </div>

                                    <div className="rounded-xl border border-line p-3">
                                        <Users size={17} className="mb-2 text-muted" />
                                        <p className="text-lg font-bold text-ink">
                                            {pkg.maxChildren}
                                        </p>
                                        <p className="text-xs text-muted">
                                            Maximum children
                                        </p>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="mb-3 text-sm font-semibold text-ink">
                                        Package inclusions
                                    </h4>

                                    <ul className="space-y-2">
                                        {(pkg.inclusions || []).map((item, index) => (
                                            <li
                                                key={index}
                                                className="flex items-start gap-2 text-sm text-muted"
                                            >
                                                <Check
                                                    size={16}
                                                    className="mt-0.5 shrink-0 text-emerald-600"
                                                />
                                                {item}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>

            {/* PACKAGE EDITOR */}
            {editingPackage && isAdmin && (
                <Card className="p-6">
                    <div className="mb-5 flex items-center justify-between">
                        <div>
                            <h2 className="text-xl font-bold text-ink">
                                {editingPackage.id ? "Edit package" : "Add new package"}
                            </h2>

                            <p className="mt-1 text-sm text-muted">
                                Update package information and inclusions.
                            </p>
                        </div>

                        <Button
                            variant="outline"
                            onClick={() => setEditingPackage(null)}
                        >
                            <X size={17} />
                            Close
                        </Button>
                    </div>

                    <form onSubmit={savePackage} className="space-y-5">
                        <div className="grid gap-4 md:grid-cols-2">
                            <div>
                                <label className="mb-2 block text-sm font-semibold">
                                    Package name
                                </label>

                                <input
                                    name="name"
                                    value={editingPackage.name}
                                    onChange={updatePackageField}
                                    required
                                    minLength={2}
                                    maxLength={50}
                                    className="h-11 w-full rounded-xl border border-line px-3"
                                    placeholder="Couple Package"
                                />
                            </div>

                            <div>
                                <label className="mb-2 block text-sm font-semibold">
                                    Price per night (LKR)
                                </label>

                                <input
                                    name="pricePerNight"
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    value={editingPackage.pricePerNight}
                                    onChange={updatePackageField}
                                    required
                                    className="h-11 w-full rounded-xl border border-line px-3"
                                />
                            </div>

                            <div>
                                <label className="mb-2 block text-sm font-semibold">
                                    Maximum adults
                                </label>

                                <input
                                    name="maxAdults"
                                    type="number"
                                    min="1"
                                    value={editingPackage.maxAdults}
                                    onChange={updatePackageField}
                                    required
                                    className="h-11 w-full rounded-xl border border-line px-3"
                                />
                            </div>

                            <div>
                                <label className="mb-2 block text-sm font-semibold">
                                    Maximum children
                                </label>

                                <input
                                    name="maxChildren"
                                    type="number"
                                    min="0"
                                    value={editingPackage.maxChildren}
                                    onChange={updatePackageField}
                                    required
                                    className="h-11 w-full rounded-xl border border-line px-3"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-semibold">
                                Description
                            </label>

                            <textarea
                                name="description"
                                value={editingPackage.description || ""}
                                onChange={updatePackageField}
                                rows={3}
                                className="w-full rounded-xl border border-line p-3"
                                placeholder="Describe this stay package..."
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-semibold">
                                Package inclusions
                            </label>

                            <div className="mb-3 flex gap-2">
                                <input
                                    value={newInclusion}
                                    onChange={(event) => setNewInclusion(event.target.value)}
                                    className="h-11 flex-1 rounded-xl border border-line px-3"
                                    placeholder="Add an inclusion..."
                                    onKeyDown={(event) => {
                                        if (event.key === "Enter") {
                                            event.preventDefault();
                                            addInclusion();
                                        }
                                    }}
                                />

                                <Button type="button" onClick={addInclusion}>
                                    <Plus size={16} />
                                    Add
                                </Button>
                            </div>

                            <div className="space-y-2">
                                {editingPackage.inclusions.map((item, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center justify-between rounded-xl bg-surface px-3 py-2"
                                    >
                                        <span className="text-sm">{item}</span>

                                        <button
                                            type="button"
                                            onClick={() => removeInclusion(index)}
                                            className="text-red-600 hover:text-red-800"
                                            aria-label={`Remove ${item}`}
                                        >
                                            <Trash2 size={17} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <label className="flex items-center gap-3 rounded-xl border border-line p-4">
                            <input
                                type="checkbox"
                                name="isActive"
                                checked={editingPackage.isActive}
                                onChange={updatePackageField}
                                className="size-4"
                            />

                            <div>
                                <p className="font-semibold text-ink">
                                    Active package
                                </p>
                                <p className="text-xs text-muted">
                                    Active packages can be selected for new reservations.
                                </p>
                            </div>
                        </label>

                        <div className="flex flex-wrap justify-end gap-3 border-t border-line pt-5">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setEditingPackage(null)}
                            >
                                Cancel
                            </Button>

                            <Button type="submit" disabled={packageSaving}>
                                <Save size={16} />
                                {packageSaving ? "Saving..." : "Save package"}
                            </Button>
                        </div>
                    </form>
                </Card>
            )}


                        {/* BLOCKED DATES CALENDAR */}
            <Card className="p-6">
                <div className="mb-6">
                    <div className="flex items-center gap-2">
                        <CalendarDays size={22} className="text-brand" />
                        <h2 className="text-xl font-bold text-ink">
                            Blocked Dates
                        </h2>
                    </div>

                    <p className="mt-2 text-sm text-muted">
                        Select dates when the cabana is unavailable for reservations.
                    </p>
                </div>

                {blockedError && (
                    <div className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                        {blockedError}
                    </div>
                )}

                {blockedSuccess && (
                    <div className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">
                        {blockedSuccess}
                    </div>
                )}

                <div className="grid gap-6 lg:grid-cols-2">
                    {/* Calendar */}
                    <div>
                        <div className="mb-4 flex items-center justify-between">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => changeCalendarMonth(-1)}
                            >
                                <ChevronLeft size={17} />
                            </Button>

                            <h3 className="font-semibold text-ink">
                                {calendarMonth.toLocaleDateString("en-US", {
                                    month: "long",
                                    year: "numeric",
                                })}
                            </h3>

                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => changeCalendarMonth(1)}
                            >
                                <ChevronRight size={17} />
                            </Button>
                        </div>

                        <div className="grid grid-cols-7 gap-1 text-center">
                            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                                (day) => (
                                    <div
                                        key={day}
                                        className="py-2 text-xs font-semibold text-muted"
                                    >
                                        {day}
                                    </div>
                                )
                            )}

                            {calendarDays.map((date, index) => {
                                const dateKey = formatDateKey(date);
                                const isCurrentMonth =
                                    date.getMonth() === calendarMonthIndex;

                                const isPast = dateKey < todayKey;

                                const isBlocked = blockedPeriods.some((period) => {
                                    const start = String(period.startDate).slice(0, 10);
                                    const end = String(period.endDate).slice(0, 10);

                                    return dateKey >= start && dateKey < end;
                                });

                                const isSelected =
                                    dateKey === selectedStartDate ||
                                    dateKey === selectedEndDate;

                                const isInSelectedRange =
                                    selectedStartDate &&
                                    selectedEndDate &&
                                    dateKey > selectedStartDate &&
                                    dateKey < selectedEndDate;

                                return (
                                    <button
                                        key={index}
                                        type="button"
                                        disabled={
                                            isPast ||
                                            isBlocked ||
                                            !isCurrentMonth
                                        }
                                        onClick={() => selectCalendarDate(date)}
                                        className={`aspect-square rounded-lg text-sm transition
                                            ${!isCurrentMonth ? "text-transparent" : ""}
                                            ${isPast ? "cursor-not-allowed text-gray-300" : ""}
                                            ${isBlocked ? "cursor-not-allowed bg-red-100 text-red-700 line-through" : ""}
                                            ${isSelected ? "bg-brand font-bold text-white" : ""}
                                            ${isInSelectedRange ? "bg-blue-100 text-blue-800" : ""}
                                            ${!isPast && !isBlocked && isCurrentMonth && !isSelected && !isInSelectedRange
                                                ? "hover:bg-surface text-ink"
                                                : ""}
                                        `}
                                    >
                                        {date.getDate()}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted">
                            <span className="flex items-center gap-2">
                                <span className="size-3 rounded bg-brand" />
                                Selected
                            </span>

                            <span className="flex items-center gap-2">
                                <span className="size-3 rounded bg-red-100" />
                                Blocked
                            </span>

                            <span className="flex items-center gap-2">
                                <span className="size-3 rounded bg-blue-100" />
                                Selected range
                            </span>
                        </div>
                    </div>

                    {/* Block date form */}
                    <div>
                        <h3 className="mb-4 font-semibold text-ink">
                            Block a Date Range
                        </h3>

                        <form onSubmit={handleBlockDates} className="space-y-4">
                            <div>
                                <label className="mb-2 block text-sm font-medium">
                                    Start date
                                </label>

                                <input
                                    type="date"
                                    value={selectedStartDate}
                                    onChange={(event) => {
                                        setSelectedStartDate(event.target.value);
                                        setSelectedEndDate("");
                                    }}
                                    min={todayKey}
                                    disabled={!isAdmin}
                                    className="h-11 w-full rounded-xl border border-line px-3"
                                />
                            </div>

                            <div>
                                <label className="mb-2 block text-sm font-medium">
                                    End date (check-out date)
                                </label>

                                <input
                                    type="date"
                                    value={selectedEndDate}
                                    onChange={(event) =>
                                        setSelectedEndDate(event.target.value)
                                    }
                                    min={selectedStartDate || todayKey}
                                    disabled={!isAdmin || !selectedStartDate}
                                    className="h-11 w-full rounded-xl border border-line px-3"
                                />
                            </div>

                            <div>
                                <label className="mb-2 block text-sm font-medium">
                                    Reason
                                </label>

                                <textarea
                                    value={blockReason}
                                    onChange={(event) =>
                                        setBlockReason(event.target.value)
                                    }
                                    maxLength={250}
                                    rows={3}
                                    disabled={!isAdmin}
                                    placeholder="Enter the reason for blocking these dates..."
                                    className="w-full rounded-xl border border-line p-3"
                                />
                            </div>

                            <p className="text-xs text-muted">
                                The end date is exclusive. For example, selecting
                                15–18 November blocks the nights of 15, 16 and 17 November.
                            </p>

                            {isAdmin ? (
                                <Button
                                    type="submit"
                                    disabled={
                                        blockSaving ||
                                        !selectedStartDate ||
                                        !selectedEndDate ||
                                        !blockReason.trim()
                                    }
                                    block
                                >
                                    {blockSaving ? "Saving..." : "Block Selected Dates"}
                                </Button>
                            ) : (
                                <p className="text-sm text-muted">
                                    Only administrators can block or remove dates.
                                </p>
                            )}
                        </form>
                    </div>
                </div>

                {/* Existing blocked periods */}
                <div className="mt-8 border-t border-line pt-6">
                    <h3 className="mb-4 font-semibold text-ink">
                        Existing Blocked Periods
                    </h3>

                    {blockedLoading ? (
                        <p className="text-sm text-muted">
                            Loading blocked periods...
                        </p>
                    ) : blockedPeriods.length === 0 ? (
                        <p className="rounded-xl bg-surface p-4 text-sm text-muted">
                            No blocked dates found.
                        </p>
                    ) : (
                        <div className="space-y-3">
                            {blockedPeriods.map((period) => (
                                <div
                                    key={period.id}
                                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line p-4"
                                >
                                    <div>
                                        <p className="font-semibold text-ink">
                                            {String(period.startDate).slice(0, 10)}
                                            {" – "}
                                            {String(period.endDate).slice(0, 10)}
                                        </p>

                                        <p className="mt-1 text-sm text-muted">
                                            {period.reason}
                                        </p>
                                    </div>

                                    {isAdmin && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() =>
                                                handleRemoveBlockedPeriod(period.id)
                                            }
                                        >
                                            <Trash2 size={16} />
                                            Remove
                                        </Button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </Card>

        </div>
    );
}
