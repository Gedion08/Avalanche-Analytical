const promClient = require("prom-client");

const register = new promClient.Registry();

// HTTP request counter
const httpRequestCounter = new promClient.Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code"],
  registers: [register],
});

// HTTP request duration histogram
const httpRequestDuration = new promClient.Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route"],
  registers: [register],
});

// DB query counter
const dbQueryCounter = new promClient.Counter({
  name: "db_queries_total",
  help: "Total number of DB queries",
  labelNames: ["operation"],
  registers: [register],
});

// DB query duration histogram
const dbQueryDuration = new promClient.Histogram({
  name: "db_query_duration_seconds",
  help: "Duration of DB queries in seconds",
  labelNames: ["operation"],
  registers: [register],
});

// Error counter
const errorCounter = new promClient.Counter({
  name: "errors_total",
  help: "Total number of errors",
  labelNames: ["type"],
  registers: [register],
});

module.exports = {
  register,
  httpRequestCounter,
  httpRequestDuration,
  dbQueryCounter,
  dbQueryDuration,
  errorCounter,
};
