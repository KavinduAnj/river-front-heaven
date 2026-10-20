const prisma = require("../db");
const HttpError = require("../utils/httpError");
const { verifyPassword } = require("./passwords");
const { signStaffToken } = require("./tokens");
const { publicUser } = require("./userView");

async function staffLogin(usernameInput, password) {
    const username = usernameInput.trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { username } });

    // Same message for a wrong username and a wrong password
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
        throw new HttpError(401, "Wrong username or password", "INVALID_CREDENTIALS");
    }

    if (!user.isActive) {
        throw new HttpError(403, "This account is deactivated", "ACCOUNT_DEACTIVATED");
    }

    return { token: signStaffToken(user), user: publicUser(user) };
}

module.exports = { staffLogin };