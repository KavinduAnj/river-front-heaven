const crypto = require("node:crypto");
const express = require("express");
const { z } = require("zod");
const prisma = require("../db");
const HttpError = require("../utils/httpError");
const asyncHandler = require("../utils/asyncHandler");
const parseId = require("../utils/parseId");
const validate = require("../middleware/validate");
const { authenticate: staff } = require("../middleware/auth"); // any logged-in staff member
const { hashPassword } = require("../services/passwords");

const router = express.Router();

const ACTIVE = ["PENDING", "CONFIRMED", "CHECKED_IN"]; // these statuses occupy the cabana
const show = { include: { guest: true, package: true }, omit: { portalPasswordHash: true } }; // never send the password hash

const date = z.string().date(); // "2026-11-10"
const bookingFields = {
  packageId: z.number().int().positive(),
  checkInDate: date,
  checkOutDate: date,
  adults: z.number().int().min(1),
  children: z.number().int().min(0).default(0),
  source: z.enum(["PHONE", "WALK_IN"]),
  notes: z.string().max(500).optional(),
};
const createSchema = z.object({ guestId: z.number().int().positive(), ...bookingFields });
const editSchema = z.object(bookingFields);

// THE overlap rule: a stay covers the nights from check-in up to (not including) check-out.
// Two stays clash when each starts before the other ends, so a guest may arrive the day another leaves.
const findClash = (from, to, excludeId) =>
  prisma.reservation.findFirst({
    where: { status: { in: ACTIVE }, checkInDate: { lt: to }, checkOutDate: { gt: from }, id: { not: excludeId } },
  });

// The checks for a new or edited booking
async function check(b, excludeId) {
  const pkg = await prisma.stayPackage.findUnique({ where: { id: b.packageId } });
  const cabana = await prisma.cabana.findFirst();
  if (!pkg?.isActive) throw new HttpError(400, "Choose an active package", "INVALID_PACKAGE");
  if (b.adults > pkg.maxAdults || b.children > pkg.maxChildren || b.adults + b.children > cabana.maxGuests) {
    throw new HttpError(400, `Too many guests for the ${pkg.name} package`, "GUEST_LIMIT_EXCEEDED");
  }
  if (b.checkOutDate <= b.checkInDate) throw new HttpError(400, "checkOutDate must be after checkInDate", "INVALID_DATES");

  const from = new Date(b.checkInDate);
  const to = new Date(b.checkOutDate);
  if (await findClash(from, to, excludeId)) {
    throw new HttpError(409, "The cabana is not available for these dates", "DATES_UNAVAILABLE");
  }
  return { pkg, cabana, from, to };
}

async function find(id) {
  const r = await prisma.reservation.findUnique({ where: { id }, ...show });
  if (!r) throw new HttpError(404, "Reservation not found", "NOT_FOUND");
  return r;
}

// Is the cabana free? (Must come before "/:id", or "availability" would be read as an id.)
const availabilityQuery = z.object({ from: date, to: date, excludeId: z.coerce.number().int().positive().optional() });
router.get("/availability", staff, validate(availabilityQuery, "query"), asyncHandler(async (req, res) => {
  const { from, to, excludeId } = req.query;
  if (to <= from) throw new HttpError(400, "to must be after from", "INVALID_DATES");
  const clash = await findClash(new Date(from), new Date(to), excludeId);
  res.json({ available: !clash, conflictReference: clash?.reference ?? null });
}));

// List, with optional filters. The calendar uses it too: ?from=2026-11-01&to=2026-12-01
const listQuery = z.object({
  status: z.enum(["PENDING", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "CANCELLED", "NO_SHOW"]).optional(),
  from: date.optional(),
  to: date.optional(),
});
router.get("/", staff, validate(listQuery, "query"), asyncHandler(async (req, res) => {
  const { status, from, to } = req.query;
  const data = await prisma.reservation.findMany({
    where: {
      ...(status && { status }),
      ...(from && { checkOutDate: { gt: new Date(from) } }), // stays that overlap from..to
      ...(to && { checkInDate: { lt: new Date(to) } }),
    },
    ...show,
    orderBy: { checkInDate: "desc" },
  });
  res.json({ data });
}));

router.post("/", staff, validate(createSchema), asyncHandler(async (req, res) => {
  const b = req.body;
  if (!(await prisma.guest.findUnique({ where: { id: b.guestId } }))) throw new HttpError(404, "Guest not found", "NOT_FOUND");
  if (b.checkInDate < new Date().toISOString().slice(0, 10)) throw new HttpError(400, "Check-in cannot be in the past", "INVALID_DATES");

  const { pkg, cabana, from, to } = await check(b);
  const reservation = await prisma.reservation.create({
    data: {
      reference: `RFH-${crypto.randomInt(100000, 1000000)}`,
      guestId: b.guestId,
      cabanaId: cabana.id,
      packageId: pkg.id,
      checkInDate: from,
      checkOutDate: to,
      adults: b.adults,
      children: b.children,
      nightlyRate: pkg.pricePerNight, // copied now, so later price changes do not alter this booking
      source: b.source,
      notes: b.notes,
      createdById: req.user.id,
    },
    ...show,
  });
  res.status(201).json(reservation);
}));

// Lookup by reference e.g. RFH-0261
router.get("/ref/:reference", staff, asyncHandler(async (req, res) => {
  const reference = String(req.params.reference || "").trim().toUpperCase();
  const r = await prisma.reservation.findUnique({
    where: { reference },
    ...show,
  });
  if (!r) throw new HttpError(404, "Reservation not found", "NOT_FOUND");
  res.json(r);
}));

