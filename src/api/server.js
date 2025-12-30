const express = require("express");
const cors = require("cors");
const http = require("http");
const socketIo = require("socket.io");
const cron = require("node-cron");
const analyticsRoutes = require("./routes/analytics");
const authRoutes = require("./routes/auth");
const { archiveData } = require("../processing/archiver");

require("dotenv").config();
const logger = require("../utils/logger");
const {
  register,
  httpRequestCounter,
  httpRequestDuration,
  errorCounter,
} = require("../utils/metrics");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
// Metrics middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestCounter.inc({
      method: req.method,
      route: req.route?.path || req.path,
      status_code: res.statusCode,
    });
    httpRequestDuration.observe(
      { method: req.method, route: req.route?.path || req.path },
      duration
    );
  });
  next();
});

// Logging middleware
app.use((req, res, next) => {
  logger.info(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/analytics", analyticsRoutes);
// Metrics endpoint
app.get("/metrics", async (req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

// Socket.IO connection
io.on("connection", (socket) => {
  logger.info("A user connected");
  socket.on("disconnect", () => {
    logger.info("User disconnected");
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error("Error:", err);
  errorCounter.inc({ type: "http" });
  res.status(500).json({ error: "Internal Server Error" });
});

// Start server
server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

// Schedule daily archiving at midnight
cron.schedule("0 0 * * *", async () => {
  try {
    logger.info("Starting scheduled archiving...");
    await archiveData();
  } catch (error) {
    logger.error("Scheduled archiving failed:", error);
  }
});

module.exports = { app, io };
