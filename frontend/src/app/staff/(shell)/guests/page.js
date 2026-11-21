"use client";

import { useEffect, useState, useTransition, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Waves,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  Calendar,
  Key,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  Printer,
  Sparkles,
  Search,
  UserCheck,
  RefreshCw,
  Copy,
  Check,
} from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/staff/ui/Button";
import { Card } from "@/components/staff/ui/Card";
import { Badge } from "@/components/staff/ui/Badge";
import { Alert } from "@/components/staff/ui/Alert";
import { QRCode } from "@/components/staff/ui/QRCode";

export default function GuestsAndCheckInPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted">Loading check-in wizard...</div>}>
      <CheckInWizardContent />
    </Suspense>
  );
}

function CheckInWizardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const refParam = searchParams.get("ref");
  const idParam = searchParams.get("id");

  // Selection list state (when no reservation is active)
  const [arrivals, setArrivals] = useState([]);
  const [loadingArrivals, setLoadingArrivals] = useState(true);
  const [arrivalSearch, setArrivalSearch] = useState("");
  const [referenceInput, setReferenceInput] = useState("");

  // Active reservation context
  const [reservation, setReservation] = useState(null);
  const [loadingReservation, setLoadingReservation] = useState(false);
  const [fetchError, setFetchError] = useState("");

  // Wizard state: 1 = Register, 2 = Confirm Check-in, 3 = Guest Card
  const [step, setStep] = useState(1);

  // Step 1 Form state
  const [idType, setIdType] = useState("NIC"); // 'NIC' or 'Passport'
  const [idNumber, setIdNumber] = useState("");
  const [fullName, setFullName] = useState("");
  const [portalPassword, setPortalPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [formErrors, setFormErrors] = useState({});

  // Submission state
  const [isPending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState("");
  const [checkedInData, setCheckedInData] = useState(null);
  const [copied, setCopied] = useState(false);

  // Load upcoming / pending arrivals on mount
  useEffect(() => {
    fetchArrivals();
  }, []);

  async function fetchArrivals() {
    setLoadingArrivals(true);
    try {
      const res = await api("/reservations");
      // Filter for PENDING, CONFIRMED, or recently CHECKED_IN
      const list = res.data || [];
      setArrivals(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingArrivals(false);
    }
  }

  // Load reservation when ?ref or ?id is present
  useEffect(() => {
    async function loadInitial() {
      if (refParam) {
        setLoadingReservation(true);
        setFetchError("");
        try {
          const res = await api(`/reservations/ref/${encodeURIComponent(refParam.trim())}`);
          selectReservation(res);
        } catch (err) {
          setFetchError(err.message || "Reservation not found");
          setReservation(null);
        } finally {
          setLoadingReservation(false);
        }
      } else if (idParam) {
        setLoadingReservation(true);
        setFetchError("");
        try {
          const res = await api(`/reservations/${idParam}`);
          selectReservation(res);
        } catch (err) {
          setFetchError(err.message || "Reservation not found");
          setReservation(null);
        } finally {
          setLoadingReservation(false);
        }
      }
    }
    loadInitial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refParam, idParam]);

  async function loadReservationByRef(ref) {
    setLoadingReservation(true);
    setFetchError("");
    try {
      const res = await api(`/reservations/ref/${encodeURIComponent(ref.trim())}`);
      selectReservation(res);
    } catch (err) {
      setFetchError(err.message || "Reservation not found");
      setReservation(null);
    } finally {
      setLoadingReservation(false);
    }
  }

  async function loadReservationById(id) {
    setLoadingReservation(true);
    setFetchError("");
    try {
      const res = await api(`/reservations/${id}`);
      selectReservation(res);
    } catch (err) {
      setFetchError(err.message || "Reservation not found");
      setReservation(null);
    } finally {
      setLoadingReservation(false);
    }
  }

  function selectReservation(res) {
    setReservation(res);
    setStep(res.status === "CHECKED_IN" ? 3 : 1);
    setSubmitError("");
    setFormErrors({});

    // Pre-populate existing guest details if present
    if (res.guest) {
      setFullName(res.guest.fullName || "");
      setIdNumber(res.guest.idNumber || "");
      setAddress(res.guest.address || "");
      setPhone(res.guest.phone || "");
      setEmail(res.guest.email || "");
      // Guess ID type if NIC pattern
      if (res.guest.idNumber && /^[0-9]{9}[vVxX]$|^[0-9]{12}$/.test(res.guest.idNumber)) {
        setIdType("NIC");
      } else if (res.guest.idNumber) {
        setIdType("Passport");
      }
    } else {
      setFullName("");
      setIdNumber("");
      setAddress("");
      setPhone("");
      setEmail("");
    }

    // Generate a default friendly portal password if empty
    if (!portalPassword) {
      const randomDigits = Math.floor(1000 + Math.random() * 9000);
      setPortalPassword(`River#${randomDigits}`);
    }
  }

  function clearActiveReservation() {
    setReservation(null);
    setStep(1);
    setFetchError("");
    setSubmitError("");
    router.replace("/staff/guests");
  }

  // Generate a random secure password
  function handleGeneratePassword() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let pwd = "RFH-";
    for (let i = 0; i < 4; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPortalPassword(pwd);
  }

  // Validate Step 1
  function handleContinueToCheckIn(e) {
    e.preventDefault();
    const errors = {};
    if (!idNumber.trim()) errors.idNumber = "ID number is required";
    if (!fullName.trim()) errors.fullName = "Full name is required";
    if (!address.trim()) errors.address = "Address is required";
    if (!portalPassword.trim()) errors.portalPassword = "A portal password is required";
    else if (portalPassword.trim().length < 6) errors.portalPassword = "Password must be at least 6 characters";

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    setFormErrors({});
    setStep(2);
  }

  // Confirm Check-in action (Step 2 -> Step 3)
  function handleConfirmCheckIn() {
    setSubmitError("");
    startTransition(async () => {
      try {
        // 1. Create or update the Guest record
        const guestData = {
          idNumber: idNumber.trim().toUpperCase(),
          fullName: fullName.trim(),
          address: address.trim(),
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
        };
        const savedGuest = await api("/guests", {
          method: "POST",
          body: guestData,
        });

        // 2. Link the guest to this reservation if needed
        if (reservation.guestId !== savedGuest.id) {
          await api(`/reservations/${reservation.id}/guest`, {
            method: "PATCH",
            body: { guestId: savedGuest.id },
          });
        }

        // 3. Perform check-in (marks OCCUPIED, sets portalActive, hashes portalPassword)
        const checkInResult = await api(`/reservations/${reservation.id}/check-in`, {
          method: "POST",
          body: { portalPassword: portalPassword.trim() },
        });

        setCheckedInData({
          ...checkInResult,
          guest: savedGuest,
          plainPassword: portalPassword.trim(),
        });
        setStep(3);
        fetchArrivals(); // Refresh queue in background
      } catch (err) {
        setSubmitError(err.message || "Failed to complete check-in");
      }
    });
  }

  function handleCopyLogin() {
    const text = `River Front Heaven Guest Portal\nReference: ${reservation?.reference}\nPassword: ${portalPassword}\nLogin: ${window.location.origin}/guest/login`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const portalLoginUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/guest/login`
      : "http://localhost:3000/guest/login";

  // Filter arrivals list
  const filteredArrivals = arrivals.filter((a) => {
    const query = arrivalSearch.toLowerCase();
    return (
      a.reference?.toLowerCase().includes(query) ||
      a.guest?.fullName?.toLowerCase().includes(query) ||
      a.guest?.idNumber?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-medium text-muted">
            Staff portal &gt; <span className="text-ink font-semibold">Guests and check-in</span>
          </div>
          <h1 className="mt-1 text-3xl font-extrabold text-ink">Guest registration &amp; check-in</h1>
          <p className="mt-1 text-sm text-muted">
            Register the guest, confirm their arrival and prepare their login card.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {reservation ? (
            <Button variant="outline" onClick={clearActiveReservation} className="gap-2">
              <ArrowLeft size={16} /> Back to arrivals list
            </Button>
          ) : (
            <Link href="/staff/reservations">
              <Button variant="outline" className="gap-2">
                <Calendar size={16} /> View all reservations
              </Button>
            </Link>
          )}
        </div>
      </div>

      {fetchError && (
        <Alert variant="danger" title="Could not load reservation">
          {fetchError}
        </Alert>
      )}

      {/* NO RESERVATION SELECTED: Show Arrival Queue & Reference Lookup */}
      {!reservation && !loadingReservation && (
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="text-lg font-bold text-ink">Find reservation to check-in</h2>
            <p className="text-sm text-muted">
              Enter the reservation reference number or pick an upcoming guest arrival from the list below.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (referenceInput.trim()) loadReservationByRef(referenceInput);
              }}
              className="mt-4 flex flex-col gap-3 sm:flex-row"
            >
              <div className="relative flex-1">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  placeholder="Enter reference (e.g. RFH-0261 or RFH-1001)"
                  value={referenceInput}
                  onChange={(e) => setReferenceInput(e.target.value)}
                  className="h-12 w-full rounded-xl border border-line pl-11 pr-4 outline-none focus:ring-2 focus:ring-brand/30"
                />
              </div>
              <Button type="submit" variant="primary" disabled={!referenceInput.trim()}>
                Load reservation
              </Button>
            </form>
          </Card>

          <Card className="p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-ink">Upcoming arrivals &amp; recent check-ins</h2>
                <p className="text-sm text-muted">Select a party to open the guest registration wizard.</p>
              </div>
              <div className="relative w-full sm:w-72">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  placeholder="Search guest or ref..."
                  value={arrivalSearch}
                  onChange={(e) => setArrivalSearch(e.target.value)}
                  className="h-10 w-full rounded-xl border border-line pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-brand/30"
                />
              </div>
            </div>

            {loadingArrivals ? (
              <div className="py-12 text-center text-muted">Loading arrival list...</div>
            ) : filteredArrivals.length === 0 ? (
              <div className="py-12 text-center text-muted">
                No matching reservations found. Create a reservation first.
              </div>
            ) : (
              <div className="mt-4 divide-y divide-line overflow-hidden rounded-xl border border-line">
                {filteredArrivals.map((arr) => {
                  const isCheckedIn = arr.status === "CHECKED_IN";
                  const canCheckIn = ["PENDING", "CONFIRMED"].includes(arr.status);

                  return (
                    <div
                      key={arr.id}
                      className="flex flex-col justify-between gap-4 p-4 hover:bg-surface/60 sm:flex-row sm:items-center"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-ink">{arr.reference}</span>
                          <Badge
                            variant={
                              isCheckedIn
                                ? "success"
                                : arr.status === "CONFIRMED"
                                ? "info"
                                : "neutral"
                            }
                          >
                            {arr.status}
                          </Badge>
                          <span className="text-xs text-muted">
                            {arr.package?.name || "Standard package"}
                          </span>
                        </div>
                        <div className="text-sm text-ink">
                          <span className="font-semibold">
                            {arr.guest?.fullName || "Guest details pending"}
                          </span>
                          {arr.guest?.idNumber && (
                            <span className="text-muted ml-2">({arr.guest.idNumber})</span>
                          )}
                        </div>
                        <div className="text-xs text-muted">
                          Stay: {new Date(arr.checkInDate).toLocaleDateString()} &rarr;{" "}
                          {new Date(arr.checkOutDate).toLocaleDateString()} · {arr.adults} Adults
                          {arr.children > 0 ? `, ${arr.children} Children` : ""}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {canCheckIn ? (
                          <Button
                            variant="primary"
                            onClick={() => selectReservation(arr)}
                            className="gap-2 text-sm"
                          >
                            <UserCheck size={16} /> Check-in guest
                          </Button>
                        ) : isCheckedIn ? (
                          <Button
                            variant="outline"
                            onClick={() => selectReservation(arr)}
                            className="gap-2 text-sm"
                          >
                            <Printer size={16} /> View login card
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            onClick={() => selectReservation(arr)}
                            className="text-sm"
                          >
                            View details
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ACTIVE RESERVATION CHECK-IN WIZARD */}
      {reservation && (
        <div className="space-y-6">
          {/* Reservation Quick Summary Bar */}
          <Card className="p-5">
            <div className="grid grid-cols-2 gap-4 divide-y divide-line sm:grid-cols-4 sm:divide-x sm:divide-y-0">
              <div className="space-y-1 sm:pr-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Reservation reference
                </div>
                <div className="text-lg font-extrabold text-ink">{reservation.reference}</div>
              </div>

              <div className="space-y-1 pt-2 sm:px-4 sm:pt-0">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted">Package</div>
                <div className="text-base font-bold text-ink">
                  {reservation.package?.name || "Couple"} package
                </div>
              </div>

              <div className="space-y-1 pt-2 sm:px-4 sm:pt-0">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted">Check-in</div>
                <div className="text-base font-bold text-ink">
                  {new Date(reservation.checkInDate).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </div>
              </div>

              <div className="space-y-1 pt-2 sm:pl-4 sm:pt-0">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted">Check-out</div>
                <div className="text-base font-bold text-ink">
                  {new Date(reservation.checkOutDate).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </div>
              </div>
            </div>
          </Card>

          {/* Step Wizard Progress Bar */}
          <Card className="p-4">
            <div className="flex flex-col items-center justify-between gap-4 sm:flex-row sm:px-8">
              {/* Step 1 */}
              <div
                onClick={() => step > 1 && setStep(1)}
                className={`flex items-center gap-3 ${step > 1 ? "cursor-pointer" : ""}`}
              >
                <div
                  className={`grid size-9 place-items-center rounded-full font-bold text-sm ${
                    step === 1
                      ? "bg-brand text-white"
                      : step > 1
                      ? "bg-emerald-600 text-white"
                      : "border border-line text-muted"
                  }`}
                >
                  {step > 1 ? <Check size={16} /> : "1"}
                </div>
                <div>
                  <div className="text-sm font-bold text-ink">Guest registration</div>
                  <div className="text-xs text-muted">
                    {step === 1 ? "Current step" : "Completed"}
                  </div>
                </div>
              </div>

              <div className="hidden h-px flex-1 bg-line sm:block max-w-[80px]" />

              {/* Step 2 */}
              <div
                onClick={() => step > 2 && setStep(2)}
                className={`flex items-center gap-3 ${step > 2 ? "cursor-pointer" : ""}`}
              >
                <div
                  className={`grid size-9 place-items-center rounded-full font-bold text-sm ${
                    step === 2
                      ? "bg-brand text-white"
                      : step > 2
                      ? "bg-emerald-600 text-white"
                      : "border border-line text-muted"
                  }`}
                >
                  {step > 2 ? <Check size={16} /> : "2"}
                </div>
                <div>
                  <div className="text-sm font-bold text-ink">Confirm check-in</div>
                  <div className="text-xs text-muted">
                    {step === 2 ? "Current step" : step > 2 ? "Completed" : "Up next"}
                  </div>
                </div>
              </div>

              <div className="hidden h-px flex-1 bg-line sm:block max-w-[80px]" />

              {/* Step 3 */}
              <div className="flex items-center gap-3">
                <div
                  className={`grid size-9 place-items-center rounded-full font-bold text-sm ${
                    step === 3
                      ? "bg-brand text-white"
                      : "border border-line text-muted"
                  }`}
                >
                  3
                </div>
                <div>
                  <div className="text-sm font-bold text-ink">Guest login card</div>
                  <div className="text-xs text-muted">
                    {step === 3 ? "Current step" : "Up next"}
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {submitError && (
            <Alert variant="danger" title="Check-in failed">
              {submitError}
            </Alert>
          )}

          {/* STEP 1: GUEST REGISTRATION FORM (The exact Figma layout) */}
          {step === 1 && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Left Column: Register the Guest Form */}
              <Card className="p-8 lg:col-span-2">
                <h2 className="text-2xl font-extrabold text-ink">Register the guest</h2>
                <p className="mt-1 text-sm text-muted">
                  Enter the lead guest&apos;s details. Phone and email are optional.
                </p>

                <form onSubmit={handleContinueToCheckIn} className="mt-6 space-y-5">
                  {/* Row 1: ID Type & ID Number */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-ink">ID type</label>
                      <div className="flex h-12 rounded-xl border border-line bg-surface/50 p-1">
                        <button
                          type="button"
                          onClick={() => setIdType("NIC")}
                          className={`flex-1 rounded-lg text-sm font-bold transition-all ${
                            idType === "NIC"
                              ? "bg-white text-ink shadow-sm"
                              : "text-muted hover:text-ink"
                          }`}
                        >
                          NIC
                        </button>
                        <button
                          type="button"
                          onClick={() => setIdType("Passport")}
                          className={`flex-1 rounded-lg text-sm font-bold transition-all ${
                            idType === "Passport"
                              ? "bg-white text-ink shadow-sm"
                              : "text-muted hover:text-ink"
                          }`}
                        >
                          Passport
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-semibold text-ink">ID number</label>
                      <input
                        type="text"
                        placeholder="[NIC or passport number]"
                        value={idNumber}
                        onChange={(e) => setIdNumber(e.target.value.toUpperCase())}
                        className={`h-12 w-full rounded-xl border px-4 outline-none focus:ring-2 focus:ring-brand/30 ${
                          formErrors.idNumber ? "border-red-600" : "border-line"
                        }`}
                        required
                      />
                      {formErrors.idNumber && (
                        <p className="mt-1 text-xs text-red-600">{formErrors.idNumber}</p>
                      )}
                    </div>
                  </div>

                  {/* Row 2: Full Name & Portal Password */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-semibold text-ink">Full name</label>
                      <input
                        type="text"
                        placeholder="[Full name]"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className={`h-12 w-full rounded-xl border px-4 outline-none focus:ring-2 focus:ring-brand/30 ${
                          formErrors.fullName ? "border-red-600" : "border-line"
                        }`}
                        required
                      />
                      {formErrors.fullName && (
                        <p className="mt-1 text-xs text-red-600">{formErrors.fullName}</p>
                      )}
                    </div>

                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <label className="text-sm font-semibold text-ink">Portal password</label>
                        <button
                          type="button"
                          onClick={handleGeneratePassword}
                          className="flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
                        >
                          <Sparkles size={13} /> Auto-generate
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          placeholder="[Portal password]"
                          value={portalPassword}
                          onChange={(e) => setPortalPassword(e.target.value)}
                          className={`h-12 w-full rounded-xl border pl-4 pr-20 outline-none focus:ring-2 focus:ring-brand/30 ${
                            formErrors.portalPassword ? "border-red-600" : "border-line"
                          }`}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-ink"
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          <span>{showPassword ? "Hide" : "Show"}</span>
                        </button>
                      </div>
                      {formErrors.portalPassword && (
                        <p className="mt-1 text-xs text-red-600">{formErrors.portalPassword}</p>
                      )}
                    </div>
                  </div>

                  {/* Row 3: Address */}
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-ink">Address</label>
                    <textarea
                      placeholder="[Guest address]"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      rows={3}
                      className={`w-full rounded-xl border p-3 outline-none focus:ring-2 focus:ring-brand/30 ${
                        formErrors.address ? "border-red-600" : "border-line"
                      }`}
                      required
                    />
                    {formErrors.address && (
                      <p className="mt-1 text-xs text-red-600">{formErrors.address}</p>
                    )}
                  </div>

                  {/* Row 4: Phone & Email (Optional) */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <div className="mb-2 flex items-center gap-2">
                        <label className="text-sm font-semibold text-ink">Phone</label>
                        <span className="text-xs text-muted">Optional</span>
                      </div>
                      <input
                        type="tel"
                        placeholder="[Phone number]"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="h-12 w-full rounded-xl border border-line px-4 outline-none focus:ring-2 focus:ring-brand/30"
                      />
                    </div>

                    <div>
                      <div className="mb-2 flex items-center gap-2">
                        <label className="text-sm font-semibold text-ink">Email</label>
                        <span className="text-xs text-muted">Optional</span>
                      </div>
                      <input
                        type="email"
                        placeholder="[Email address]"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="h-12 w-full rounded-xl border border-line px-4 outline-none focus:ring-2 focus:ring-brand/30"
                      />
                    </div>
                  </div>

                  {/* Security Notice */}
                  <div className="flex items-center gap-2 pt-2 text-xs text-muted">
                    <Lock size={14} className="shrink-0 text-muted" />
                    <span>Guest details are used to manage this reservation and guest portal access.</span>
                  </div>

                  {/* Form Footer Buttons */}
                  <div className="flex items-center justify-between pt-4 border-t border-line">
                    <Button variant="outline" type="button" onClick={clearActiveReservation}>
                      Cancel
                    </Button>

                    <Button variant="primary" type="submit" className="gap-2">
                      Continue to check-in <ArrowRight size={16} />
                    </Button>
                  </div>
                </form>
              </Card>

              {/* Right Column Context Cards */}
              <div className="space-y-6">
                {/* Existing Reservation Card */}
                <Card className="p-6">
                  <div className="flex items-center gap-2 text-sm font-bold text-ink">
                    <Calendar size={18} className="text-brand" />
                    <span>Existing reservation</span>
                  </div>

                  <div className="mt-4 space-y-3">
                    <div>
                      <div className="text-xs text-muted">Reservation reference</div>
                      <div className="text-lg font-extrabold text-ink">{reservation.reference}</div>
                    </div>

                    <div>
                      <div className="text-xs text-muted">Number of guests</div>
                      <div className="font-semibold text-ink">
                        {reservation.adults + reservation.children} guests · Adults {reservation.adults} ·
                        Children {reservation.children}
                      </div>
                    </div>

                    <div className="border-t border-line pt-3 text-xs text-muted">
                      One private cabana · {reservation.package?.name || "Couple"} package
                    </div>
                  </div>
                </Card>

                {/* Guest Portal Access Info Card */}
                <div className="rounded-2xl border border-brand/20 bg-brand-soft/60 p-6 text-ink">
                  <div className="flex items-center gap-2 text-sm font-bold text-brand">
                    <Key size={18} />
                    <span>Guest portal access</span>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-muted">
                    The portal password will appear on the guest&apos;s login card after check-in. Use Hide to
                    conceal the password on this form.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: CONFIRM CHECK-IN */}
          {step === 2 && (
            <Card className="p-8 max-w-3xl mx-auto">
              <h2 className="text-2xl font-extrabold text-ink">Confirm guest arrival &amp; check-in</h2>
              <p className="mt-1 text-sm text-muted">
                Review verified details before marking the cabana occupied and activating guest portal credentials.
              </p>

              <div className="mt-6 divide-y divide-line rounded-xl border border-line bg-surface/30">
                <div className="p-4 flex justify-between items-center">
                  <span className="text-sm text-muted">Lead Guest</span>
                  <span className="font-bold text-ink">{fullName}</span>
                </div>
                <div className="p-4 flex justify-between items-center">
                  <span className="text-sm text-muted">{idType} Number</span>
                  <span className="font-mono font-semibold text-ink">{idNumber}</span>
                </div>
                <div className="p-4 flex justify-between items-center">
                  <span className="text-sm text-muted">Stay Package</span>
                  <span className="font-semibold text-ink">{reservation.package?.name} Package</span>
                </div>
                <div className="p-4 flex justify-between items-center">
                  <span className="text-sm text-muted">Room / Cabana</span>
                  <Badge variant="success">Available for occupancy</Badge>
                </div>
                <div className="p-4 flex justify-between items-center">
                  <span className="text-sm text-muted">Assigned Portal Password</span>
                  <span className="font-mono font-bold text-brand bg-white px-3 py-1 rounded-lg border border-line">
                    {portalPassword}
                  </span>
                </div>
              </div>

              <div className="mt-6 rounded-xl bg-amber-50 p-4 border border-amber-200 text-sm text-amber-900 flex items-start gap-3">
                <ShieldCheck size={20} className="shrink-0 text-amber-600 mt-0.5" />
                <div>
                  Confirming check-in will immediately switch on guest portal access for this stay, assign room keys,
                  and make the login card ready for printing.
                </div>
              </div>

              <div className="mt-8 flex items-center justify-between pt-4 border-t border-line">
                <Button variant="outline" onClick={() => setStep(1)} disabled={isPending}>
                  <ArrowLeft size={16} /> Back to edit details
                </Button>

                <Button
                  variant="primary"
                  onClick={handleConfirmCheckIn}
                  disabled={isPending}
                  className="gap-2"
                >
                  {isPending ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" /> Processing check-in...
                    </>
                  ) : (
                    <>
                      Confirm check-in &amp; generate card <ArrowRight size={16} />
                    </>
                  )}
                </Button>
              </div>
            </Card>
          )}

          {/* STEP 3: GUEST LOGIN CARD (Physical Printable Card with QR Code) */}
          {step === 3 && (
            <div className="space-y-6 max-w-3xl mx-auto">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-extrabold text-ink">Guest check-in complete!</h2>
                  <p className="text-sm text-muted">
                    Hand this card or print it for the guest so they can scan and order dining or activities.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button variant="outline" onClick={handleCopyLogin} className="gap-2">
                    {copied ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
                    <span>{copied ? "Copied" : "Copy details"}</span>
                  </Button>
                  <Button variant="primary" onClick={() => window.print()} className="gap-2">
                    <Printer size={16} /> Print login card
                  </Button>
                </div>
              </div>

              {/* The Physical Card View (Styled for Screen & Print) */}
              <div
                id="guest-login-card"
                className="relative overflow-hidden rounded-3xl border-2 border-brand/20 bg-white p-8 text-ink shadow-lg print:border-none print:shadow-none"
              >
                {/* Header Banner */}
                <div className="flex items-start justify-between border-b border-line pb-6">
                  <div className="flex items-center gap-3">
                    <span className="grid size-12 place-items-center rounded-2xl bg-brand text-white shadow-md">
                      <Waves size={24} />
                    </span>
                    <div>
                      <h3 className="text-xl font-black tracking-tight text-ink">River Front Heaven</h3>
                      <p className="text-xs font-medium text-muted">Hotel &amp; Safari Resort · Sri Lanka</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-brand">
                      Guest Access Card
                    </span>
                    <div className="mt-1 text-xs text-muted">
                      Check-out: 11:00 AM on{" "}
                      {new Date(reservation.checkOutDate).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </div>
                  </div>
                </div>

                {/* Main Card Body */}
                <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-3">
                  <div className="space-y-4 sm:col-span-2">
                    <div>
                      <div className="text-xs uppercase tracking-wider text-muted font-semibold">
                        Welcome Guest
                      </div>
                      <div className="text-2xl font-black text-ink">{fullName}</div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 rounded-2xl bg-surface/60 p-4 border border-line">
                      <div>
                        <div className="text-xs text-muted font-semibold">Reservation Ref</div>
                        <div className="text-lg font-mono font-extrabold text-brand">
                          {reservation.reference}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-muted font-semibold">Portal Password</div>
                        <div className="text-lg font-mono font-extrabold text-ink">
                          {portalPassword}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1 text-xs text-muted">
                      <p className="font-semibold text-ink">In-Room Guest Features:</p>
                      <p>&bull; Order Food &amp; Beverages directly to your cabana</p>
                      <p>&bull; Book river safaris &amp; outdoor experiences</p>
                      <p>&bull; View your running bill in real time</p>
                    </div>
                  </div>

                  {/* QR Code Section */}
                  <div className="flex flex-col items-center justify-center rounded-2xl bg-surface/50 p-4 text-center border border-line">
                    <QRCode value={portalLoginUrl} size={150} />
                    <p className="mt-2 text-xs font-bold text-ink">Scan with phone</p>
                    <p className="text-[11px] text-muted">{portalLoginUrl}</p>
                  </div>
                </div>

                {/* Card Footer */}
                <div className="mt-6 border-t border-line pt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xs text-muted">
                  <span>Front Desk Assistance · Dial &quot;0&quot; or ask staff</span>
                  <span className="font-medium text-brand">Enjoy your riverside stay!</span>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-line">
                <Button variant="outline" onClick={clearActiveReservation}>
                  Check in another guest
                </Button>
                <Link href="/staff/reservations">
                  <Button variant="primary">Return to reservations</Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
