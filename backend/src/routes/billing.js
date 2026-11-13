const express = require("express");
const { z } = require("zod");
const asyncHandler = require("../utils/asyncHandler");
const parseId = require("../utils/parseId");
const validate = require("../middleware/validate");
const { authenticate: staff } = require("../middleware/auth");
const chargePostingService = require("../services/chargePostingService");

const router = express.Router();

// Validation Schemas
const unifiedChargeSchema = z.object({
  chargeType: z.enum(["ACTIVITY", "FOOD_BEVERAGE", "FNB", "BAR", "ADJUSTMENT", "PAYMENT"]),
  reservationId: z.number().int().positive().optional(),
  reservationReference: z.string().trim().min(1).optional(),
  guestId: z.number().int().positive().optional(),
  cabanaId: z.number().int().positive().optional(),
  idempotencyKey: z.string().trim().max(100).optional(),
  allowDuplicate: z.boolean().optional(),
  // Type-specific payloads
  activityId: z.number().int().positive().optional(),
  scheduledAt: z.string().optional(),
  participants: z.number().int().min(1).optional(),
  unitPriceAtBooking: z.number().positive().optional(),
  fnbOrderId: z.number().int().positive().optional(),
  items: z
    .array(
      z.object({
        menuItemId: z.number().int().positive(),
        quantity: z.number().int().min(1),
        unitPriceAtOrder: z.number().positive().optional(),
        customization: z.string().trim().max(255).optional(),
      })
    )
    .optional(),
  specialNotes: z.string().trim().max(500).optional(),
  placedByGuest: z.boolean().optional(),
  barItemId: z.number().int().positive().optional(),
  quantity: z.number().int().min(1).optional(),
  unitPriceAtOrder: z.number().positive().optional(),
  description: z.string().trim().min(2).max(255).optional(),
  amount: z.number().optional(),
  reason: z.string().trim().max(500).optional(),
  method: z.enum(["CASH", "CARD", "BANK_TRANSFER"]).optional(),
  isAdvance: z.boolean().optional(),
  note: z.string().trim().max(500).optional(),
});

const activityChargeSchema = z.object({
  activityId: z.number().int().positive(),
  scheduledAt: z.string().min(5),
  participants: z.number().int().min(1),
  unitPriceAtBooking: z.number().positive().optional(),
  status: z.enum(["BOOKED", "COMPLETED"]).optional(),
  idempotencyKey: z.string().trim().max(100).optional(),
});

const fnbChargeSchema = z.object({
  fnbOrderId: z.number().int().positive().optional(),
  items: z
    .array(
      z.object({
        menuItemId: z.number().int().positive(),
        quantity: z.number().int().min(1),
        unitPriceAtOrder: z.number().positive().optional(),
        customization: z.string().trim().max(255).optional(),
      })
    )
    .optional(),
  specialNotes: z.string().trim().max(500).optional(),
  placedByGuest: z.boolean().optional(),
  allowDuplicate: z.boolean().optional(),
  idempotencyKey: z.string().trim().max(100).optional(),
});

const barChargeSchema = z.object({
  barItemId: z.number().int().positive(),
  quantity: z.number().int().min(1),
  unitPriceAtOrder: z.number().positive().optional(),
  allowDuplicate: z.boolean().optional(),
  idempotencyKey: z.string().trim().max(100).optional(),
});

const adjustmentSchema = z.object({
  description: z.string().trim().min(2).max(255),
  amount: z.number().refine((val) => val !== 0, "Amount must not be zero"),
  reason: z.string().trim().max(500).optional(),
  allowDuplicate: z.boolean().optional(),
  idempotencyKey: z.string().trim().max(100).optional(),
});

const paymentSchema = z.object({
  amount: z.number().positive("Payment amount must be greater than 0"),
  method: z.enum(["CASH", "CARD", "BANK_TRANSFER"]),
  isAdvance: z.boolean().optional(),
  note: z.string().trim().max(500).optional(),
  idempotencyKey: z.string().trim().max(100).optional(),
});

