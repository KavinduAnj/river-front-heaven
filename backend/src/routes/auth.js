const express = require("express");
const { z } = require("zod");
const prisma = require("../db");
const HttpError = require("../utils/httpError");
const asyncHandler = require("../utils/asyncHandler");
const validate = require("../middleware/validate");
const { authenticate } = require("../middleware/auth");
const { staffLogin } = require("../services/authService");
const { hashPassword, verifyPassword } = require("../services/passwords");
const { publicUser } = require("../services/userView");


const router = express.Router();

const loginSchema = z.object({
    username: z.string().trim().min(1, "required"),
    password: z.string().min(1, "required"),
});

const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, "required"),
    newPassword: z.string().min(8, "must be at least 8 characters").max(72, "must be at most 72 characters"),
});

// POST /api/auth/staff/login
router.post(
    "/staff/login",
    validate(loginSchema),
    asyncHandler(async (req, res) => {
        res.json(await staffLogin(req.body.username, req.body.password));
    })
);
// GET /api/auth/me
router.get("/me", authenticate, (req, res) => {
    res.json({ user: publicUser(req.user) });
});

// POST /api/auth/change-password
router.post(
    "/change-password",
    authenticate,
    validate(changePasswordSchema),
    asyncHandler(async (req, res) => {
        const { currentPassword, newPassword } = req.body;

        if (!(await verifyPassword(currentPassword, req.user.passwordHash))) {
            throw new HttpError(400, "Current password is incorrect", "WRONG_CURRENT_PASSWORD");
        }
        if (currentPassword === newPassword) {
            throw new HttpError(400, "New password must be different", "SAME_PASSWORD");
        }

        await prisma.user.update({
            where: { id: req.user.id },
            data: { passwordHash: await hashPassword(newPassword), mustChangePassword: false },
        });
        res.json({ message: "Password changed" });
    })
);


module.exports = router;