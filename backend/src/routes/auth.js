const express = require("express");
const { z } = require("zod");
const asyncHandler = require("../utils/asyncHandler");
const validate = require("../middleware/validate");
const { staffLogin } = require("../services/authService");

const router = express.Router();

const loginSchema = z.object({
    username: z.string().trim().min(1, "required"),
    password: z.string().min(1, "required"),
});

// POST /api/auth/staff/login
router.post(
    "/staff/login",
    validate(loginSchema),
    asyncHandler(async (req, res) => {
        res.json(await staffLogin(req.body.username, req.body.password));
    })
);

module.exports = router;