const checkoutSchema = z.object({
  invoiceNumber: z.string().trim().max(50).optional(),
});

// ----------------- ROUTES -----------------

// List active stays with summary balances
router.get(
  "/active-stays",
  staff,
  asyncHandler(async (_req, res) => {
    const stays = await chargePostingService.listActiveStaysWithBalances();
    res.json({ data: stays });
  })
);

// Get guest bill by reservation ID
router.get(
  "/reservations/:id/bill",
  staff,
  asyncHandler(async (req, res) => {
    const bill = await chargePostingService.getGuestBill(parseId(req.params.id));
    res.json(bill);
  })
);

// Get guest bill by guest ID (resolves active reservation)
router.get(
  "/guests/:guestId/bill",
  staff,
  asyncHandler(async (req, res) => {
    const bill = await chargePostingService.getGuestBill({
      guestId: parseId(req.params.guestId),
    });
    res.json(bill);
  })
);

// Synchronize and audit all applicable charges for a reservation (automated posting & deduplication)
router.post(
  "/reservations/:id/sync",
  staff,
  asyncHandler(async (req, res) => {
    const result = await chargePostingService.syncGuestBill(parseId(req.params.id));
    res.json(result);
  })
);

// Unified charge posting route
router.post(
  "/charges",
  staff,
  validate(unifiedChargeSchema),
  asyncHandler(async (req, res) => {
    const result = await chargePostingService.postCharge({
      ...req.body,
      userId: req.user?.id,
    });
    res.status(result.deduplicated ? 200 : 201).json(result);
  })
);

// Post activity charge directly to a reservation
router.post(
  "/reservations/:id/charges/activity",
  staff,
  validate(activityChargeSchema),
  asyncHandler(async (req, res) => {
    const result = await chargePostingService.postActivityCharge({
      reservationId: parseId(req.params.id),
      ...req.body,
      userId: req.user?.id,
    });
    res.status(result.deduplicated ? 200 : 201).json(result);
  })
);

// Post F&B charge directly to a reservation
router.post(
  "/reservations/:id/charges/fnb",
  staff,
  validate(fnbChargeSchema),
  asyncHandler(async (req, res) => {
    const result = await chargePostingService.postFnbCharge({
      reservationId: parseId(req.params.id),
      ...req.body,
      userId: req.user?.id,
    });
    res.status(result.deduplicated ? 200 : 201).json(result);
  })
);

// Post Bar charge directly to a reservation
router.post(
  "/reservations/:id/charges/bar",
  staff,
  validate(barChargeSchema),
  asyncHandler(async (req, res) => {
    const result = await chargePostingService.postBarCharge({
      reservationId: parseId(req.params.id),
      ...req.body,
      userId: req.user?.id,
    });
    res.status(result.deduplicated ? 200 : 201).json(result);
  })
);

// Post bill adjustment (surcharge or discount)
router.post(
  "/reservations/:id/adjustments",
  staff,
  validate(adjustmentSchema),
  asyncHandler(async (req, res) => {
    const result = await chargePostingService.postAdjustmentCharge({
      reservationId: parseId(req.params.id),
      ...req.body,
      userId: req.user?.id,
    });
    res.status(result.deduplicated ? 200 : 201).json(result);
  })
);

// Post payment
router.post(
  "/reservations/:id/payments",
  staff,
  validate(paymentSchema),
  asyncHandler(async (req, res) => {
    const result = await chargePostingService.postPayment({
      reservationId: parseId(req.params.id),
      ...req.body,
      userId: req.user?.id,
    });
    res.status(result.deduplicated ? 200 : 201).json(result);
  })
);

// Finalize bill and check out (creates Invoice snapshot)
router.post(
  "/reservations/:id/checkout",
  staff,
  validate(checkoutSchema),
  asyncHandler(async (req, res) => {
    const result = await chargePostingService.finalizeBillAndCheckout(
      parseId(req.params.id),
      {
        userId: req.user?.id,
        invoiceNumber: req.body.invoiceNumber,
      }
    );
    res.status(201).json(result);
  })
);

module.exports = router;
