require("dotenv").config();

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    console.error("JWT_SECRET must be set in .env and be at least 32 characters long.");
    process.exit(1);
}

const app = require("./app");

const port = process.env.PORT || 4000;

app.listen(port, () => {
    console.log(`API listening on http://localhost:${port}`);
});