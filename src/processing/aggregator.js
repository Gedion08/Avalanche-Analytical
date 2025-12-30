const pool = require("../models/db");
const redis = require("redis");
const amqp = require("amqplib");
const { SimpleLinearRegression } = require("ml-regression");

require("dotenv").config();
const logger = require("../utils/logger");

const redisClient = redis.createClient({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
});

redisClient.on("error", (err) => logger.error("Redis Client Error", err));

async function connectRabbitMQ() {
  try {
    const connection = await amqp.connect(
      `amqp://${process.env.RABBITMQ_USER}:${process.env.RABBITMQ_PASS}@${process.env.RABBITMQ_HOST}:${process.env.RABBITMQ_PORT}`
    );
    const channel = await connection.createChannel();
    await channel.assertQueue("processing_queue", { durable: true });
    logger.info("Connected to RabbitMQ");
    return { connection, channel };
  } catch (error) {
    logger.error("Error connecting to RabbitMQ:", error);
    throw error;
  }
}

async function calculateDailyTransactionVolume(chain, date) {
  try {
    const startDate = new Date(date);
    const endDate = new Date(date);
    endDate.setDate(endDate.getDate() + 1);

    const query = `
      SELECT SUM(amount) as total_volume
      FROM transactions
      WHERE chain = $1 AND timestamp >= $2 AND timestamp < $3;
    `;
    const result = await pool.query(query, [chain, startDate, endDate]);
    const volume = result.rows[0].total_volume || 0;

    // Cache the result
    const cacheKey = `tx_volume_${chain}_${date}`;
    await redisClient.setEx(cacheKey, 3600, volume.toString()); // Cache for 1 hour

    // Store in analytics
    const AnalyticsModel = require("../models/analytics");
    await AnalyticsModel.createAnalytics({
      metric_type: "tx_volume",
      chain,
      value: volume,
      unit: "AVAX",
      period_start: startDate,
      period_end: endDate,
    });

    logger.info(
      `Calculated daily transaction volume for ${chain} on ${date}: ${volume}`
    );
    return volume;
  } catch (error) {
    logger.error("Error calculating daily transaction volume:", error);
    throw error;
  }
}

async function computeValidatorUptime(nodeId, startDate, endDate) {
  try {
    // Simplified: assume uptime is based on some logic, e.g., count of blocks or something
    // For demo, compute average uptime_percentage from validators table
    const query = `
      SELECT AVG(uptime_percentage) as avg_uptime
      FROM validators
      WHERE node_id = $1 AND last_updated >= $2 AND last_updated <= $3;
    `;
    const result = await pool.query(query, [nodeId, startDate, endDate]);
    const uptime = result.rows[0].avg_uptime || 0;

    // Cache
    const cacheKey = `validator_uptime_${nodeId}_${startDate}_${endDate}`;
    await redisClient.setEx(cacheKey, 3600, uptime.toString());

    // Store in analytics
    const AnalyticsModel = require("../models/analytics");
    await AnalyticsModel.createAnalytics({
      metric_type: "validator_uptime",
      chain: null, // or specify
      value: uptime,
      unit: "percentage",
      period_start: startDate,
      period_end: endDate,
    });

    logger.info(`Computed validator uptime for ${nodeId}: ${uptime}%`);
    return uptime;
  } catch (error) {
    logger.error("Error computing validator uptime:", error);
    throw error;
  }
}

async function calculateGasUsageTrends(
  chain,
  startDate,
  endDate,
  page = 1,
  limit = 10
) {
  try {
    if (chain !== "C") {
      throw new Error("Gas usage trends only available for C-Chain");
    }

    // Calculate offset
    const offset = (page - 1) * limit;

    // Query for total count
    const countQuery = `
      SELECT COUNT(DISTINCT DATE(timestamp)) as total
      FROM transactions
      WHERE chain = $1 AND timestamp >= $2 AND timestamp < $3;
    `;
    const countResult = await pool.query(countQuery, [
      chain,
      startDate,
      endDate,
    ]);
    const totalItems = parseInt(countResult.rows[0].total) || 0;
    const totalPages = Math.ceil(totalItems / limit);
    const currentPage = page;

    // Query for paginated data
    const query = `
      SELECT DATE(timestamp) as date, SUM(gas_used) as total_gas
      FROM transactions
      WHERE chain = $1 AND timestamp >= $2 AND timestamp < $3
      GROUP BY DATE(timestamp)
      ORDER BY DATE(timestamp)
      LIMIT $4 OFFSET $5;
    `;
    const result = await pool.query(query, [
      chain,
      startDate,
      endDate,
      limit,
      offset,
    ]);
    const trends = result.rows;

    // For simplicity, store total gas used in the period (for the full data, not paginated)
    const totalGas = trends.reduce(
      (sum, row) => sum + parseFloat(row.total_gas || 0),
      0
    );

    // Cache
    const cacheKey = `gas_usage_trends_${chain}_${startDate}_${endDate}_${page}_${limit}`;
    await redisClient.setEx(
      cacheKey,
      3600,
      JSON.stringify({ trends, totalItems, totalPages, currentPage })
    );

    // Store in analytics (only for full data, or adjust)
    const AnalyticsModel = require("../models/analytics");
    await AnalyticsModel.createAnalytics({
      metric_type: "gas_usage_trends",
      chain,
      value: totalGas,
      unit: "gas_units",
      period_start: startDate,
      period_end: endDate,
    });

    logger.info(
      `Calculated gas usage trends for ${chain}: total items ${totalItems}, page ${page}`
    );
    return { data: trends, totalItems, totalPages, currentPage };
  } catch (error) {
    logger.error("Error calculating gas usage trends:", error);
    throw error;
  }
}

