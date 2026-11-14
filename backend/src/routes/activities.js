
const express = require("express");
const { z } = require("zod");

const prisma = require("../db");
const HttpError = require("../utils/httpError");
const asyncHandler = require("../utils/asyncHandler");
const parseId = require("../utils/parseId");
const validate = require("../middleware/validate");
const { authenticate, requireAdmin } = require("../middleware/auth");

const router = express.Router();

// Convert the frontend category into the Prisma ActivityType enum.
const toPrismaType = (category) => {
    return category === "Safari" ? "SAFARI" : "OUTDOOR_ACTIVITY";
};

// Convert Prisma activity records into the format expected by the frontend.
const toActivityResponse = (activity) => ({
    id: activity.id,
    name: activity.name,
    category:
        activity.type === "SAFARI"
            ? "Safari"
            : "Outdoor activity",
    description: activity.description || "",
    pricePerPerson: Number(activity.unitPrice),
    maxParticipants: activity.maxParticipants,
    isActive: activity.isActive,
});

// Validation rules
const activityFields = {
    name: z.string().trim().min(2).max(100),
    category: z.enum(["Safari", "Outdoor activity"]),
    description: z.string().trim().min(1),
    pricePerPerson: z.number().positive(),
    maxParticipants: z.number().int().min(1),
    isActive: z.boolean(),
};

const createActivitySchema = z.object(activityFields);

const updateActivitySchema = z
    .object(activityFields)
    .partial()
    .refine(
        (data) => Object.keys(data).length > 0,
        "Send at least one field to update"
    );

// Any authenticated staff member can view activities.
const staff = authenticate;

// Only admins can create or edit activities.
const admin = [authenticate, requireAdmin];

// GET: View all activities
router.get(
    "/activities",
    staff,
    asyncHandler(async (_req, res) => {
        const activities = await prisma.activity.findMany({
            orderBy: {
                id: "asc",
            },
        });

        res.json({
            data: activities.map(toActivityResponse),
        });
    })
);

// POST: Add a new activity
router.post(
    "/activities",
    admin,
    validate(createActivitySchema),
    asyncHandler(async (req, res) => {
        const newActivity = await prisma.activity.create({
            data: {
                name: req.body.name,
                type: toPrismaType(req.body.category),
                description: req.body.description,
                unitPrice: req.body.pricePerPerson,
                maxParticipants: req.body.maxParticipants,
                isActive: req.body.isActive ?? true,
                photoUrls: [],
            },
        });

        res.status(201).json(toActivityResponse(newActivity));
    })
);

// PATCH: Edit an existing activity
router.patch(
    "/activities/:id",
    admin,
    validate(updateActivitySchema),
    asyncHandler(async (req, res) => {
        const id = parseId(req.params.id);

        const existingActivity = await prisma.activity.findUnique({
            where: { id },
        });

        if (!existingActivity) {
            throw new HttpError(
                404,
                "Activity not found",
                "NOT_FOUND"
            );
        }

        // Map frontend field names to Prisma field names.
        const updateData = {};

        if (req.body.name !== undefined) {
            updateData.name = req.body.name;
        }

        if (req.body.category !== undefined) {
            updateData.type = toPrismaType(req.body.category);
        }

        if (req.body.description !== undefined) {
            updateData.description = req.body.description;
        }

        if (req.body.pricePerPerson !== undefined) {
            updateData.unitPrice = req.body.pricePerPerson;
        }

        if (req.body.maxParticipants !== undefined) {
            updateData.maxParticipants = req.body.maxParticipants;
        }

        if (req.body.isActive !== undefined) {
            updateData.isActive = req.body.isActive;
        }

        const updatedActivity = await prisma.activity.update({
            where: { id },
            data: updateData,
        });

        res.json(toActivityResponse(updatedActivity));
    })
);

module.exports = router;
