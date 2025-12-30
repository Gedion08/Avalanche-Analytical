const pool = require("./db");
const logger = require("../utils/logger");

class SubnetsModel {
  static async createSubnet({ subnet_id, control_keys, threshold }) {
    try {
      const query = `
        INSERT INTO subnets (subnet_id, control_keys, threshold)
        VALUES ($1, $2, $3)
        RETURNING *;
      `;
      const values = [subnet_id, JSON.stringify(control_keys), threshold];
      const result = await pool.query(query, values);
      logger.info("Subnet created:", result.rows[0]);
      return result.rows[0];
    } catch (error) {
      logger.error("Error creating subnet:", error);
      throw error;
    }
  }

  static async getSubnets(limit = 10, offset = 0) {
    try {
      const query =
        "SELECT * FROM subnets ORDER BY id DESC LIMIT $1 OFFSET $2;";
      const result = await pool.query(query, [limit, offset]);
      logger.info(`Retrieved ${result.rows.length} subnets`);
      return result.rows;
    } catch (error) {
      logger.error("Error retrieving subnets:", error);
      throw error;
    }
  }

  static async getSubnetById(id) {
    try {
      const query = "SELECT * FROM subnets WHERE id = $1;";
      const result = await pool.query(query, [id]);
      logger.info("Subnet retrieved:", result.rows[0]);
      return result.rows[0];
    } catch (error) {
      logger.error("Error retrieving subnet by ID:", error);
      throw error;
    }
  }

  static async updateSubnet(id, updates) {
    try {
      const fields = Object.keys(updates);
      const values = Object.values(updates);
      const setClause = fields
        .map((field, index) => `${field} = $${index + 2}`)
        .join(", ");
      const query = `UPDATE subnets SET ${setClause} WHERE id = $1 RETURNING *;`;
      const result = await pool.query(query, [id, ...values]);
      logger.info("Subnet updated:", result.rows[0]);
      return result.rows[0];
    } catch (error) {
      logger.error("Error updating subnet:", error);
      throw error;
    }
  }

  static async deleteSubnet(id) {
    try {
      const query = "DELETE FROM subnets WHERE id = $1 RETURNING *;";
      const result = await pool.query(query, [id]);
      logger.info("Subnet deleted:", result.rows[0]);
      return result.rows[0];
    } catch (error) {
      logger.error("Error deleting subnet:", error);
      throw error;
    }
  }
}

module.exports = SubnetsModel;
