const pool = require("../models/db");
const redis = require("redis");
const AnalyticsModel = require("../models/analytics");

require("dotenv").config();
const logger = require("../utils/logger");

const redisClient = redis.createClient({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
});

redisClient.on("error", (err) => logger.error("Redis Client Error", err));

async function calculateFinalityTime(chain) {
  try {
    const cacheKey = `finality_time_${chain}`;
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      logger.info(`Retrieved finality time from cache for ${chain}: ${cached}`);
      return parseFloat(cached);
    }

    const query = `
      SELECT AVG(EXTRACT(EPOCH FROM (b.timestamp - t.timestamp))) as avg_finality_time
      FROM transactions t
      JOIN blocks b ON t.block_id = b.id
      WHERE t.chain = $1 AND b.chain = $1;
    `;
    const result = await pool.query(query, [chain]);
    const avgFinalityTime = result.rows[0].avg_finality_time || 0;

    // Cache for 1 hour
    await redisClient.setEx(cacheKey, 3600, avgFinalityTime.toString());

    // Store in analytics
    const periodStart = new Date(); // Current time as period start for simplicity
    const periodEnd = new Date();
    await AnalyticsModel.createAnalytics({
      metric_type: "finality_time",
      chain,
      value: avgFinalityTime,
      unit: "seconds",
      period_start: periodStart,
      period_end: periodEnd,
    });

    logger.info(
      `Calculated finality time for ${chain}: ${avgFinalityTime} seconds`
    );
    return avgFinalityTime;
  } catch (error) {
    logger.error("Error calculating finality time:", error);
    throw error;
  }
}

async function calculateThroughput(chain) {
  try {
    const cacheKey = `throughput_${chain}`;
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      logger.info(`Retrieved throughput from cache for ${chain}: ${cached}`);
      return parseFloat(cached);
    }

    // Calculate TPS over the last 24 hours
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const query = `
      SELECT COUNT(*) as tx_count
      FROM transactions
      WHERE chain = $1 AND timestamp >= $2;
    `;
    const result = await pool.query(query, [chain, twentyFourHoursAgo]);
    const txCount = parseInt(result.rows[0].tx_count);
    const secondsInPeriod = 24 * 60 * 60;
    const tps = txCount / secondsInPeriod;

    // Cache for 1 hour
    await redisClient.setEx(cacheKey, 3600, tps.toString());

    // Store in analytics
    await AnalyticsModel.createAnalytics({
      metric_type: "throughput",
      chain,
      value: tps,
      unit: "tps",
      period_start: twentyFourHoursAgo,
      period_end: now,
    });

    logger.info(`Calculated throughput for ${chain}: ${tps} TPS`);
    return tps;
  } catch (error) {
    logger.error("Error calculating throughput:", error);
    throw error;
  }
}

async function calculateNetworkLatency() {
  try {
    const cacheKey = "network_latency";
    const cached = await redisClient.get(cacheKey);
    if (cached) {
      logger.info(`Retrieved network latency from cache: ${cached}`);
      return parseFloat(cached);
    }

    // Calculate average block interval as a proxy for network latency
    const query = `
      SELECT AVG(EXTRACT(EPOCH FROM (timestamp - LAG(timestamp) OVER (ORDER BY timestamp)))) as avg_latency
      FROM blocks;
    `;
    const result = await pool.query(query);
    const avgLatency = result.rows[0].avg_latency || 0;

    // Cache for 1 hour
    await redisClient.setEx(cacheKey, 3600, avgLatency.toString());

    // Store in analytics (chain null for global)
    const periodStart = new Date();
    const periodEnd = new Date();
    await AnalyticsModel.createAnalytics({
      metric_type: "network_latency",
      chain: null,
      value: avgLatency,
      unit: "seconds",
      period_start: periodStart,
      period_end: periodEnd,
    });

    logger.info(`Calculated network latency: ${avgLatency} seconds`);
    return avgLatency;
  } catch (error) {
    logger.error("Error calculating network latency:", error);
    throw error;
  }
}

module.exports = {
  calculateFinalityTime,
  calculateThroughput,
  calculateNetworkLatency,
};
