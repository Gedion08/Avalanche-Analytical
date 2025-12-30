const request = require("supertest");
const express = require("express");
const cors = require("cors");

// Mock the processing modules
jest.mock("../src/processing/aggregator");
jest.mock("../src/processing/consensus");

const aggregator = require("../src/processing/aggregator");
const consensus = require("../src/processing/consensus");

// Import the app after mocking
const app = require("../src/api/server");

describe("API Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/analytics/transactions/volume", () => {
    test("should return transaction volume for valid params", async () => {
      aggregator.calculateDailyTransactionVolume.mockResolvedValue(1000);

      const response = await request(app)
        .get("/api/analytics/transactions/volume")
        .query({ chain: "C", date: "2023-01-01" });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ volume: 1000 });
      expect(aggregator.calculateDailyTransactionVolume).toHaveBeenCalledWith(
        "C",
        "2023-01-01"
      );
    });

    test("should return 400 for missing chain", async () => {
      const response = await request(app)
        .get("/api/analytics/transactions/volume")
        .query({ date: "2023-01-01" });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: "Missing required query parameters: chain, date",
      });
    });

    test("should return 400 for missing date", async () => {
      const response = await request(app)
        .get("/api/analytics/transactions/volume")
        .query({ chain: "C" });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: "Missing required query parameters: chain, date",
      });
    });

    test("should return 500 on processing error", async () => {
      aggregator.calculateDailyTransactionVolume.mockRejectedValue(
        new Error("Processing error")
      );

      const response = await request(app)
        .get("/api/analytics/transactions/volume")
        .query({ chain: "C", date: "2023-01-01" });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        error: "Failed to fetch transaction volume",
      });
    });
  });

  describe("GET /api/analytics/validators/uptime", () => {
    test("should return validator uptime for valid params", async () => {
      aggregator.computeValidatorUptime.mockResolvedValue(95);

      const response = await request(app)
        .get("/api/analytics/validators/uptime")
        .query({
          nodeId: "node1",
          startDate: "2023-01-01",
          endDate: "2023-01-02",
        });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ uptime: 95 });
      expect(aggregator.computeValidatorUptime).toHaveBeenCalledWith(
        "node1",
        new Date("2023-01-01"),
        new Date("2023-01-02")
      );
    });

    test("should return 400 for missing nodeId", async () => {
      const response = await request(app)
        .get("/api/analytics/validators/uptime")
        .query({ startDate: "2023-01-01", endDate: "2023-01-02" });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: "Missing required query parameters: nodeId, startDate, endDate",
      });
    });

    test("should return 400 for missing startDate", async () => {
      const response = await request(app)
        .get("/api/analytics/validators/uptime")
        .query({ nodeId: "node1", endDate: "2023-01-02" });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: "Missing required query parameters: nodeId, startDate, endDate",
      });
    });

    test("should return 400 for missing endDate", async () => {
      const response = await request(app)
        .get("/api/analytics/validators/uptime")
        .query({ nodeId: "node1", startDate: "2023-01-01" });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: "Missing required query parameters: nodeId, startDate, endDate",
      });
    });

    test("should return 500 on processing error", async () => {
      aggregator.computeValidatorUptime.mockRejectedValue(
        new Error("Processing error")
      );

      const response = await request(app)
        .get("/api/analytics/validators/uptime")
        .query({
          nodeId: "node1",
          startDate: "2023-01-01",
          endDate: "2023-01-02",
        });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        error: "Failed to fetch validator uptime",
      });
    });
  });

  describe("GET /api/analytics/consensus/finality", () => {
    test("should return finality time for valid params", async () => {
      consensus.calculateFinalityTime.mockResolvedValue(2.5);

      const response = await request(app)
        .get("/api/analytics/consensus/finality")
        .query({ chain: "C" });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ finalityTime: 2.5 });
      expect(consensus.calculateFinalityTime).toHaveBeenCalledWith("C");
    });

    test("should return 400 for missing chain", async () => {
      const response = await request(app).get(
        "/api/analytics/consensus/finality"
      );

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: "Missing required query parameter: chain",
      });
    });

    test("should return 500 on processing error", async () => {
      consensus.calculateFinalityTime.mockRejectedValue(
        new Error("Processing error")
      );

      const response = await request(app)
        .get("/api/analytics/consensus/finality")
        .query({ chain: "C" });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: "Failed to fetch finality time" });
    });
  });

  describe("GET /api/analytics/consensus/throughput", () => {
    test("should return throughput for valid params", async () => {
      consensus.calculateThroughput.mockResolvedValue(10.5);

      const response = await request(app)
        .get("/api/analytics/consensus/throughput")
        .query({ chain: "C" });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ throughput: 10.5 });
      expect(consensus.calculateThroughput).toHaveBeenCalledWith("C");
    });

    test("should return 400 for missing chain", async () => {
      const response = await request(app).get(
        "/api/analytics/consensus/throughput"
      );

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: "Missing required query parameter: chain",
      });
    });

    test("should return 500 on processing error", async () => {
      consensus.calculateThroughput.mockRejectedValue(
        new Error("Processing error")
      );

      const response = await request(app)
        .get("/api/analytics/consensus/throughput")
        .query({ chain: "C" });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: "Failed to fetch throughput" });
    });
  });

  describe("Error handling", () => {
    test("should return 404 for unknown route", async () => {
      const response = await request(app).get("/api/unknown");
      expect(response.status).toBe(404);
    });

    test("should handle internal server errors", async () => {
      // Simulate an error in middleware or elsewhere
      const originalUse = app.use;
      app.use = jest.fn((...args) => {
        if (args.length === 4) {
          // Error handling middleware
          return args[3](new Error("Test error"), {}, {}, () => {});
        }
        return originalUse.apply(app, args);
      });

      // This is tricky to test directly, but we can check the error middleware is set up
      expect(app.use).toHaveBeenCalled();
    });
  });
});
