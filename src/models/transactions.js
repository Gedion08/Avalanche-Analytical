const pool = require("./db");
const logger = require("../utils/logger");

class TransactionsModel {
  static async createTransaction({
    block_id,
    tx_hash,
    chain,
    from_address,
    to_address,
    amount,
    gas_used,
    gas_price,
    tx_type,
    timestamp,
  }) {
    try {
      const query = `
        INSERT INTO transactions (block_id, tx_hash, chain, from_address, to_address, amount, gas_used, gas_price, tx_type, timestamp)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *;
      `;
      const values = [
        block_id,
        tx_hash,
        chain,
        from_address,
        to_address,
        amount,
        gas_used,
        gas_price,
        tx_type,
        timestamp,
      ];
      const result = await pool.query(query, values);
      logger.info("Transaction created:", result.rows[0]);
      return result.rows[0];
    } catch (error) {
      logger.error("Error creating transaction:", error);
      throw error;
    }
  }

  static async getTransactions(limit = 10, offset = 0) {
    try {
      const query =
        "SELECT * FROM transactions ORDER BY id DESC LIMIT $1 OFFSET $2;";
      const result = await pool.query(query, [limit, offset]);
      logger.info(`Retrieved ${result.rows.length} transactions`);
      return result.rows;
    } catch (error) {
      logger.error("Error retrieving transactions:", error);
      throw error;
    }
  }

  static async getTransactionsByChain(chain, limit = 10, offset = 0) {
    try {
      const query =
        "SELECT * FROM transactions WHERE chain = $1 ORDER BY id DESC LIMIT $2 OFFSET $3;";
      const result = await pool.query(query, [chain, limit, offset]);
      logger.info(
        `Retrieved ${result.rows.length} transactions for chain ${chain}`
      );
      return result.rows;
    } catch (error) {
      logger.error("Error retrieving transactions by chain:", error);
      throw error;
    }
  }

  static async getTransactionById(id) {
    try {
      const query = "SELECT * FROM transactions WHERE id = $1;";
      const result = await pool.query(query, [id]);
      logger.info("Transaction retrieved:", result.rows[0]);
      return result.rows[0];
    } catch (error) {
      logger.error("Error retrieving transaction by ID:", error);
      throw error;
    }
  }

  static async updateTransaction(id, updates) {
    try {
      const fields = Object.keys(updates);
      const values = Object.values(updates);
      const setClause = fields
        .map((field, index) => `${field} = $${index + 2}`)
        .join(", ");
      const query = `UPDATE transactions SET ${setClause} WHERE id = $1 RETURNING *;`;
      const result = await pool.query(query, [id, ...values]);
      logger.info("Transaction updated:", result.rows[0]);
      return result.rows[0];
    } catch (error) {
      logger.error("Error updating transaction:", error);
      throw error;
    }
  }

  static async deleteTransaction(id) {
    try {
      const query = "DELETE FROM transactions WHERE id = $1 RETURNING *;";
      const result = await pool.query(query, [id]);
      logger.info("Transaction deleted:", result.rows[0]);
      return result.rows[0];
    } catch (error) {
      logger.error("Error deleting transaction:", error);
      throw error;
    }
  }
}

module.exports = TransactionsModel;
