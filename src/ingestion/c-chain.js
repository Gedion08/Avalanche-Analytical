require("dotenv").config();
const logger = require("../utils/logger");
const Web3 = require("web3");
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

let web3;

async function connectToCChain() {
  try {
    web3 = new Web3(
      process.env.AVALANCHE_RPC_URL || "https://api.avax.network/ext/bc/C/rpc"
    );
    logger.info("Connected to C-Chain");
    return web3;
  } catch (error) {
    logger.error("Error connecting to C-Chain:", error);
    throw error;
  }
}

async function fetchLatestBlock() {
  try {
    if (!web3) await connectToCChain();
    logger.info("Fetching latest block...");
    const block = await retry(
      async () => {
        return await web3.eth.getBlock("latest", false);
      },
      {
        retries: 3,
        factor: 2,
        onRetry: (err, attempt) =>
          logger.warn(
            `Retry attempt ${attempt} for getBlock latest: ${err.message}`
          ),
      }
    );
    const { number, hash, timestamp, parentHash } = block;
    const blockId = await pool.query(
      `
      INSERT INTO blocks (chain, block_hash, block_number, timestamp, parent_hash)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (block_hash) DO NOTHING
      RETURNING *
    `,
      ["C", hash, number, new Date(timestamp * 1000), parentHash]
    );
    if (blockId.rows.length > 0) {
      io.emit("new-block", blockId.rows[0]);
    }
    logger.info("Latest block ingested:", number);
    return blockId.rows[0]?.id;
  } catch (error) {
    logger.error("Error fetching latest block:", error);
    throw error;
  }
}

async function fetchTransactionsInBlock(blockNumber) {
  try {
    if (!web3) await connectToCChain();
    logger.info(`Fetching transactions in block ${blockNumber}...`);
    const block = await retry(
      async () => {
        return await web3.eth.getBlock(blockNumber, true);
      },
      {
        retries: 3,
        factor: 2,
        onRetry: (err, attempt) =>
          logger.warn(
            `Retry attempt ${attempt} for getBlock ${blockNumber}: ${err.message}`
          ),
      }
    );
    if (!block) {
      logger.info("Block not found");
      return;
    }
    const blockId = await pool.query(
      `
      INSERT INTO blocks (chain, block_hash, block_number, timestamp, parent_hash)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (block_hash) DO NOTHING
      RETURNING *
    `,
      [
        "C",
        block.hash,
        block.number,
        new Date(block.timestamp * 1000),
        block.parentHash,
      ]
    );
    const blockData = blockId.rows[0];
    if (!blockData) {
      logger.info("Block already exists");
      return;
    }
    io.emit("new-block", blockData);
    const id = blockData.id;
    for (const tx of block.transactions) {
      const receipt = await retry(
        async () => {
          return await web3.eth.getTransactionReceipt(tx.hash);
        },
        {
          retries: 3,
          factor: 2,
          onRetry: (err, attempt) =>
            logger.warn(
              `Retry attempt ${attempt} for getTransactionReceipt ${tx.hash}: ${err.message}`
            ),
        }
      );
      const result = await pool.query(
        `
        INSERT INTO transactions (block_id, tx_hash, chain, from_address, to_address, amount, gas_used, gas_price, tx_type, timestamp)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (tx_hash) DO NOTHING
        RETURNING *
      `,
        [
          id,
          tx.hash,
          "C",
          tx.from,
          tx.to,
          tx.value ? web3.utils.fromWei(tx.value, "ether") : null,
          receipt ? receipt.gasUsed : null,
          tx.gasPrice ? web3.utils.fromWei(tx.gasPrice, "gwei") : null,
          tx.to ? "transfer" : "contract_creation",
          new Date(block.timestamp * 1000),
        ]
      );
      if (result.rows.length > 0) {
        io.emit("new-transaction", result.rows[0]);
      }
    }
    logger.info(`Transactions in block ${blockNumber} ingested`);
  } catch (error) {
    logger.error(`Error fetching transactions in block ${blockNumber}:`, error);
    throw error;
  }
}

async function fetchContractEvents(
  fromBlock = "latest",
  toBlock = "latest",
  address = null,
  topics = null
) {
  try {
    if (!web3) await connectToCChain();
    logger.info("Fetching contract events...");
    const logs = await retry(
      async () => {
        return await web3.eth.getPastLogs({
          fromBlock,
          toBlock,
          address,
          topics,
        });
      },
      {
        retries: 3,
        factor: 2,
        onRetry: (err, attempt) =>
          logger.warn(
            `Retry attempt ${attempt} for getPastLogs: ${err.message}`
          ),
      }
    );
    // For now, just log the events; in a full implementation, store in a separate table or process
    logger.info("Contract events fetched:", logs.length);
    // TODO: Insert into DB if needed
    return logs;
  } catch (error) {
    logger.error("Error fetching contract events:", error);
    throw error;
  }
}

module.exports = {
  connectToCChain,
  fetchLatestBlock,
  fetchTransactionsInBlock,
  fetchContractEvents,
};
