const express = require("express");
const { authenticateGuest } = require("../middleware/auth");

const router = express.Router();
router.use(authenticateGuest); // every route here is for a checked-in guest, and only about their own stay

// GET /api/guest/stay: what the guest may see about their own booking
router.get("/stay", (req, res) => {
    const { reference, checkInDate, checkOutDate, adults, children, package: pkg, mustChangePassword } = req.reservation;
    res.json({ reference, checkInDate, checkOutDate, adults, children, package: pkg.name, mustChangePassword });
});

module.exports = router;