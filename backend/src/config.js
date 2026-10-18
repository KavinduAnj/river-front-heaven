module.exports = {
    get jwtSecret() {
        return process.env.JWT_SECRET;
    },
    get jwtExpiresIn() {
        return process.env.JWT_EXPIRES_IN || "8h";
    },
    bcryptRounds: 10,
};