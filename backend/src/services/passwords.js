const bcrypt = require("bcryptjs");
const config = require("../config");

const hashPassword = (plain) => bcrypt.hash(plain, config.bcryptRounds);
const verifyPassword = (plain, hash) => bcrypt.compare(plain, hash);

// Used when the username does not exist, so a wrong username takes as long as a wrong password.
let dummyHash;
async function burnPasswordCheck(plain) {
    if (!dummyHash) dummyHash = await bcrypt.hash("dummy-password", config.bcryptRounds);
    await bcrypt.compare(plain, dummyHash);
}

module.exports = { hashPassword, verifyPassword, burnPasswordCheck };