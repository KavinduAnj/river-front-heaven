
const express = require("express");
const { z } = require("zod");
const prisma = require("../db");
const HttpError = require("../utils/httpError");
const asyncHandler = require("../utils/asyncHandler");
const parseId = require("../utils/parseId");
const validate = require("../middleware/validate");
const { authenticate } = require("../middleware/auth");
const chargePostingService = require("../services/chargePostingService");

const router = express.Router();

const staff = authenticate;

const orderStatusSchema = z.enum([
  "PLACED",
  "PREPARING",
  "READY",
  "DELIVERED",
  "CANCELLED",
]);

const createOrderSchema = z.object({
  reservationId: z.number().int().positive(),
  items: z.array(
    z.object({
      menuItemId: z.number().int().positive(),
      quantity: z.number().int().min(1),
      customization: z.string().trim().max(255).optional(),
    })
  ).min(1),
  specialNotes: z.string().trim().max(500).optional(),
  idempotencyKey: z.string().trim().max(100).optional(),
});

const updateStatusSchema = z.object({
  status: orderStatusSchema,
});

// View F&B orders
router.get(
  "/fnb-orders",
  staff,
  asyncHandler(async (req, res) => {
    const where = {};

    if (req.query.status !== undefined) {
      const result = orderStatusSchema.safeParse(req.query.status);

      if (!result.success) {
        throw new HttpError(
          400,
          "Invalid order status",
          "VALIDATION_ERROR"
        );
      }

      where.status = result.data;
    }

    if (req.query.reservationId !== undefined) {
      where.reservationId = parseId(req.query.reservationId);
    }

    const orders = await prisma.fnbOrder.findMany({
      where,
      include: {
        items: {
          include: {
            menuItem: true,
          },
        },
        reservation: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    res.json({ data: orders });
  })
);

// Place a new F&B order
router.post(
  "/fnb-orders",
  staff,
  validate(createOrderSchema),
  asyncHandler(async (req, res) => {
    const result = await chargePostingService.postFnbCharge({
      reservationId: req.body.reservationId,
      items: req.body.items,
      specialNotes: req.body.specialNotes,
      idempotencyKey: req.body.idempotencyKey,
      placedByGuest: false,
      userId: req.user.id,
    });

    res.status(result.deduplicated ? 200 : 201).json(result);
  })
);

// Update an F&B order's status
router.patch(
  "/fnb-orders/:id/status",
  staff,
  validate(updateStatusSchema),
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);
    const newStatus = req.body.status;

    const order = await prisma.fnbOrder.findUnique({
      where: { id },
    });

    if (!order) {
      throw new HttpError(404, "F&B order not found", "NOT_FOUND");
    }

    const allowedTransitions = {
      PLACED: ["PREPARING", "CANCELLED"],
      PREPARING: ["READY", "CANCELLED"],
      READY: ["DELIVERED", "CANCELLED"],
      DELIVERED: [],
      CANCELLED: [],
    };

    if (!allowedTransitions[order.status].includes(newStatus)) {
      throw new HttpError(
        400,
        `Cannot change order status from ${order.status} to ${newStatus}`,
        "INVALID_STATUS_TRANSITION"
      );
    }

    const updatedOrder = await prisma.fnbOrder.update({
      where: { id },
      data: { status: newStatus },
      include: {
        items: {
          include: {
            menuItem: true,
          },
        },
        reservation: true,
      },
    });

    res.json({ data: updatedOrder });
  })
);

module.exports = router;
