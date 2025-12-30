const { createClient } = require("redis");
const logger = require("./logger");

let redisClient = null;

const getRedisClient = () => {
  if (!redisClient) {
    redisClient = createClient({
      host: process.env.REDIS_HOST || "localhost",
      port: process.env.REDIS_PORT || 6379,
    });

    redisClient.on("error", (err) => {
      logger.error("Redis Client Error:", err);
    });

    redisClient.connect().catch((err) => {
      logger.error("Failed to connect to Redis:", err);
    });
  }
  return redisClient;
};

const getCachedResponse = async (key) => {
  try {
    const client = getRedisClient();
    const cachedData = await client.get(key);
    if (cachedData) {
      logger.info(`Cache hit for key: ${key}`);
      return JSON.parse(cachedData);
    }
    logger.info(`Cache miss for key: ${key}`);
    return null;
  } catch (error) {
    logger.error("Error getting cached response:", error);
    return null; // Treat as cache miss on error
  }
};

const setCachedResponse = async (key, data, ttl = 300) => {
  try {
    const client = getRedisClient();
    const serializedData = JSON.stringify(data);
    await client.setEx(key, ttl, serializedData);
    logger.info(`Cached response for key: ${key} with TTL: ${ttl}s`);
  } catch (error) {
    logger.error("Error setting cached response:", error);
    // Don't throw, just log
  }
};

module.exports = {
  getCachedResponse,
  setCachedResponse,
};
