
const express = require("express");
const { z } = require("zod");
const HttpError = require("../utils/httpError");
const asyncHandler = require("../utils/asyncHandler");
const parseId = require("../utils/parseId");
const validate = require("../middleware/validate");
const { authenticate, requireAdmin } = require("../middleware/auth");

const router = express.Router();

// Temporary in-memory activities
let activities = [
    {
        id: 1,
        name: "Sunrise river safari",
        category: "Safari",
        description: "Enjoy a peaceful sunrise river safari.",
        pricePerPerson: 5000,
        maxParticipants: 8,
        isActive: true,
    },
    {
        id: 2,
        name: "Udawalawe wildlife safari",
        category: "Safari",
        description: "Explore wildlife and natural surroundings.",
        pricePerPerson: 7500,
        maxParticipants: 6,
        isActive: true,
    },
    {
        id: 3,
        name: "Guided river kayaking",
        category: "Outdoor activity",
        description: "Experience guided kayaking along the river.",
        pricePerPerson: 3500,
        maxParticipants: 10,
        isActive: true,
    },
    {
        id: 4,
        name: "Village cycling trail",
        category: "Outdoor activity",
        description: "Discover the local village on a cycling trail.",
        pricePerPerson: 2500,
        maxParticipants: 8,
        isActive: true,
    },
    {
        id: 5,
        name: "River, safari & stay escape",
        category: "Package",
        description: "A combined river and safari experience.",
        pricePerPerson: 12000,
        maxParticipants: 4,
        isActive: true,
    },
];

let nextId = 6;

// Validation rules
const activityFields = {
    name: z.string().trim().min(2).max(100),
    category: z.enum(["Safari", "Outdoor activity", "Package"]),
    description: z.string().trim().min(1),
    pricePerPerson: z.number().positive(),
    maxParticipants: z.number().int().min(1),
    isActive: z.boolean(),
};

const createActivitySchema = z.object(activityFields);

const updateActivitySchema = z
    .object(activityFields)
    .partial()
    .refine((data) => Object.keys(data).length > 0,
        "Send at least one field to update");

// Any authenticated staff member can view activities
const staff = authenticate;

// Only admins can create or edit activities
const admin = [authenticate, requireAdmin];

// GET: View all activities
router.get("/activities", staff, asyncHandler(async (_req, res) => {
    res.json({ data: activities });
}));

// POST: Add a new activity
router.post("/activities", admin, validate(createActivitySchema),
    asyncHandler(async (req, res) => {
        const newActivity = {
            id: nextId++,
            ...req.body,
            isActive: req.body.isActive ?? true,
        };

        activities.push(newActivity);

        res.status(201).json(newActivity);
    })
);

// PATCH: Edit an existing activity
router.patch("/activities/:id", admin, validate(updateActivitySchema),
    asyncHandler(async (req, res) => {
        const id = parseId(req.params.id);

        const index = activities.findIndex((activity) => activity.id === id);

        if (index === -1) {
            throw new HttpError(404, "Activity not found", "NOT_FOUND");
        }

        activities[index] = {
            ...activities[index],
            ...req.body,
        };

        res.json(activities[index]);
    })
);

module.exports = router;
