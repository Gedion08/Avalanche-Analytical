const pool = require("./db");
const logger = require("../utils/logger");

class BlocksModel {
  static async createBlock({
    chain,
    block_hash,
    block_number,
    timestamp,
    parent_hash,
  }) {
    try {
      const query = `
        INSERT INTO blocks (chain, block_hash, block_number, timestamp, parent_hash)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *;
      `;
      const values = [chain, block_hash, block_number, timestamp, parent_hash];
      const result = await pool.query(query, values);
      logger.info("Block created:", result.rows[0]);
      return result.rows[0];
    } catch (error) {
      logger.error("Error creating block:", error);
      throw error;
    }
  }

  static async getBlocks(limit = 10, offset = 0) {
    try {
      const query = "SELECT * FROM blocks ORDER BY id DESC LIMIT $1 OFFSET $2;";
      const result = await pool.query(query, [limit, offset]);
      logger.info(`Retrieved ${result.rows.length} blocks`);
      return result.rows;
    } catch (error) {
      logger.error("Error retrieving blocks:", error);
      throw error;
    }
  }

  static async getBlocksByChain(chain, limit = 10, offset = 0) {
    try {
      const query =
        "SELECT * FROM blocks WHERE chain = $1 ORDER BY id DESC LIMIT $2 OFFSET $3;";
      const result = await pool.query(query, [chain, limit, offset]);
      logger.info(`Retrieved ${result.rows.length} blocks for chain ${chain}`);
      return result.rows;
    } catch (error) {
      logger.error("Error retrieving blocks by chain:", error);
      throw error;
    }
  }

  static async getBlockById(id) {
    try {
      const query = "SELECT * FROM blocks WHERE id = $1;";
      const result = await pool.query(query, [id]);
      logger.info("Block retrieved:", result.rows[0]);
      return result.rows[0];
    } catch (error) {
      logger.error("Error retrieving block by ID:", error);
      throw error;
    }
  }

  static async updateBlock(id, updates) {
    try {
      const fields = Object.keys(updates);
      const values = Object.values(updates);
      const setClause = fields
        .map((field, index) => `${field} = $${index + 2}`)
        .join(", ");
      const query = `UPDATE blocks SET ${setClause} WHERE id = $1 RETURNING *;`;
      const result = await pool.query(query, [id, ...values]);
      logger.info("Block updated:", result.rows[0]);
      return result.rows[0];
    } catch (error) {
      logger.error("Error updating block:", error);
      throw error;
    }
  }

  static async deleteBlock(id) {
    try {
      const query = "DELETE FROM blocks WHERE id = $1 RETURNING *;";
      const result = await pool.query(query, [id]);
      logger.info("Block deleted:", result.rows[0]);
      return result.rows[0];
    } catch (error) {
      logger.error("Error deleting block:", error);
      throw error;
    }
  }
}

module.exports = BlocksModel;
