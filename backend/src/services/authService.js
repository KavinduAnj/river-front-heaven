const prisma = require("../db");
const HttpError = require("../utils/httpError");
const { verifyPassword } = require("./passwords");
const { signStaffToken, signGuestToken } = require("./tokens");
const { publicUser } = require("./userView");

async function staffLogin(usernameInput, password) {
    const username = usernameInput.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
        throw new HttpError(401, "Wrong username or password", "INVALID_CREDENTIALS");
    }
    if (!user.isActive) throw new HttpError(403, "This account is deactivated", "ACCOUNT_DEACTIVATED");
    return { token: signStaffToken(user), user: publicUser(user) };
}

// A guest logs in with the reservation reference and the password staff set at check-in
async function guestLogin(referenceInput, password) {
    const r = await prisma.reservation.findUnique({ where: { reference: referenceInput.trim().toUpperCase() } });

    // Same message for an unknown reference, a guest not checked in yet, and a wrong password
    if (!r || !r.portalPasswordHash || !(await verifyPassword(password, r.portalPasswordHash))) {
        throw new HttpError(401, "Wrong reference or password", "INVALID_CREDENTIALS");
    }
    // Right password, but the stay is over
    if (!r.portalActive) {
        throw new HttpError(403, "Your stay is not active. Please contact reception.", "PORTAL_NOT_ACTIVE");
    }

    return {
        token: signGuestToken(r),
        stay: { reference: r.reference, checkInDate: r.checkInDate, checkOutDate: r.checkOutDate, mustChangePassword: r.mustChangePassword },
    };
}

module.exports = { staffLogin, guestLogin };