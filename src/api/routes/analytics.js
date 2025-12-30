const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const {
  calculateDailyTransactionVolume,
  computeValidatorUptime,
  calculateGasUsageTrends,
  calculateSubnetPerformance,
  predictTransactionVolume,
} = require("../../processing/aggregator");
const {
  calculateFinalityTime,
  calculateThroughput,
} = require("../../processing/consensus");
const TransactionsModel = require("../../models/transactions");
const BlocksModel = require("../../models/blocks");
const ValidatorsModel = require("../../models/validators");
const logger = require("../../utils/logger");
const { getCachedResponse, setCachedResponse } = require("../../utils/cache");

// Apply auth middleware to all routes
router.use(auth);

// GET /api/analytics/transactions/volume
router.get("/transactions/volume", async (req, res) => {
  try {
    const { chain, date, page, limit, startDate, endDate } = req.query;
    if (!chain || !date) {
      return res
        .status(400)
        .json({ error: "Missing required query parameters: chain, date" });
    }
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 10;
    if (page && (isNaN(pageNum) || pageNum < 1)) {
      return res
        .status(400)
        .json({ error: "Invalid page parameter: must be a positive integer" });
    }
    if (limit && (isNaN(limitNum) || limitNum < 1)) {
      return res
        .status(400)
        .json({ error: "Invalid limit parameter: must be a positive integer" });
    }
    if (startDate && isNaN(new Date(startDate).getTime())) {
      return res
        .status(400)
        .json({ error: "Invalid startDate parameter: must be a valid date" });
    }
    if (endDate && isNaN(new Date(endDate).getTime())) {
      return res
        .status(400)
        .json({ error: "Invalid endDate parameter: must be a valid date" });
    }
    const volume = await calculateDailyTransactionVolume(chain, date);
    logger.info(
      `Fetched transaction volume for ${chain} on ${date}: ${volume}`
    );
    res.json({ volume });
  } catch (error) {
    logger.error("Error in /transactions/volume:", error);
    res.status(500).json({ error: "Failed to fetch transaction volume" });
  }
});

// GET /api/analytics/validators/uptime
router.get("/validators/uptime", async (req, res) => {
  try {
    const { nodeId, startDate, endDate, page, limit, chain } = req.query;
    if (!nodeId || !startDate || !endDate) {
      return res.status(400).json({
        error: "Missing required query parameters: nodeId, startDate, endDate",
      });
    }
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 10;
    if (page && (isNaN(pageNum) || pageNum < 1)) {
      return res
        .status(400)
        .json({ error: "Invalid page parameter: must be a positive integer" });
    }
    if (limit && (isNaN(limitNum) || limitNum < 1)) {
      return res
        .status(400)
        .json({ error: "Invalid limit parameter: must be a positive integer" });
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
      return res.status(400).json({
        error:
          "Invalid date parameters: startDate and endDate must be valid dates with startDate < endDate",
      });
    }
    const uptime = await computeValidatorUptime(nodeId, start, end);
    logger.info(`Fetched validator uptime for ${nodeId}: ${uptime}`);
    res.json({ uptime });
  } catch (error) {
    logger.error("Error in /validators/uptime:", error);
    res.status(500).json({ error: "Failed to fetch validator uptime" });
  }
});

// GET /api/analytics/consensus/finality
router.get("/consensus/finality", async (req, res) => {
  try {
    const { chain, page, limit, startDate, endDate } = req.query;
    if (!chain) {
      return res
        .status(400)
        .json({ error: "Missing required query parameter: chain" });
    }
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 10;
    if (page && (isNaN(pageNum) || pageNum < 1)) {
      return res
        .status(400)
        .json({ error: "Invalid page parameter: must be a positive integer" });
    }
    if (limit && (isNaN(limitNum) || limitNum < 1)) {
      return res
        .status(400)
        .json({ error: "Invalid limit parameter: must be a positive integer" });
    }
    if (startDate && isNaN(new Date(startDate).getTime())) {
      return res
        .status(400)
        .json({ error: "Invalid startDate parameter: must be a valid date" });
    }
    if (endDate && isNaN(new Date(endDate).getTime())) {
      return res
        .status(400)
        .json({ error: "Invalid endDate parameter: must be a valid date" });
    }
    const finalityTime = await calculateFinalityTime(chain);
    logger.info(`Fetched finality time for ${chain}: ${finalityTime}`);
    res.json({ finalityTime });
  } catch (error) {
    logger.error("Error in /consensus/finality:", error);
    res.status(500).json({ error: "Failed to fetch finality time" });
  }
});

