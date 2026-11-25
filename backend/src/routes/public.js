const express = require("express");
const { z } = require("zod");
const prisma = require("../db");
const HttpError = require("../utils/httpError");
const asyncHandler = require("../utils/asyncHandler");
const validate = require("../middleware/validate");
const { ACTIVE, findClash } = require("../services/availability");

// No login: anyone can read these. Never return guest or booking details here.
const router = express.Router();

const date = z.string().date(); // "2026-11-10"
const NOTICE = "Availability is indicative. Please call the hotel to confirm.";

const activePackages = () => prisma.stayPackage.findMany({ where: { isActive: true }, orderBy: { id: "asc" } });

router.get("/cabana", asyncHandler(async (_req, res) => {
    const cabana = await prisma.cabana.findFirst({
        select: { name: true, description: true, maxGuests: true, facilities: true, photoUrls: true },
    });
    if (!cabana) throw new HttpError(404, "Cabana is not set up yet", "NOT_FOUND");
    res.json(cabana);
}));

router.get("/packages", asyncHandler(async (_req, res) => {
    const packages = await activePackages();
    res.json({
        data: packages.map((p) => ({
            id: p.id,
            name: p.name,
            description: p.description,
            pricePerNight: Number(p.pricePerNight),
            maxAdults: p.maxAdults,
            maxChildren: p.maxChildren,
            inclusions: p.inclusions,
        })),
    });
}));

// Is the cabana free for these dates, and what would each package cost?
router.get("/availability", validate(z.object({ from: date, to: date }), "query"), asyncHandler(async (req, res) => {
    const { from, to } = req.query;
    if (to <= from) throw new HttpError(400, "to must be after from", "INVALID_DATES");
    if (from < new Date().toISOString().slice(0, 10)) throw new HttpError(400, "from cannot be in the past", "INVALID_DATES");

    const nights = Math.round((new Date(to) - new Date(from)) / 86400000);
    const available = !(await findClash(new Date(from), new Date(to)));
    const packages = available ? await activePackages() : [];

    res.json({
        available,
        nights,
        packages: packages.map((p) => ({
            id: p.id,
            name: p.name,
            pricePerNight: Number(p.pricePerNight),
            total: Math.round(Number(p.pricePerNight) * nights * 100) / 100,
        })),
        notice: NOTICE,
    });
}));

// The nights that are taken in one month, for the calendar. Only dates, never who booked.
router.get("/calendar", validate(z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "use YYYY-MM") }), "query"), asyncHandler(async (req, res) => {
    const { month } = req.query;
    const start = new Date(`${month}-01`);
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
    const stays = await prisma.reservation.findMany({
        where: { status: { in: ACTIVE }, checkInDate: { lt: end }, checkOutDate: { gt: start } },
        select: { checkInDate: true, checkOutDate: true },
    });

    // Turn each stay into the nights it occupies, keeping only the nights inside this month
    const bookedNights = [];
    for (const stay of stays) {
        for (let d = new Date(Math.max(stay.checkInDate, start)); d < stay.checkOutDate && d < end; d.setUTCDate(d.getUTCDate() + 1)) {
            bookedNights.push(d.toISOString().slice(0, 10));
        }
    }
    res.json({ month, bookedNights: bookedNights.sort() });
}));

router.get("/activities", asyncHandler(async (_req, res) => {
    const activities = await prisma.activity.findMany({ where: { isActive: true }, orderBy: { id: "asc" } });
    res.json({
        data: activities.map((a) => ({
            id: a.id,
            name: a.name,
            type: a.type,
            description: a.description,
            durationMinutes: a.durationMinutes,
            pricePerPerson: Number(a.unitPrice),
            maxParticipants: a.maxParticipants,
            photoUrls: a.photoUrls,
        })),
    });
}));

// Phone numbers and times, kept in the Setting table
router.get("/contact", asyncHandler(async (_req, res) => {
    const rows = await prisma.setting.findMany();
    const s = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    res.json({
        phone: s.hotel_phone ?? null,
        whatsapp: s.whatsapp_number ?? null,
        checkInTime: s.check_in_time ?? null,
        checkOutTime: s.check_out_time ?? null,
    });
}));

module.exports = router;