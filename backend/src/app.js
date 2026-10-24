const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const HttpError = require("./utils/httpError");

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:3000" }));
app.use(express.json());

app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", service: "river-front-heaven-api" });
});

// One router per module
app.use("/api/auth", require("./routes/auth"));
// Later: users, reservations, guests, orders, billing ...

app.use("/api", require("./routes/cabana")); // /api/cabana, /api/packages, /api/blocked-periods


app.use((_req, res) => {
    res.status(404).json({ error: "Not found", code: "NOT_FOUND" });
});

// Every error ends up here and becomes JSON
app.use((err, _req, res, _next) => {
    if (err instanceof HttpError) {
        return res.status(err.status).json({ error: err.message, code: err.code, ...err.extra });
    }
    if (err.type === "entity.parse.failed") {
        return res.status(400).json({ error: "Invalid JSON", code: "INVALID_JSON" });
    }
    console.error(err);
    res.status(500).json({ error: "Internal server error", code: "SERVER_ERROR" });
});

module.exports = app;