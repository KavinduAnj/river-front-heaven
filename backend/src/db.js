let client;

function getClient() {
    if (!client) {
        const { PrismaClient } = require("@prisma/client");
        client = new PrismaClient();
    }
    return client;
}

module.exports = new Proxy(
    {},
    {
        get: (_target, prop) => getClient()[prop],
    }
);