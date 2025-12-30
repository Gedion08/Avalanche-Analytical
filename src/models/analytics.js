const pool = require("./db");
const logger = require("../utils/logger");

class AnalyticsModel {
  static async createAnalytics({
    metric_type,
    chain,
    value,
    unit,
    period_start,
    period_end,
  }) {
    try {
      const query = `
        INSERT INTO analytics (metric_type, chain, value, unit, period_start, period_end)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *;
      `;
      const values = [
        metric_type,
        chain,
        value,
        unit,
        period_start,
        period_end,
      ];
      const result = await pool.query(query, values);
      logger.info("Analytics entry created:", result.rows[0]);
      return result.rows[0];
    } catch (error) {
      logger.error("Error creating analytics entry:", error);
      throw error;
    }
  }

  static async getAnalytics(limit = 10, offset = 0) {
    try {
      const query =
        "SELECT * FROM analytics ORDER BY id DESC LIMIT $1 OFFSET $2;";
      const result = await pool.query(query, [limit, offset]);
      logger.info(`Retrieved ${result.rows.length} analytics entries`);
      return result.rows;
    } catch (error) {
      logger.error("Error retrieving analytics:", error);
      throw error;
    }
  }

  static async getAnalyticsById(id) {
    try {
      const query = "SELECT * FROM analytics WHERE id = $1;";
      const result = await pool.query(query, [id]);
      logger.info("Analytics entry retrieved:", result.rows[0]);
      return result.rows[0];
    } catch (error) {
      logger.error("Error retrieving analytics by ID:", error);
      throw error;
    }
  }

  static async updateAnalytics(id, updates) {
    try {
      const fields = Object.keys(updates);
      const values = Object.values(updates);
      const setClause = fields
        .map((field, index) => `${field} = $${index + 2}`)
        .join(", ");
      const query = `UPDATE analytics SET ${setClause} WHERE id = $1 RETURNING *;`;
      const result = await pool.query(query, [id, ...values]);
      logger.info("Analytics entry updated:", result.rows[0]);
      return result.rows[0];
    } catch (error) {
      logger.error("Error updating analytics:", error);
      throw error;
    }
  }

  static async deleteAnalytics(id) {
    try {
      const query = "DELETE FROM analytics WHERE id = $1 RETURNING *;";
      const result = await pool.query(query, [id]);
      logger.info("Analytics entry deleted:", result.rows[0]);
      return result.rows[0];
    } catch (error) {
      logger.error("Error deleting analytics:", error);
      throw error;
    }
  }
}

module.exports = AnalyticsModel;
