const jwt = require("jsonwebtoken");
const config = require("../config");

function signStaffToken(user) {
    return jwt.sign({ sub: String(user.id), role: user.role, type: "staff" }, config.jwtSecret, {
        algorithm: "HS256",
        expiresIn: config.jwtExpiresIn,
    });
}

function verifyToken(token) {
    return jwt.verify(token, config.jwtSecret, { algorithms: ["HS256"] });
}

module.exports = { signStaffToken, verifyToken };