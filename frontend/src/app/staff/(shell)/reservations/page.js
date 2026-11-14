"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Calendar as CalendarIcon, List as ListIcon, Plus, CalendarDays } from "lucide-react";
import { api } from "@/lib/api";
import {
  INITIAL_RESERVATIONS,
  INITIAL_GUESTS,
  PACKAGES,
  INITIAL_MAINTENANCE,
} from "@/components/staff/reservations/data";
import { CalendarView } from "@/components/staff/reservations/CalendarView";
import { ListView } from "@/components/staff/reservations/ListView";
import { NewReservationDrawer } from "@/components/staff/reservations/NewReservationDrawer";
import { ReservationDetailModal } from "@/components/staff/reservations/ReservationDetailModal";

export default function ReservationsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted">Loading reservations...</div>}>
      <ReservationsContent />
    </Suspense>
  );
}

function ReservationsContent() {
  const searchParams = useSearchParams();

  // Initial state derived from searchParams directly
  const viewParam = searchParams.get("view");
  const [view, setView] = useState(viewParam === "list" ? "list" : "calendar");

  const initialDrawer = searchParams.get("new") === "1" || searchParams.get("drawer") === "open";
  const [isDrawerOpen, setIsDrawerOpen] = useState(initialDrawer);

  const [currentDate, setCurrentDate] = useState(new Date(2026, 9, 3)); // Oct 3, 2026 as in mockup
  const [reservations, setReservations] = useState(INITIAL_RESERVATIONS);
  const [guests, setGuests] = useState(INITIAL_GUESTS);
  const [packages, setPackages] = useState(PACKAGES);
  const [maintenance, setMaintenance] = useState(INITIAL_MAINTENANCE);

  // New reservation drawer state
  const [draftDates, setDraftDates] = useState({
    checkIn: "2026-10-23",
    checkOut: "2026-10-26",
  });

  // Selected reservation for view details modal
  const [selectedReservation, setSelectedReservation] = useState(null);

  // Attempt to fetch from backend API if available, fallback gracefully
// Fetch backend data only when using a real staff login.
// Demo mode uses the local sample data.
useEffect(() => {
  const token = localStorage.getItem("rfh_token");

  if (!token || token === "demo_staff_token") {
    return;
  }

  api("/packages")
    .then((res) => {
      if (res?.data && res.data.length > 0) {
        setPackages(res.data);
      }
    })
    .catch(() => {
      // Keep local default packages
    });

  api("/reservations")
    .then((res) => {
      if (res?.data && res.data.length > 0) {
        setReservations(res.data);
      }
    })
    .catch(() => {
      // Keep local default reservations
    });
}, []);

  // Handlers
  function handleNavigateMonth(direction) {
    setCurrentDate((prev) => {
      const next = new Date(prev);
      next.setMonth(next.getMonth() + direction);
      return next;
    });
  }

  function handleToday() {
    setCurrentDate(new Date(2026, 9, 3)); // Match reference today
  }

  function handleSelectCalendarDate(dateStr) {
    // When clicking a day on calendar, adjust draft dates & open drawer
    if (!draftDates.checkIn || (draftDates.checkIn && draftDates.checkOut)) {
      setDraftDates({ checkIn: dateStr, checkOut: "" });
    } else {
      if (dateStr > draftDates.checkIn) {
        setDraftDates((prev) => ({ ...prev, checkOut: dateStr }));
        setIsDrawerOpen(true);
      } else {
        setDraftDates({ checkIn: dateStr, checkOut: "" });
      }
    }
  }

  function handleSaveReservation(newRes) {
    setReservations((prev) => [newRes, ...prev]);
    setIsDrawerOpen(false);
  }

  function handleAddNewGuest(newGuest) {
    setGuests((prev) => [...prev, newGuest]);
  }

  function handleUpdateStatus(id, newStatus) {
    setReservations((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r))
    );
  }

  const activeMonthStr = currentDate.toLocaleString("default", { month: "long", year: "numeric" });
  const reservationsInMonth = reservations.filter(
    (r) => r.checkInDate.startsWith("2026-10") || r.checkOutDate.startsWith("2026-10")
  );

  return (
    <div className="relative -m-8 flex min-h-[calc(100vh-5rem)]">
      {/* Main Content Area */}
      <div className="flex-1 p-8 transition-all">
        {/* Top Title & Subtitle */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
              Reservations
            </h1>
            <p className="mt-1 text-sm text-muted">
              One private cabana. Every stay, in one place.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsDrawerOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-ink shadow-sm transition hover:bg-accent-dark"
            >
              <Plus size={18} /> New reservation
            </button>
          </div>
        </div>

        {/* Metrics Summary & View Toggle Bar */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
          {/* Summary Badges */}
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <span className="font-bold text-ink">{activeMonthStr}</span>
            <span className="rounded-full bg-surface px-3 py-1 text-xs font-semibold text-muted">
              {reservationsInMonth.length} reservations
            </span>
            <span className="rounded-full bg-surface px-3 py-1 text-xs font-semibold text-muted">
              {maintenance.length} maintenance block
            </span>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted">
              <CalendarDays size={15} className="text-brand" />
              <span>Today · 3 Oct 2026</span>
            </div>
          </div>

          {/* Calendar / List View Switcher Toggle */}
          <div className="flex items-center rounded-xl border border-line bg-surface p-1">
            <button
              type="button"
              onClick={() => setView("calendar")}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
                view === "calendar"
                  ? "border border-brand/20 bg-white text-brand shadow-xs"
                  : "text-muted hover:text-ink"
              }`}
            >
              <CalendarIcon size={14} />
              <span>Calendar</span>
            </button>
            <button
              type="button"
              onClick={() => setView("list")}
              className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
                view === "list"
                  ? "border border-brand/20 bg-white text-brand shadow-xs"
                  : "text-muted hover:text-ink"
              }`}
            >
              <ListIcon size={14} />
              <span>List</span>
            </button>
          </div>
        </div>

        {/* Main View Display */}
        <div className="mt-6">
          {view === "calendar" ? (
            <CalendarView
              currentDate={currentDate}
              onNavigateMonth={handleNavigateMonth}
              onToday={handleToday}
              reservations={reservations}
              maintenance={maintenance}
              draftDates={draftDates}
              onSelectDate={handleSelectCalendarDate}
              onSelectReservation={(res) => setSelectedReservation(res)}
            />
          ) : (
            <ListView
              reservations={reservations}
              maintenance={maintenance}
              onSwitchToCalendar={() => setView("calendar")}
              onUpdateStatus={handleUpdateStatus}
              onSelectReservation={(res) => setSelectedReservation(res)}
            />
          )}
        </div>
      </div>

      {/* New Reservation Right Panel / Drawer */}
      <NewReservationDrawer
        key={`${draftDates.checkIn}-${draftDates.checkOut}`}
        open={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        packages={packages}
        guests={guests}
        reservations={reservations}
        maintenance={maintenance}
        initialDates={draftDates}
        onSaveReservation={handleSaveReservation}
        onAddNewGuest={handleAddNewGuest}
      />

      {/* Reservation Details Modal */}
      {selectedReservation && (
        <ReservationDetailModal
          reservation={selectedReservation}
          onClose={() => setSelectedReservation(null)}
          onUpdateStatus={handleUpdateStatus}
        />
      )}
    </div>
  );
}
