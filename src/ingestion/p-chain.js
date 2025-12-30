require("dotenv").config();
const logger = require("../utils/logger");
const { Avalanche } = require("avalanche");
const pg = require("pg");
const retry = require("async-retry");
const { io } = require("../api/server");

const pool = new pg.Pool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || "avalanche_analytics",
  user: process.env.DB_USER || "your_db_user",
  password: process.env.DB_PASS || "your_db_password",
});

async function connectToPChain() {
  try {
    const avalanche = new Avalanche(
      process.env.AVALANCHE_RPC_HOST || "api.avax.network",
      process.env.AVALANCHE_RPC_PORT || 443,
      "https",
      1 // Mainnet network ID
    );
    const pChain = avalanche.PChain();
    logger.info("Connected to P-Chain");
    return pChain;
  } catch (error) {
    logger.error("Error connecting to P-Chain:", error);
    throw error;
  }
}

async function fetchValidators(pChain) {
  try {
    logger.info("Fetching current validators...");
    const currentValidators = await retry(
      async () => {
        return await pChain.getCurrentValidators();
      },
      {
        retries: 3,
        factor: 2,
        onRetry: (err, attempt) =>
          logger.warn(
            `Retry attempt ${attempt} for getCurrentValidators: ${err.message}`
          ),
      }
    );
    logger.info("Fetching pending validators...");
    const pendingValidators = await retry(
      async () => {
        return await pChain.getPendingValidators();
      },
      {
        retries: 3,
        factor: 2,
        onRetry: (err, attempt) =>
          logger.warn(
            `Retry attempt ${attempt} for getPendingValidators: ${err.message}`
          ),
      }
    );

    // Process current validators
    for (const validator of currentValidators) {
      const { nodeID, stakeAmount, startTime, endTime, uptime } = validator;
      const stakeAmountAVAX = stakeAmount.div(1000000000).toNumber(); // Convert from nAVAX to AVAX
      const result = await pool.query(
        `
        INSERT INTO validators (node_id, stake_amount, start_time, end_time, uptime_percentage, rewards)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (node_id) DO UPDATE SET
          stake_amount = EXCLUDED.stake_amount,
          start_time = EXCLUDED.start_time,
          end_time = EXCLUDED.end_time,
          uptime_percentage = EXCLUDED.uptime_percentage,
          rewards = EXCLUDED.rewards,
          last_updated = CURRENT_TIMESTAMP
        RETURNING *
      `,
        [
          nodeID,
          stakeAmountAVAX,
          new Date(startTime * 1000),
          endTime ? new Date(endTime * 1000) : null,
          uptime,
          0,
        ]
      );
      if (result.rows.length > 0) {
        io.emit("new-validator", result.rows[0]);
      }
    }

    // Process pending validators
    for (const validator of pendingValidators) {
      const { nodeID, stakeAmount, startTime, endTime } = validator;
      const stakeAmountAVAX = stakeAmount.div(1000000000).toNumber();
      const result = await pool.query(
        `
        INSERT INTO validators (node_id, stake_amount, start_time, end_time)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (node_id) DO UPDATE SET
          stake_amount = EXCLUDED.stake_amount,
          start_time = EXCLUDED.start_time,
          end_time = EXCLUDED.end_time,
          last_updated = CURRENT_TIMESTAMP
        RETURNING *
      `,
        [
          nodeID,
          stakeAmountAVAX,
          new Date(startTime * 1000),
          new Date(endTime * 1000),
        ]
      );
      if (result.rows.length > 0) {
        io.emit("new-validator", result.rows[0]);
      }
    }

    logger.info("Validators data ingested successfully");
  } catch (error) {
    logger.error("Error fetching validators:", error);
  }
}

async function fetchSubnets(pChain) {
  try {
    logger.info("Fetching subnets...");
    const subnets = await retry(
      async () => {
        return await pChain.getSubnets();
      },
      {
        retries: 3,
        factor: 2,
        onRetry: (err, attempt) =>
          logger.warn(
            `Retry attempt ${attempt} for getSubnets: ${err.message}`
          ),
      }
    );

    for (const subnet of subnets) {
      const { id, controlKeys, threshold } = subnet;
      const result = await pool.query(
        `
        INSERT INTO subnets (subnet_id, control_keys, threshold)
        VALUES ($1, $2, $3)
        ON CONFLICT (subnet_id) DO UPDATE SET
          control_keys = EXCLUDED.control_keys,
          threshold = EXCLUDED.threshold,
          last_updated = CURRENT_TIMESTAMP
        RETURNING *
      `,
        [id, JSON.stringify(controlKeys), threshold]
      );
      if (result.rows.length > 0) {
        io.emit("new-subnet", result.rows[0]);
      }
    }

    logger.info("Subnets data ingested successfully");
  } catch (error) {
    logger.error("Error fetching subnets:", error);
  }
}

async function fetchStakingData(pChain) {
  try {
    logger.info("Fetching staking data...");
    // For staking rewards, this might require fetching UTXOs or specific API calls
    // For simplicity, assuming rewards are updated in fetchValidators
    // Here, we can implement logic to fetch and update rewards if available
    // For now, placeholder
    logger.info(
      "Staking data fetch placeholder - implement reward calculation if needed"
    );
  } catch (error) {
    logger.error("Error fetching staking data:", error);
  }
}

module.exports = {
  connectToPChain,
  fetchValidators,
  fetchSubnets,
  fetchStakingData,
};
