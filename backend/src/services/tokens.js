const jwt = require("jsonwebtoken");
const config = require("../config");

function signStaffToken(user) {
    return jwt.sign({ sub: String(user.id), role: user.role, type: "staff" }, config.jwtSecret, {
        algorithm: "HS256",
        expiresIn: config.jwtExpiresIn,
    });
}

// A guest token says which stay it belongs to. It is also checked against the stay on every request.
function signGuestToken(reservation) {
    return jwt.sign({ type: "guest", reservationId: reservation.id }, config.jwtSecret, {
        algorithm: "HS256",
        expiresIn: "12h",
    });
}

function verifyToken(token) {
    return jwt.verify(token, config.jwtSecret, { algorithms: ["HS256"] });
}

module.exports = { signStaffToken, signGuestToken, verifyToken };