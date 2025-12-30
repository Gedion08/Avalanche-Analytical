const pg = require("pg");
const amqp = require("amqplib");

// Mock external dependencies
jest.mock("pg");
jest.mock("redis", () => ({
  createClient: jest.fn(() => ({
    setEx: jest.fn(),
    get: jest.fn(),
    on: jest.fn(),
  })),
}));
jest.mock("amqplib");
jest.mock("../src/models/analytics");

// Import mocked modules
const redis = require("redis");

// Import modules after mocking
const aggregator = require("../src/processing/aggregator");
const consensus = require("../src/processing/consensus");
const AnalyticsModel = require("../src/models/analytics");

describe("Processing Tests", () => {
  let mockPool;
  let mockRedisClient;
  let mockChannel;
  let mockConnection;

  beforeEach(() => {
    // Mock pg.Pool
    mockPool = {
      query: jest.fn(),
    };
    pg.Pool.mockImplementation(() => mockPool);

    // Get the mocked redis client
    mockRedisClient = redis.createClient();

    // Mock AMQP
    mockChannel = {
      assertQueue: jest.fn(),
      consume: jest.fn(),
      ack: jest.fn(),
      sendToQueue: jest.fn(),
    };
    mockConnection = {
      createChannel: jest.fn().mockResolvedValue(mockChannel),
    };
    amqp.connect.mockResolvedValue(mockConnection);

    // Mock AnalyticsModel
    AnalyticsModel.createAnalytics = jest.fn();

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe("Aggregator", () => {
    test("calculateDailyTransactionVolume should calculate and cache volume", async () => {
      const mockResult = { rows: [{ total_volume: 1000 }] };
      mockPool.query.mockResolvedValue(mockResult);
      mockRedisClient.setEx.mockResolvedValue("OK");
      AnalyticsModel.createAnalytics.mockResolvedValue();

      const volume = await aggregator.calculateDailyTransactionVolume(
        "C",
        "2023-01-01"
      );

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("SELECT SUM(amount)"),
        ["C", expect.any(Date), expect.any(Date)]
      );
      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        "tx_volume_C_2023-01-01",
        3600,
        "1000"
      );
      expect(AnalyticsModel.createAnalytics).toHaveBeenCalledWith({
        metric_type: "tx_volume",
        chain: "C",
        value: 1000,
        unit: "AVAX",
        period_start: expect.any(Date),
        period_end: expect.any(Date),
      });
      expect(volume).toBe(1000);
    });

    test("calculateDailyTransactionVolume should handle zero volume", async () => {
      const mockResult = { rows: [{ total_volume: null }] };
      mockPool.query.mockResolvedValue(mockResult);
      mockRedisClient.setEx.mockResolvedValue("OK");
      AnalyticsModel.createAnalytics.mockResolvedValue();

      const volume = await aggregator.calculateDailyTransactionVolume(
        "C",
        "2023-01-01"
      );

      expect(volume).toBe(0);
    });

    test("calculateDailyTransactionVolume should throw on error", async () => {
      mockPool.query.mockRejectedValue(new Error("DB error"));
      await expect(
        aggregator.calculateDailyTransactionVolume("C", "2023-01-01")
      ).rejects.toThrow("DB error");
    });

    test("computeValidatorUptime should calculate and cache uptime", async () => {
      const mockResult = { rows: [{ avg_uptime: 95 }] };
      mockPool.query.mockResolvedValue(mockResult);
      mockRedisClient.setEx.mockResolvedValue("OK");
      AnalyticsModel.createAnalytics.mockResolvedValue();

      const uptime = await aggregator.computeValidatorUptime(
        "node1",
        new Date("2023-01-01"),
        new Date("2023-01-02")
      );

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("SELECT AVG(uptime_percentage)"),
        ["node1", expect.any(Date), expect.any(Date)]
      );
      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        "validator_uptime_node1_2023-01-01T00:00:00.000Z_2023-01-02T00:00:00.000Z",
        3600,
        "95"
      );
      expect(AnalyticsModel.createAnalytics).toHaveBeenCalledWith({
        metric_type: "validator_uptime",
        chain: null,
        value: 95,
        unit: "percentage",
        period_start: expect.any(Date),
        period_end: expect.any(Date),
      });
      expect(uptime).toBe(95);
    });

    test("computeValidatorUptime should handle zero uptime", async () => {
      const mockResult = { rows: [{ avg_uptime: null }] };
      mockPool.query.mockResolvedValue(mockResult);
      mockRedisClient.setEx.mockResolvedValue("OK");
      AnalyticsModel.createAnalytics.mockResolvedValue();

      const uptime = await aggregator.computeValidatorUptime(
        "node1",
        new Date("2023-01-01"),
        new Date("2023-01-02")
      );

      expect(uptime).toBe(0);
    });

    test("computeValidatorUptime should throw on error", async () => {
      mockPool.query.mockRejectedValue(new Error("DB error"));
      await expect(
        aggregator.computeValidatorUptime("node1", new Date(), new Date())
      ).rejects.toThrow("DB error");
    });

    test("processJob should handle calculateDailyTransactionVolume", async () => {
      const mockResult = { rows: [{ total_volume: 500 }] };
      mockPool.query.mockResolvedValue(mockResult);
      mockRedisClient.setEx.mockResolvedValue("OK");
      AnalyticsModel.createAnalytics.mockResolvedValue();

      const job = {
        type: "calculateDailyTransactionVolume",
        params: { chain: "C", date: "2023-01-01" },
      };
      await aggregator.processJob(job);

      expect(mockPool.query).toHaveBeenCalled();
    });

    test("processJob should handle computeValidatorUptime", async () => {
      const mockResult = { rows: [{ avg_uptime: 90 }] };
      mockPool.query.mockResolvedValue(mockResult);
      mockRedisClient.setEx.mockResolvedValue("OK");
      AnalyticsModel.createAnalytics.mockResolvedValue();

      const job = {
        type: "computeValidatorUptime",
        params: { nodeId: "node1", startDate: new Date(), endDate: new Date() },
      };
      await aggregator.processJob(job);

      expect(mockPool.query).toHaveBeenCalled();
    });

    test("processJob should log unknown job type", async () => {
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();
      const job = { type: "unknown", params: {} };
      await aggregator.processJob(job);
      expect(consoleSpy).toHaveBeenCalledWith("Unknown job type:", "unknown");
      consoleSpy.mockRestore();
    });

    test("queueJob should send job to queue", async () => {
      const job = { type: "test" };
      await aggregator.queueJob(job);

      expect(amqp.connect).toHaveBeenCalled();
      expect(mockChannel.sendToQueue).toHaveBeenCalledWith(
        "processing_queue",
        Buffer.from(JSON.stringify(job)),
        { persistent: true }
      );
    });

    test("startConsumer should consume messages", async () => {
      const mockMsg = {
        content: Buffer.from(
          JSON.stringify({
            type: "calculateDailyTransactionVolume",
            params: { chain: "C", date: "2023-01-01" },
          })
        ),
      };
      mockChannel.consume.mockImplementation((queue, callback) => {
        callback(mockMsg);
      });

      // Mock the processJob to avoid actual processing
      const processJobSpy = jest
        .spyOn(aggregator, "processJob")
        .mockResolvedValue();

      await aggregator.startConsumer();

      expect(mockChannel.consume).toHaveBeenCalledWith(
        "processing_queue",
        expect.any(Function),
        { noAck: false }
      );
      expect(processJobSpy).toHaveBeenCalled();
      expect(mockChannel.ack).toHaveBeenCalledWith(mockMsg);

      processJobSpy.mockRestore();
    });
  });

  describe("Consensus", () => {
    test("calculateFinalityTime should calculate and cache finality time", async () => {
      mockRedisClient.get.mockResolvedValue(null);
      const mockResult = { rows: [{ avg_finality_time: 2.5 }] };
      mockPool.query.mockResolvedValue(mockResult);
      mockRedisClient.setEx.mockResolvedValue("OK");
      AnalyticsModel.createAnalytics.mockResolvedValue();

      const finalityTime = await consensus.calculateFinalityTime("C");

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("SELECT AVG(EXTRACT(EPOCH FROM"),
        ["C"]
      );
      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        "finality_time_C",
        3600,
        "2.5"
      );
      expect(AnalyticsModel.createAnalytics).toHaveBeenCalledWith({
        metric_type: "finality_time",
        chain: "C",
        value: 2.5,
        unit: "seconds",
        period_start: expect.any(Date),
        period_end: expect.any(Date),
      });
      expect(finalityTime).toBe(2.5);
    });

    test("calculateFinalityTime should return cached value", async () => {
      mockRedisClient.get.mockResolvedValue("3.0");

      const finalityTime = await consensus.calculateFinalityTime("C");

      expect(mockRedisClient.get).toHaveBeenCalledWith("finality_time_C");
      expect(finalityTime).toBe(3.0);
      expect(mockPool.query).not.toHaveBeenCalled();
    });

    test("calculateFinalityTime should handle zero finality time", async () => {
      mockRedisClient.get.mockResolvedValue(null);
      const mockResult = { rows: [{ avg_finality_time: null }] };
      mockPool.query.mockResolvedValue(mockResult);
      mockRedisClient.setEx.mockResolvedValue("OK");
      AnalyticsModel.createAnalytics.mockResolvedValue();

      const finalityTime = await consensus.calculateFinalityTime("C");

      expect(finalityTime).toBe(0);
    });

    test("calculateFinalityTime should throw on error", async () => {
      mockRedisClient.get.mockResolvedValue(null);
      mockPool.query.mockRejectedValue(new Error("DB error"));
      await expect(consensus.calculateFinalityTime("C")).rejects.toThrow(
        "DB error"
      );
    });

    test("calculateThroughput should calculate and cache TPS", async () => {
      mockRedisClient.get.mockResolvedValue(null);
      const mockResult = { rows: [{ tx_count: 86400 }] }; // 1 per second for 24h
      mockPool.query.mockResolvedValue(mockResult);
      mockRedisClient.setEx.mockResolvedValue("OK");
      AnalyticsModel.createAnalytics.mockResolvedValue();

      const throughput = await consensus.calculateThroughput("C");

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("SELECT COUNT(*)"),
        ["C", expect.any(Date)]
      );
      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        "throughput_C",
        3600,
        "1"
      );
      expect(AnalyticsModel.createAnalytics).toHaveBeenCalledWith({
        metric_type: "throughput",
        chain: "C",
        value: 1,
        unit: "tps",
        period_start: expect.any(Date),
        period_end: expect.any(Date),
      });
      expect(throughput).toBe(1);
    });

    test("calculateThroughput should return cached value", async () => {
      mockRedisClient.get.mockResolvedValue("2.5");

      const throughput = await consensus.calculateThroughput("C");

      expect(throughput).toBe(2.5);
    });

    test("calculateThroughput should throw on error", async () => {
      mockRedisClient.get.mockResolvedValue(null);
      mockPool.query.mockRejectedValue(new Error("DB error"));
      await expect(consensus.calculateThroughput("C")).rejects.toThrow(
        "DB error"
      );
    });

    test("calculateNetworkLatency should calculate and cache latency", async () => {
      mockRedisClient.get.mockResolvedValue(null);
      const mockResult = { rows: [{ avg_latency: 1.5 }] };
      mockPool.query.mockResolvedValue(mockResult);
      mockRedisClient.setEx.mockResolvedValue("OK");
      AnalyticsModel.createAnalytics.mockResolvedValue();

      const latency = await consensus.calculateNetworkLatency();

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("SELECT AVG(EXTRACT(EPOCH FROM"),
        []
      );
      expect(mockRedisClient.setEx).toHaveBeenCalledWith(
        "network_latency",
        3600,
        "1.5"
      );
      expect(AnalyticsModel.createAnalytics).toHaveBeenCalledWith({
        metric_type: "network_latency",
        chain: null,
        value: 1.5,
        unit: "seconds",
        period_start: expect.any(Date),
        period_end: expect.any(Date),
      });
      expect(latency).toBe(1.5);
    });

    test("calculateNetworkLatency should return cached value", async () => {
      mockRedisClient.get.mockResolvedValue("2.0");

      const latency = await consensus.calculateNetworkLatency();

      expect(latency).toBe(2.0);
    });

    test("calculateNetworkLatency should handle zero latency", async () => {
      mockRedisClient.get.mockResolvedValue(null);
      const mockResult = { rows: [{ avg_latency: null }] };
      mockPool.query.mockResolvedValue(mockResult);
      mockRedisClient.setEx.mockResolvedValue("OK");
      AnalyticsModel.createAnalytics.mockResolvedValue();

      const latency = await consensus.calculateNetworkLatency();

      expect(latency).toBe(0);
    });

    test("calculateNetworkLatency should throw on error", async () => {
      mockRedisClient.get.mockResolvedValue(null);
      mockPool.query.mockRejectedValue(new Error("DB error"));
      await expect(consensus.calculateNetworkLatency()).rejects.toThrow(
        "DB error"
      );
    });
  });
});
