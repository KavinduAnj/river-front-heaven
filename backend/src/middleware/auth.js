const prisma = require("../db");
const HttpError = require("../utils/httpError");
const asyncHandler = require("../utils/asyncHandler");
const { verifyToken } = require("../services/tokens");

const authenticate = asyncHandler(async (req, res, next) => {
    const authHeader = req.headers.authorization || (req.query.token ? `Bearer ${req.query.token}` : "");
    const [schema, token] = authHeader.split(" ");
    if (schema !== "Bearer" || !token) {
        throw new HttpError(401, "Please Login", "UNAUTHENTICATED");
    }
    let payload;
    try {
        payload = verifyToken(token);
    } catch {
        throw new HttpError(401, "Your session is invalid or has expired", "INVALID_TOKEN");
    }
    if (payload.type !== "staff") {
        throw new HttpError(401, "Your session is invalid", "INVALID_TOKEN");
    }
    const user = await prisma.user.findUnique({ where: { id: Number(payload.sub) } });
    if (!user || !user.isActive) {
        throw new HttpError(401, "This account is not active", "ACCOUNT_INACTIVE");
    }

    req.user = user;
    next();
})

const requireRole =
    (...roles) =>
        (req, _res, next) =>
            roles.includes(req.user?.role)
                ? next()
                : next(new HttpError(403, "You do not have permission to do this", "FORBIDDEN"));

const requireAdmin = requireRole("ADMIN");

// For guest routes: the token must be a guest token, and the guest must still be checked in
const authenticateGuest = asyncHandler(async (req, _res, next) => {
    const [scheme, token] = (req.headers.authorization || "").split(" ");
    if (scheme !== "Bearer" || !token) throw new HttpError(401, "Please log in", "UNAUTHENTICATED");

    let payload;
    try {
        payload = verifyToken(token);
    } catch {
        throw new HttpError(401, "Your session is invalid or has expired", "INVALID_TOKEN");
    }
    if (payload.type !== "guest") throw new HttpError(401, "Your session is invalid", "INVALID_TOKEN");

    const reservation = await prisma.reservation.findUnique({
        where: { id: payload.reservationId },
        include: { package: true },
        omit: { portalPasswordHash: true },
    });
    // Checked on every request, so a guest is locked out the moment they check out
    if (!reservation || !reservation.portalActive) throw new HttpError(401, "Your stay has ended", "STAY_ENDED");

    req.reservation = reservation;
    next();
});

module.exports = { authenticate, authenticateGuest, requireRole, requireAdmin };