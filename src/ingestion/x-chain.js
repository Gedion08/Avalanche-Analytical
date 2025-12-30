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

let xChain;

async function connectToXChain() {
  try {
    const avalanche = new Avalanche(
      process.env.AVALANCHE_RPC_HOST || "api.avax.network",
      process.env.AVALANCHE_RPC_PORT || 443,
      "https",
      1 // Mainnet network ID
    );
    xChain = avalanche.XChain();
    logger.info("Connected to X-Chain");
    return xChain;
  } catch (error) {
    logger.error("Error connecting to X-Chain:", error);
    throw error;
  }
}

async function fetchAssets() {
  try {
    if (!xChain) await connectToXChain();
    logger.info("Fetching assets...");

    // Assuming AVAX is the primary asset; in a full implementation, fetch all assets from transactions or API
    const avaxAssetID = "FvwEAhmxKfeiG8SnEvq42hc6whRyY3EFYAvebMqDNDGCgxN5Z"; // AVAX AssetID
    const assetDescription = await retry(
      async () => {
        return await xChain.getAssetDescription(avaxAssetID);
      },
      {
        retries: 3,
        factor: 2,
        onRetry: (err, attempt) =>
          logger.warn(
            `Retry attempt ${attempt} for getAssetDescription: ${err.message}`
          ),
      }
    );

    await pool.query(
      `
      INSERT INTO assets (asset_id, name, symbol, denomination)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (asset_id) DO NOTHING
      `,
      [
        avaxAssetID,
        assetDescription.name,
        assetDescription.symbol,
        assetDescription.denomination,
      ]
    );

    logger.info("Assets ingested");
  } catch (error) {
    logger.error("Error fetching assets:", error);
    throw error;
  }
}

async function fetchBalances(address) {
  try {
    if (!xChain) await connectToXChain();
    logger.info(`Fetching balances for address ${address}...`);

    const balances = await retry(
      async () => {
        return await xChain.getAllBalances(address);
      },
      {
        retries: 3,
        factor: 2,
        onRetry: (err, attempt) =>
          logger.warn(
            `Retry attempt ${attempt} for getAllBalances ${address}: ${err.message}`
          ),
      }
    );

    for (const balance of balances) {
      // Assuming a balances table or insert into assets with balance, but since no balances table, perhaps log or insert into x_transactions if applicable
      // For now, just log; in full implementation, create balances table or use existing
      logger.info(`Asset ${balance.assetID}: ${balance.balance}`);
      // If balances table exists: INSERT INTO balances (address, asset_id, balance) VALUES ...
    }

    logger.info("Balances fetched");
  } catch (error) {
    logger.error(`Error fetching balances for ${address}:`, error);
    throw error;
  }
}

async function fetchXTransactions() {
  try {
    if (!xChain) await connectToXChain();
    logger.info("Fetching X-Chain transactions...");

    // Placeholder: Fetch recent transactions; in full implementation, use getTx or query UTXOs
    // For example, getUTXOs for an address, but to get all, perhaps poll recent blocks
    // Assuming we have a way to get recent txs

    // Dummy example: Assume we have tx data
    const txs = []; // Replace with actual fetch, e.g., from getTxStatus or polling

    for (const tx of txs) {
      const result = await pool.query(
        `
        INSERT INTO x_transactions (tx_id, type, inputs, outputs, timestamp)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (tx_id) DO NOTHING
        RETURNING *
        `,
        [
          tx.id,
          tx.type,
          JSON.stringify(tx.inputs),
          JSON.stringify(tx.outputs),
          new Date(tx.timestamp * 1000),
        ]
      );
      if (result.rows.length > 0) {
        io.emit("new-transaction", result.rows[0]);
      }
    }

    logger.info("X-Chain transactions ingested");
  } catch (error) {
    logger.error("Error fetching X-Chain transactions:", error);
    throw error;
  }
}

async function startPeriodicIngestion(intervalMs = 60000) {
  // Default 1 minute
  logger.info("Starting periodic X-Chain ingestion...");
  setInterval(async () => {
    try {
      await fetchAssets();
      // await fetchBalances(someAddress); // Would need addresses
      await fetchXTransactions();
    } catch (error) {
      logger.error("Error in periodic ingestion:", error);
    }
  }, intervalMs);
}

module.exports = {
  connectToXChain,
  fetchAssets,
  fetchBalances,
  fetchXTransactions,
  startPeriodicIngestion,
};
