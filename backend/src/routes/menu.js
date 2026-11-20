
const express = require("express");
const { z } = require("zod");
const prisma = require("../db");
const HttpError = require("../utils/httpError");
const asyncHandler = require("../utils/asyncHandler");
const parseId = require("../utils/parseId");
const validate = require("../middleware/validate");
const { authenticate, requireAdmin } = require("../middleware/auth");

const router = express.Router();

const staff = authenticate;
const admin = [authenticate, requireAdmin];

// ---------------- VALIDATION SCHEMAS ----------------

const categorySchema = z.object({
  name: z.string().trim().min(2).max(100),
  sortOrder: z.number().int().min(0).optional(),
});

const updateCategorySchema = categorySchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field is required" }
);

const menuItemSchema = z.object({
  categoryId: z.number().int().positive(),
  name: z.string().trim().min(2).max(150),
  description: z.string().trim().max(500).nullable().optional(),
  price: z.number().positive(),
  options: z.any().optional(),
  photoUrl: z.string().trim().max(500).nullable().optional(),
  isAvailable: z.boolean().optional(),
});

const updateMenuItemSchema = menuItemSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field is required" }
);

// ---------------- ERROR HANDLING ----------------

function handlePrismaError(error) {
  if (error.code === "P2002") {
    throw new HttpError(409, "A record with this value already exists", "DUPLICATE_RECORD");
  }

  if (error.code === "P2025") {
    throw new HttpError(404, "Record not found", "NOT_FOUND");
  }

  throw error;
}

// ---------------- MENU CATEGORY ROUTES ----------------

// Get all menu categories
router.get(
  "/menu/categories",
  staff,
  asyncHandler(async (_req, res) => {
    const categories = await prisma.menuCategory.findMany({
      orderBy: { sortOrder: "asc" },
      include: {
        _count: {
          select: { items: true },
        },
      },
    });

    res.json({ data: categories });
  })
);

// Create menu category (Admin only)
router.post(
  "/menu/categories",
  admin,
  validate(categorySchema),
  asyncHandler(async (req, res) => {
    try {
      const category = await prisma.menuCategory.create({
        data: req.body,
      });

      res.status(201).json({ data: category });
    } catch (error) {
      handlePrismaError(error);
    }
  })
);

// Update menu category (Admin only)
router.patch(
  "/menu/categories/:id",
  admin,
  validate(updateCategorySchema),
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);

    try {
      const category = await prisma.menuCategory.update({
        where: { id },
        data: req.body,
      });

      res.json({ data: category });
    } catch (error) {
      handlePrismaError(error);
    }
  })
);

// ---------------- MENU ITEM ROUTES ----------------

// Get menu items with optional filters
router.get(
  "/menu/items",
  staff,
  asyncHandler(async (req, res) => {
    const where = {};

    if (req.query.categoryId !== undefined) {
      where.categoryId = parseId(req.query.categoryId);
    }

    if (req.query.available !== undefined) {
      if (!["true", "false"].includes(req.query.available)) {
        throw new HttpError(400, "Invalid available filter", "VALIDATION_ERROR");
      }

      where.isAvailable = req.query.available === "true";
    }

    const items = await prisma.menuItem.findMany({
      where,
      include: { category: true },
      orderBy: { name: "asc" },
    });

    res.json({ data: items });
  })
);

// Create menu item (Admin only)
router.post(
  "/menu/items",
  admin,
  validate(menuItemSchema),
  asyncHandler(async (req, res) => {
    const category = await prisma.menuCategory.findUnique({
      where: { id: req.body.categoryId },
    });

    if (!category) {
      throw new HttpError(404, "Menu category not found", "CATEGORY_NOT_FOUND");
    }

    const item = await prisma.menuItem.create({
      data: req.body,
      include: { category: true },
    });

    res.status(201).json({ data: item });
  })
);

// Update menu item (Admin only)
router.patch(
  "/menu/items/:id",
  admin,
  validate(updateMenuItemSchema),
  asyncHandler(async (req, res) => {
    const id = parseId(req.params.id);

    if (req.body.categoryId !== undefined) {
      const category = await prisma.menuCategory.findUnique({
        where: { id: req.body.categoryId },
      });

      if (!category) {
        throw new HttpError(404, "Menu category not found", "CATEGORY_NOT_FOUND");
      }
    }

    try {
      const item = await prisma.menuItem.update({
        where: { id },
        data: req.body,
        include: { category: true },
      });

      res.json({ data: item });
    } catch (error) {
      handlePrismaError(error);
    }
  })
);

module.exports = router;
