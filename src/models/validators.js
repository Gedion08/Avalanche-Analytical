const pool = require("./db");
const logger = require("../utils/logger");

class ValidatorsModel {
  static async createValidator({
    node_id,
    stake_amount,
    start_time,
    end_time,
    uptime_percentage,
    rewards,
  }) {
    try {
      const query = `
        INSERT INTO validators (node_id, stake_amount, start_time, end_time, uptime_percentage, rewards)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *;
      `;
      const values = [
        node_id,
        stake_amount,
        start_time,
        end_time,
        uptime_percentage,
        rewards,
      ];
      const result = await pool.query(query, values);
      logger.info("Validator created:", result.rows[0]);
      return result.rows[0];
    } catch (error) {
      logger.error("Error creating validator:", error);
      throw error;
    }
  }

  static async getValidators(limit = 10, offset = 0) {
    try {
      const query =
        "SELECT * FROM validators ORDER BY id DESC LIMIT $1 OFFSET $2;";
      const result = await pool.query(query, [limit, offset]);
      logger.info(`Retrieved ${result.rows.length} validators`);
      return result.rows;
    } catch (error) {
      logger.error("Error retrieving validators:", error);
      throw error;
    }
  }

  static async getTopValidatorsByStake(limit = 10) {
    try {
      const query =
        "SELECT * FROM validators ORDER BY stake_amount DESC LIMIT $1;";
      const result = await pool.query(query, [limit]);
      logger.info(`Retrieved top ${result.rows.length} validators by stake`);
      return result.rows;
    } catch (error) {
      logger.error("Error retrieving top validators by stake:", error);
      throw error;
    }
  }

  static async getValidatorById(id) {
    try {
      const query = "SELECT * FROM validators WHERE id = $1;";
      const result = await pool.query(query, [id]);
      logger.info("Validator retrieved:", result.rows[0]);
      return result.rows[0];
    } catch (error) {
      logger.error("Error retrieving validator by ID:", error);
      throw error;
    }
  }

  static async updateValidator(id, updates) {
    try {
      const fields = Object.keys(updates);
      const values = Object.values(updates);
      const setClause = fields
        .map((field, index) => `${field} = $${index + 2}`)
        .join(", ");
      const query = `UPDATE validators SET ${setClause} WHERE id = $1 RETURNING *;`;
      const result = await pool.query(query, [id, ...values]);
      logger.info("Validator updated:", result.rows[0]);
      return result.rows[0];
    } catch (error) {
      logger.error("Error updating validator:", error);
      throw error;
    }
  }

  static async deleteValidator(id) {
    try {
      const query = "DELETE FROM validators WHERE id = $1 RETURNING *;";
      const result = await pool.query(query, [id]);
      logger.info("Validator deleted:", result.rows[0]);
      return result.rows[0];
    } catch (error) {
      logger.error("Error deleting validator:", error);
      throw error;
    }
  }
}

module.exports = ValidatorsModel;
