
const express = require("express");
const { z } = require("zod");
const prisma = require("../db");
const HttpError = require("../utils/httpError");
const asyncHandler = require("../utils/asyncHandler");
const parseId = require("../utils/parseId");
const validate = require("../middleware/validate");
const { authenticate, requireAdmin } = require("../middleware/auth");
const chargePostingService = require("../services/chargePostingService");

const router = express.Router();

const staff = authenticate;
const admin = [authenticate, requireAdmin];

// Validation schemas
const barItemSchema = z.object({
  name: z.string().trim().min(2).max(150),
  unitPrice: z.number().positive(),
  isActive: z.boolean().optional(),
});

const updateBarItemSchema = barItemSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field is required" }
);

const barOrderSchema = z.object({
  reservationId: z.number().int().positive(),
  barItemId: z.number().int().positive(),
  quantity: z.number().int().min(1),
  idempotencyKey: z.string().trim().max(100).optional(),
});

// Handle Prisma errors
function handlePrismaError(error) {
  if (error.code === "P2002") {
    throw new HttpError(
      409,
      "A record with this value already exists",
      "DUPLICATE_RECORD"
    );
  }

  if (error.code === "P2025") {
    throw new HttpError(404, "Record not found", "NOT_FOUND");
  }

  throw error;
}

// GET /bar-items - View bar items
router.get(
  "/bar-items",
  staff,
  asyncHandler(async (req, res) => {
    const where = {};

    if (req.query.active !== undefined) {
      if (!["true", "false"].includes(req.query.active)) {
        throw new HttpError(
          400,
          "Invalid active filter",
          "VALIDATION_ERROR"
        );
      }

      where.isActive = req.query.active === "true";
    }

    const items = await prisma.barItem.findMany({
      where,
      orderBy: { name: "asc" },
    });

    res.json({ data: items });
  })
);

// POST /bar-items - Create a bar item (Admin only)
router.post(
  "/bar-items",
  admin,
  validate(barItemSchema),
  asyncHandler(async (req, res) => {
    try {
      const item = await prisma.barItem.create({
        data: req.body,
      });

      res.status(201).json({ data: item });
    } catch (error) {
      handlePrismaError(error);
    }
  })
);

// PATCH /bar-items/:id - Update a bar item (Admin only)
router.patch(
  "/bar-items/:id",
  admin,
  validate(updateBarItemSchema),
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);

    try {
      const item = await prisma.barItem.update({
        where: { id },
        data: req.body,
      });

      res.json({ data: item });
    } catch (error) {
      handlePrismaError(error);
    }
  })
);

// GET /bar-orders - View bar order history
router.get(
  "/bar-orders",
  staff,
  asyncHandler(async (req, res) => {
    const where = {};

    if (req.query.reservationId !== undefined) {
      where.reservationId = parseId(req.query.reservationId);
    }

    const orders = await prisma.barOrder.findMany({
      where,
      include: {
        barItem: true,
        reservation: true,
        recordedBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json({ data: orders });
  })
);

// POST /bar-orders - Record a bar order
router.post(
  "/bar-orders",
  staff,
  validate(barOrderSchema),
  asyncHandler(async (req, res) => {
    const result = await chargePostingService.postBarCharge({
      reservationId: req.body.reservationId,
      barItemId: req.body.barItemId,
      quantity: req.body.quantity,
      idempotencyKey: req.body.idempotencyKey,
      userId: req.user.id,
    });

    res.status(result.deduplicated ? 200 : 201).json(result);
  })
);

module.exports = router;