// GET /api/analytics/consensus/throughput
router.get("/consensus/throughput", async (req, res) => {
  try {
    const { chain, page, limit, startDate, endDate } = req.query;
    if (!chain) {
      return res
        .status(400)
        .json({ error: "Missing required query parameter: chain" });
    }
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 10;
    if (page && (isNaN(pageNum) || pageNum < 1)) {
      return res
        .status(400)
        .json({ error: "Invalid page parameter: must be a positive integer" });
    }
    if (limit && (isNaN(limitNum) || limitNum < 1)) {
      return res
        .status(400)
        .json({ error: "Invalid limit parameter: must be a positive integer" });
    }
    if (startDate && isNaN(new Date(startDate).getTime())) {
      return res
        .status(400)
        .json({ error: "Invalid startDate parameter: must be a valid date" });
    }
    if (endDate && isNaN(new Date(endDate).getTime())) {
      return res
        .status(400)
        .json({ error: "Invalid endDate parameter: must be a valid date" });
    }
    const throughput = await calculateThroughput(chain);
    logger.info(`Fetched throughput for ${chain}: ${throughput}`);
    res.json({ throughput });
  } catch (error) {
    logger.error("Error in /consensus/throughput:", error);
    res.status(500).json({ error: "Failed to fetch throughput" });
  }
});

// GET /api/analytics/gas/trends
router.get("/gas/trends", async (req, res) => {
  try {
    const { chain, startDate, endDate, page, limit } = req.query;
    if (!chain || !startDate || !endDate) {
      return res.status(400).json({
        error: "Missing required query parameters: chain, startDate, endDate",
      });
    }
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 10;
    if (pageNum < 1 || limitNum < 1) {
      return res.status(400).json({
        error:
          "Invalid pagination parameters: page and limit must be positive integers",
      });
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
      return res.status(400).json({
        error:
          "Invalid date parameters: startDate and endDate must be valid dates with startDate < endDate",
      });
    }
    const result = await calculateGasUsageTrends(
      chain,
      start,
      end,
      pageNum,
      limitNum
    );
    logger.info(`Fetched gas usage trends for ${chain}, page ${pageNum}`);
    res.json({
      data: result.data,
      totalItems: result.totalItems,
      totalPages: result.totalPages,
      currentPage: result.currentPage,
    });
  } catch (error) {
    logger.error("Error in /gas/trends:", error);
    res.status(500).json({ error: "Failed to fetch gas usage trends" });
  }
});

// GET /api/analytics/subnets/performance
router.get("/subnets/performance", async (req, res) => {
  try {
    const { subnetId, startDate, endDate, page, limit, chain } = req.query;
    if (!subnetId || !startDate || !endDate) {
      return res.status(400).json({
        error:
          "Missing required query parameters: subnetId, startDate, endDate",
      });
    }
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 10;
    if (page && (isNaN(pageNum) || pageNum < 1)) {
      return res
        .status(400)
        .json({ error: "Invalid page parameter: must be a positive integer" });
    }
    if (limit && (isNaN(limitNum) || limitNum < 1)) {
      return res
        .status(400)
        .json({ error: "Invalid limit parameter: must be a positive integer" });
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
      return res.status(400).json({
        error:
          "Invalid date parameters: startDate and endDate must be valid dates with startDate < endDate",
      });
    }
    const performance = await calculateSubnetPerformance(subnetId, start, end);
    logger.info(`Fetched subnet performance for ${subnetId}`);
    res.json({ performance });
  } catch (error) {
    logger.error("Error in /subnets/performance:", error);
    res.status(500).json({ error: "Failed to fetch subnet performance" });
  }
});