router.get("/:id", staff, asyncHandler(async (req, res) => {
  res.json(await find(parseId(req.params.id)));
}));

// Associate or switch guest on a reservation
const linkGuestSchema = z.object({ guestId: z.number().int().positive() });
router.patch("/:id/guest", staff, validate(linkGuestSchema), asyncHandler(async (req, res) => {
  const r = await find(parseId(req.params.id));
  const guest = await prisma.guest.findUnique({ where: { id: req.body.guestId } });
  if (!guest) throw new HttpError(404, "Guest not found", "NOT_FOUND");
  const updated = await prisma.reservation.update({
    where: { id: r.id },
    data: { guestId: guest.id },
    ...show,
  });
  res.json(updated);
}));

// Edit: send the whole booking form again. It is checked exactly like a new booking.
router.put("/:id", staff, validate(editSchema), asyncHandler(async (req, res) => {
  const r = await find(parseId(req.params.id));
  if (!["PENDING", "CONFIRMED"].includes(r.status)) {
    throw new HttpError(409, "Only pending or confirmed reservations can be changed", "INVALID_STATUS");
  }
  const b = req.body;
  const { pkg, from, to } = await check(b, r.id);

  res.json(
    await prisma.reservation.update({
      where: { id: r.id },
      data: {
        packageId: pkg.id,
        checkInDate: from,
        checkOutDate: to,
        adults: b.adults,
        children: b.children,
        source: b.source,
        notes: b.notes,
        ...(pkg.id !== r.packageId && { nightlyRate: pkg.pricePerNight }), // a new package means a new price
      },
      ...show,
    })
  );
}));
// Confirm, cancel or mark a no-show. MOVES lists which current statuses may move to the new one.
const MOVES = { CONFIRMED: ["PENDING"], NO_SHOW: ["CONFIRMED"], CANCELLED: ["PENDING", "CONFIRMED"] };
const statusSchema = z.object({ status: z.enum(Object.keys(MOVES)), reason: z.string().trim().optional() });
router.patch("/:id/status", staff, validate(statusSchema), asyncHandler(async (req, res) => {
  const { status, reason } = req.body;
  const r = await find(parseId(req.params.id));
  if (!MOVES[status].includes(r.status)) throw new HttpError(409, `A ${r.status.toLowerCase()} reservation cannot become ${status.toLowerCase()}`, "INVALID_STATUS");
  if (status === "CANCELLED" && !reason) throw new HttpError(400, "A reason is required to cancel", "VALIDATION_ERROR");

  res.json(await prisma.reservation.update({ where: { id: r.id }, data: { status, cancelReason: reason }, ...show }));
}));

// ---------- Check-in and check-out ----------
// Check-in: staff choose the guest's portal password. It switches the guest portal on.
const passwordSchema = z.object({ portalPassword: z.string().min(6).max(72) });
router.post("/:id/check-in", staff, validate(passwordSchema), asyncHandler(async (req, res) => {
  const r = await find(parseId(req.params.id));
  if (!["PENDING", "CONFIRMED"].includes(r.status)) {
    throw new HttpError(409, "Only a pending or confirmed reservation can be checked in", "INVALID_STATUS");
  }
  if (await prisma.reservation.findFirst({ where: { status: "CHECKED_IN" } })) {
    throw new HttpError(409, "Another guest is still checked in", "CABANA_OCCUPIED");
  }

  const [reservation] = await prisma.$transaction([
    prisma.reservation.update({
      where: { id: r.id },
      data: {
        status: "CHECKED_IN",
        checkedInAt: new Date(),
        portalActive: true,
        mustChangePassword: true,
        portalPasswordHash: await hashPassword(req.body.portalPassword),
      },
      ...show,
    }),
    prisma.cabana.update({ where: { id: r.cabanaId }, data: { status: "OCCUPIED" } }),
  ]);
  // The QR code only contains this address, never any guest or stay data
  res.json({ ...reservation, loginUrl: `${process.env.FRONTEND_URL || "http://localhost:3000"}/guest/login` });
}));

// Check-out: closes the stay and switches the guest portal off
router.post("/:id/check-out", staff, asyncHandler(async (req, res) => {
  const r = await find(parseId(req.params.id));
  if (r.status !== "CHECKED_IN") throw new HttpError(409, "Only a checked-in guest can be checked out", "INVALID_STATUS");

  const [reservation] = await prisma.$transaction([
    prisma.reservation.update({
      where: { id: r.id },
      data: { status: "CHECKED_OUT", checkedOutAt: new Date(), portalActive: false },
      ...show,
    }),
    prisma.cabana.update({ where: { id: r.cabanaId }, data: { status: "AVAILABLE" } }),
  ]);
  res.json(reservation);
}));

// A guest forgot the password: staff set a new one (only while the guest is checked in)
router.post("/:id/portal-password", staff, validate(passwordSchema), asyncHandler(async (req, res) => {
  const r = await find(parseId(req.params.id));
  if (r.status !== "CHECKED_IN") throw new HttpError(409, "The guest is not checked in", "INVALID_STATUS");
  await prisma.reservation.update({
    where: { id: r.id },
    data: { portalPasswordHash: await hashPassword(req.body.portalPassword), mustChangePassword: true },
  });
  res.json({ message: "Password changed" });
}));

module.exports = router;