const express = require("express");
const { z } = require("zod");
const prisma = require("../db");
const HttpError = require("../utils/httpError");
const asyncHandler = require("../utils/asyncHandler");
const parseId = require("../utils/parseId");
const validate = require("../middleware/validate");
const { authenticate } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate); // every route here is for logged-in staff

const guestFields = {
    idNumber: z.string().trim().toUpperCase().min(3).max(30), // NIC or passport number
    fullName: z.string().trim().min(2).max(100),
    address: z.string().trim().min(3).max(200),
    phone: z.string().trim().max(20).optional(),
    email: z.string().trim().email().optional(),
};
const createSchema = z.object(guestFields);
const updateSchema = z.object(guestFields).omit({ idNumber: true }).partial()
    .refine((v) => Object.keys(v).length > 0, "send at least one field to change");

// Register a guest. If the ID number is already known, update details with incoming data.
router.post("/", validate(createSchema), asyncHandler(async (req, res) => {
    const existing = await prisma.guest.findUnique({ where: { idNumber: req.body.idNumber } });
    if (existing) {
        const updated = await prisma.guest.update({
            where: { id: existing.id },
            data: req.body,
        });
        return res.json(updated);
    }
    res.status(201).json(await prisma.guest.create({ data: req.body }));
}));

// Search by name or ID number: /api/guests?search=nimal
router.get("/", asyncHandler(async (req, res) => {
    const search = String(req.query.search ?? "").trim();
    const has = { contains: search, mode: "insensitive" };
    const data = await prisma.guest.findMany({
        where: search ? { OR: [{ fullName: has }, { idNumber: has }] } : {},
        orderBy: { fullName: "asc" },
        take: 20,
    });
    res.json({ data });
}));

// One guest, with their stays
router.get("/:id", asyncHandler(async (req, res) => {
    const guest = await prisma.guest.findUnique({
        where: { id: parseId(req.params.id) },
        include: {
            reservations: {
                select: { id: true, reference: true, checkInDate: true, checkOutDate: true, status: true },
                orderBy: { checkInDate: "desc" },
            },
        },
    });
    if (!guest) throw new HttpError(404, "Guest not found", "NOT_FOUND");
    res.json(guest);
}));

router.patch("/:id", validate(updateSchema), asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    if (!(await prisma.guest.findUnique({ where: { id } }))) throw new HttpError(404, "Guest not found", "NOT_FOUND");
    res.json(await prisma.guest.update({ where: { id }, data: req.body }));
}));

module.exports = router;