// GET /api/analytics/transactions/predict
router.get("/transactions/predict", async (req, res) => {
  try {
    const { chain, daysAhead, page, limit, startDate, endDate } = req.query;
    if (!chain) {
      return res
        .status(400)
        .json({ error: "Missing required query parameter: chain" });
    }
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 10;
    if (page && (isNaN(pageNum) || pageNum < 1)) {
      return res
        .status(400)
        .json({ error: "Invalid page parameter: must be a positive integer" });
    }
    if (limit && (isNaN(limitNum) || limitNum < 1)) {
      return res
        .status(400)
        .json({ error: "Invalid limit parameter: must be a positive integer" });
    }
    if (startDate && isNaN(new Date(startDate).getTime())) {
      return res
        .status(400)
        .json({ error: "Invalid startDate parameter: must be a valid date" });
    }
    if (endDate && isNaN(new Date(endDate).getTime())) {
      return res
        .status(400)
        .json({ error: "Invalid endDate parameter: must be a valid date" });
    }
    const days = daysAhead ? parseInt(daysAhead) : 7;
    const predicted = await predictTransactionVolume(chain, days);
    logger.info(`Fetched predicted transaction volume for ${chain}`);
    res.json({ predicted });
  } catch (error) {
    logger.error("Error in /transactions/predict:", error);
    res
      .status(500)
      .json({ error: "Failed to fetch predicted transaction volume" });
  }
});

// GET /api/raw/transactions
router.get("/raw/transactions", async (req, res) => {
  try {
    const { chain, limit, page } = req.query;
    if (!chain) {
      return res
        .status(400)
        .json({ error: "Missing required query parameter: chain" });
    }
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 10;
    if (page && (isNaN(pageNum) || pageNum < 1)) {
      return res
        .status(400)
        .json({ error: "Invalid page parameter: must be a positive integer" });
    }
    if (limit && (isNaN(limitNum) || limitNum < 1)) {
      return res
        .status(400)
        .json({ error: "Invalid limit parameter: must be a positive integer" });
    }
    const offset = (pageNum - 1) * limitNum;
    const transactions = await TransactionsModel.getTransactionsByChain(
      chain,
      limitNum,
      offset
    );
    logger.info(`Fetched raw transactions for chain ${chain}, page ${pageNum}`);
    res.json({ transactions });
  } catch (error) {
    logger.error("Error in /raw/transactions:", error);
    res.status(500).json({ error: "Failed to fetch raw transactions" });
  }
});

// GET /api/raw/blocks
router.get("/raw/blocks", async (req, res) => {
  try {
    const { chain, limit, page } = req.query;
    if (!chain) {
      return res
        .status(400)
        .json({ error: "Missing required query parameter: chain" });
    }
    const pageNum = page ? parseInt(page) : 1;
    const limitNum = limit ? parseInt(limit) : 10;
    if (page && (isNaN(pageNum) || pageNum < 1)) {
      return res
        .status(400)
        .json({ error: "Invalid page parameter: must be a positive integer" });
    }
    if (limit && (isNaN(limitNum) || limitNum < 1)) {
      return res
        .status(400)
        .json({ error: "Invalid limit parameter: must be a positive integer" });
    }
    const offset = (pageNum - 1) * limitNum;
    const blocks = await BlocksModel.getBlocksByChain(chain, limitNum, offset);
    logger.info(`Fetched raw blocks for chain ${chain}, page ${pageNum}`);
    res.json({ blocks });
  } catch (error) {
    logger.error("Error in /raw/blocks:", error);
    res.status(500).json({ error: "Failed to fetch raw blocks" });
  }
});

// GET /api/aggregated/top-validators
router.get("/aggregated/top-validators", async (req, res) => {
  try {
    const { limit } = req.query;
    const limitNum = limit ? parseInt(limit) : 10;
    if (limit && (isNaN(limitNum) || limitNum < 1)) {
      return res
        .status(400)
        .json({ error: "Invalid limit parameter: must be a positive integer" });
    }
    const validators = await ValidatorsModel.getTopValidatorsByStake(limitNum);
    logger.info(`Fetched top ${limitNum} validators by stake`);
    res.json({ validators });
  } catch (error) {
    logger.error("Error in /aggregated/top-validators:", error);
    res.status(500).json({ error: "Failed to fetch top validators" });
  }
});

module.exports = router;
