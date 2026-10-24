const express = require("express");
const { z } = require("zod");
const prisma = require("../db");
const HttpError = require("../utils/httpError");
const asyncHandler = require("../utils/asyncHandler");
const parseId = require("../utils/parseId");
const validate = require("../middleware/validate");
const { authenticate, requireAdmin } = require("../middleware/auth");

const router = express.Router();

// Who may call a route: any logged-in staff member, or Admin only
const staff = authenticate;
const admin = [authenticate, requireAdmin];

const text = z.string().trim().min(1);
const atLeastOne = (v) => Object.keys(v).length > 0;

const cabanaSchema = z
  .object({
    name: z.string().trim().min(2),
    description: z.string().trim(),
    maxGuests: z.number().int().min(1),
    facilities: z.array(text),
    photoUrls: z.array(z.string().url()), // photo links for now (no file upload)
  })
  .partial()
  .refine(atLeastOne, "send at least one field to change");

const packageFields = {
  name: z.string().trim().min(2).max(50),
  description: z.string().trim(),
  pricePerNight: z.number().positive(),
  maxAdults: z.number().int().min(1),
  maxChildren: z.number().int().min(0),
  inclusions: z.array(text),
  isActive: z.boolean(),
};
// New package: name, price and adult limit are required, the rest are optional
const createPackageSchema = z
  .object(packageFields)
  .partial({ description: true, maxChildren: true, inclusions: true, isActive: true });
const updatePackageSchema = z.object(packageFields).partial().refine(atLeastOne, "send at least one field to change");

// There is only one cabana
async function getCabana() {
  const cabana = await prisma.cabana.findFirst();
  if (!cabana) throw new HttpError(404, "Cabana is not set up yet", "NOT_FOUND");
  return cabana;
}

// Prisma returns money as text; the API sends numbers
const packageView = (p) => ({ ...p, pricePerNight: Number(p.pricePerNight) });

// Package names must be unique; turn the database error into a clear 409
const nameTaken = (err) =>
  err && err.code === "P2002" ? new HttpError(409, "A package with this name already exists", "PACKAGE_NAME_TAKEN") : err;

// ---------- Cabana ----------

router.get("/cabana", staff, asyncHandler(async (_req, res) => {
  res.json(await getCabana());
}));

router.patch("/cabana", admin, validate(cabanaSchema), asyncHandler(async (req, res) => {
  const cabana = await getCabana();
  res.json(await prisma.cabana.update({ where: { id: cabana.id }, data: req.body }));
}));

// ---------- Stay packages (Couple, Family, or any new ones) ----------

router.get("/packages", staff, asyncHandler(async (_req, res) => {
  const packages = await prisma.stayPackage.findMany({ orderBy: { id: "asc" } });
  res.json({ data: packages.map(packageView) });
}));

router.post("/packages", admin, validate(createPackageSchema), asyncHandler(async (req, res) => {
  try {
    res.status(201).json(packageView(await prisma.stayPackage.create({ data: req.body })));
  } catch (err) {
    throw nameTaken(err);
  }
}));

// Existing reservations keep the price they were booked at (nightlyRate is copied).
// Packages are switched off with isActive: false, never deleted.
router.patch("/packages/:id", admin, validate(updatePackageSchema), asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  if (!(await prisma.stayPackage.findUnique({ where: { id } }))) {
    throw new HttpError(404, "Package not found", "NOT_FOUND");
  }
  try {
    res.json(packageView(await prisma.stayPackage.update({ where: { id }, data: req.body })));
  } catch (err) {
    throw nameTaken(err);
  }
}));

module.exports = router;