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

// API routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api", require("./routes/cabana"));
app.use("/api/reservations", require("./routes/reservations"));
app.use("/api", require("./routes/activities"));
app.use("/api", require("./routes/blockedPeriods"));
app.use("/api/billing", require("./routes/billing"));

// 404 handler — keep this after all API routes
app.use((_req, res) => {
    res.status(404).json({ error: "Not found", code: "NOT_FOUND" });
});

// Error handler
app.use((err, _req, res, _next) => {
    if (err instanceof HttpError) {
        return res.status(err.status).json({
            error: err.message,
            code: err.code,
            ...err.extra
        });
    }

    if (err.type === "entity.parse.failed") {
        return res.status(400).json({
            error: "Invalid JSON",
            code: "INVALID_JSON"
        });
    }

    console.error(err);
    res.status(500).json({
        error: "Internal server error",
        code: "SERVER_ERROR"
    });
});

module.exports = app;