async function calculateSubnetPerformance(subnetId, startDate, endDate) {
  try {
    // Total stake: sum of stake_amount for validators (assuming subnet related, but table doesn't link directly)
    // For simplicity, sum all stake_amount in the period
    const stakeQuery = `
      SELECT SUM(stake_amount) as total_stake
      FROM validators
      WHERE start_time <= $2 AND end_time >= $1;
    `;
    const stakeResult = await pool.query(stakeQuery, [startDate, endDate]);
    const totalStake = stakeResult.rows[0].total_stake || 0;

    // Uptime: average uptime_percentage
    const uptimeQuery = `
      SELECT AVG(uptime_percentage) as avg_uptime
      FROM validators
      WHERE start_time <= $2 AND end_time >= $1;
    `;
    const uptimeResult = await pool.query(uptimeQuery, [startDate, endDate]);
    const avgUptime = uptimeResult.rows[0].avg_uptime || 0;

    // Cache
    const cacheKey = `subnet_performance_${subnetId}_${startDate}_${endDate}`;
    await redisClient.setEx(
      cacheKey,
      3600,
      JSON.stringify({ totalStake, avgUptime })
    );

    // Store in analytics: perhaps two entries or one with value as JSON, but since value is number, store separately
    const AnalyticsModel = require("../models/analytics");
    await AnalyticsModel.createAnalytics({
      metric_type: "subnet_total_stake",
      chain: "P", // P-Chain
      value: totalStake,
      unit: "AVAX",
      period_start: startDate,
      period_end: endDate,
    });
    await AnalyticsModel.createAnalytics({
      metric_type: "subnet_avg_uptime",
      chain: "P",
      value: avgUptime,
      unit: "percentage",
      period_start: startDate,
      period_end: endDate,
    });

    logger.info(
      `Calculated subnet performance for ${subnetId}: stake ${totalStake}, uptime ${avgUptime}%`
    );
    return { totalStake, avgUptime };
  } catch (error) {
    logger.error("Error calculating subnet performance:", error);
    throw error;
  }
}

async function predictTransactionVolume(chain, daysAhead = 7) {
  try {
    // Get historical daily transaction volumes
    const query = `
      SELECT DATE(timestamp) as date, SUM(amount) as volume
      FROM transactions
      WHERE chain = $1
      GROUP BY DATE(timestamp)
      ORDER BY DATE(timestamp) DESC
      LIMIT 30;  -- last 30 days
    `;
    const result = await pool.query(query, [chain]);
    const data = result.rows.reverse(); // oldest first

    if (data.length < 2) {
      throw new Error("Not enough historical data for prediction");
    }

    // Prepare data for regression: x = day index, y = volume
    const x = data.map((_, index) => index);
    const y = data.map((row) => parseFloat(row.volume || 0));

    const regression = new SimpleLinearRegression(x, y);
    const lastIndex = x.length - 1;
    const predicted = regression.predict(lastIndex + daysAhead);

    // Cache
    const cacheKey = `tx_volume_prediction_${chain}_${daysAhead}`;
    await redisClient.setEx(cacheKey, 3600, predicted.toString());

    // Store in analytics
    const AnalyticsModel = require("../models/analytics");
    await AnalyticsModel.createAnalytics({
      metric_type: "predicted_tx_volume",
      chain,
      value: predicted,
      unit: "AVAX",
      period_start: new Date(),
      period_end: new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000),
    });

    logger.info(
      `Predicted transaction volume for ${chain} in ${daysAhead} days: ${predicted}`
    );
    return predicted;
  } catch (error) {
    logger.error("Error predicting transaction volume:", error);
    throw error;
  }
}

async function processJob(job) {
  try {
    const { type, params } = job;
    if (type === "calculateDailyTransactionVolume") {
      await calculateDailyTransactionVolume(params.chain, params.date);
    } else if (type === "computeValidatorUptime") {
      await computeValidatorUptime(
        params.nodeId,
        params.startDate,
        params.endDate
      );
    } else if (type === "calculateGasUsageTrends") {
      await calculateGasUsageTrends(
        params.chain,
        params.startDate,
        params.endDate,
        params.page || 1,
        params.limit || 10
      );
    } else if (type === "calculateSubnetPerformance") {
      await calculateSubnetPerformance(
        params.subnetId,
        params.startDate,
        params.endDate
      );
    } else if (type === "predictTransactionVolume") {
      await predictTransactionVolume(params.chain, params.daysAhead);
    } else {
      logger.info("Unknown job type:", type);
    }
  } catch (error) {
    logger.error("Error processing job:", error);
  }
}

async function startConsumer() {
  const { channel } = await connectRabbitMQ();
  logger.info("Waiting for messages in processing_queue");

  channel.consume(
    "processing_queue",
    async (msg) => {
      if (msg !== null) {
        const job = JSON.parse(msg.content.toString());
        await processJob(job);
        channel.ack(msg);
      }
    },
    { noAck: false }
  );
}

async function queueJob(job) {
  const { channel } = await connectRabbitMQ();
  channel.sendToQueue("processing_queue", Buffer.from(JSON.stringify(job)), {
    persistent: true,
  });
  logger.info("Job queued:", job);
}

// Example usage: queueJob({ type: 'calculateDailyTransactionVolume', params: { chain: 'C', date: '2023-01-01' } });

module.exports = {
  calculateDailyTransactionVolume,
  computeValidatorUptime,
  calculateGasUsageTrends,
  calculateSubnetPerformance,
  predictTransactionVolume,
  queueJob,
  startConsumer,
};
