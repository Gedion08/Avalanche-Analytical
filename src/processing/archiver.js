const pool = require("../models/db");
const logger = require("../utils/logger");

const ARCHIVE_THRESHOLD_DAYS = process.env.ARCHIVE_THRESHOLD_DAYS || 30;

async function archiveData() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - ARCHIVE_THRESHOLD_DAYS);

    logger.info(`Archiving data older than ${cutoffDate.toISOString()}`);

    // Archive blocks
    const archiveBlocksQuery = `
            INSERT INTO archived_blocks (chain, block_hash, block_number, timestamp, parent_hash, created_at)
            SELECT chain, block_hash, block_number, timestamp, parent_hash, created_at
            FROM blocks
            WHERE timestamp < $1
        `;
    await client.query(archiveBlocksQuery, [cutoffDate]);

    const deleteBlocksQuery = `DELETE FROM blocks WHERE timestamp < $1`;
    const blocksDeleted = await client.query(deleteBlocksQuery, [cutoffDate]);
    logger.info(`Archived ${blocksDeleted.rowCount} blocks`);

    // Archive transactions
    const archiveTransactionsQuery = `
            INSERT INTO archived_transactions (block_id, tx_hash, chain, from_address, to_address, amount, gas_used, gas_price, tx_type, timestamp, created_at)
            SELECT block_id, tx_hash, chain, from_address, to_address, amount, gas_used, gas_price, tx_type, timestamp, created_at
            FROM transactions
            WHERE timestamp < $1
        `;
    await client.query(archiveTransactionsQuery, [cutoffDate]);

    const deleteTransactionsQuery = `DELETE FROM transactions WHERE timestamp < $1`;
    const transactionsDeleted = await client.query(deleteTransactionsQuery, [
      cutoffDate,
    ]);
    logger.info(`Archived ${transactionsDeleted.rowCount} transactions`);

    await client.query("COMMIT");
    logger.info("Archiving completed successfully");
  } catch (error) {
    await client.query("ROLLBACK");
    logger.error("Error during archiving:", error);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { archiveData };
