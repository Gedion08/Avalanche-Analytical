const pg = require("pg");

// Mock external dependencies
jest.mock("avalanche");
jest.mock("web3", () => {
  return jest.fn(() => ({
    eth: {
      getBlock: jest.fn(),
      getTransactionReceipt: jest.fn(),
      getPastLogs: jest.fn(),
    },
    utils: {
      fromWei: jest.fn(),
    },
  }));
});
jest.mock("pg");

// Import mocked modules
const { Avalanche } = require("avalanche");
const Web3 = require("web3");

// Import modules after mocking
const pChainModule = require("../src/ingestion/p-chain");
const cChainModule = require("../src/ingestion/c-chain");
const xChainModule = require("../src/ingestion/x-chain");

describe("Ingestion Tests", () => {
  let mockPool;

  beforeEach(() => {
    // Mock pg.Pool
    mockPool = {
      query: jest.fn(),
    };
    pg.Pool.mockImplementation(() => mockPool);

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe("P-Chain Ingestion", () => {
    let mockPChain;

    beforeEach(() => {
      mockPChain = {
        getCurrentValidators: jest.fn(),
        getPendingValidators: jest.fn(),
        getSubnets: jest.fn(),
      };

      Avalanche.mockImplementation(() => ({
        PChain: jest.fn().mockReturnValue(mockPChain),
      }));
    });

    test("connectToPChain should connect successfully", async () => {
      const pChain = await pChainModule.connectToPChain();
      expect(pChain).toBe(mockPChain);
      expect(Avalanche).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Number),
        "https",
        1
      );
    });

    test("connectToPChain should throw on error", async () => {
      Avalanche.mockImplementation(() => {
        throw new Error("Connection failed");
      });
      await expect(pChainModule.connectToPChain()).rejects.toThrow(
        "Connection failed"
      );
    });

    test("fetchValidators should insert current and pending validators", async () => {
      const mockCurrentValidators = [
        {
          nodeID: "node1",
          stakeAmount: {
            div: jest.fn().mockReturnValue({ toNumber: () => 1000 }),
          },
          startTime: 1609459200,
          endTime: 1640995200,
          uptime: 95,
        },
      ];
      const mockPendingValidators = [
        {
          nodeID: "node2",
          stakeAmount: {
            div: jest.fn().mockReturnValue({ toNumber: () => 2000 }),
          },
          startTime: 1609459200,
          endTime: 1640995200,
        },
      ];

      mockPChain.getCurrentValidators.mockResolvedValue(mockCurrentValidators);
      mockPChain.getPendingValidators.mockResolvedValue(mockPendingValidators);
      mockPool.query.mockResolvedValue({});

      await pChainModule.fetchValidators(mockPChain);

      expect(mockPool.query).toHaveBeenCalledTimes(2); // One for current, one for pending
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO validators"),
        expect.any(Array)
      );
    });

    test("fetchValidators should handle errors", async () => {
      mockPChain.getCurrentValidators.mockRejectedValue(new Error("API error"));
      await expect(pChainModule.fetchValidators(mockPChain)).rejects.toThrow(
        "API error"
      );
    });

    test("fetchSubnets should insert subnets", async () => {
      const mockSubnets = [
        {
          id: "subnet1",
          controlKeys: ["key1", "key2"],
          threshold: 2,
        },
      ];

      mockPChain.getSubnets.mockResolvedValue(mockSubnets);
      mockPool.query.mockResolvedValue({});

      await pChainModule.fetchSubnets(mockPChain);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO subnets"),
        ["subnet1", '["key1","key2"]', 2]
      );
    });

    test("fetchSubnets should handle errors", async () => {
      mockPChain.getSubnets.mockRejectedValue(new Error("API error"));
      await expect(pChainModule.fetchSubnets(mockPChain)).rejects.toThrow(
        "API error"
      );
    });
  });

  describe("C-Chain Ingestion", () => {
    let mockWeb3;

    beforeEach(() => {
      mockWeb3 = new Web3();
    });

    test("connectToCChain should connect successfully", async () => {
      const web3 = await cChainModule.connectToCChain();
      expect(web3).toBe(mockWeb3);
      expect(Web3).toHaveBeenCalledWith(expect.any(String));
    });

    test("connectToCChain should throw on error", async () => {
      Web3.mockImplementation(() => {
        throw new Error("Connection failed");
      });
      await expect(cChainModule.connectToCChain()).rejects.toThrow(
        "Connection failed"
      );
    });

    test("fetchLatestBlock should insert block and return id", async () => {
      const mockBlock = {
        number: 12345,
        hash: "0xhash",
        timestamp: 1609459200,
        parentHash: "0xparent",
      };

      mockWeb3.eth.getBlock.mockResolvedValue(mockBlock);
      mockPool.query.mockResolvedValue({ rows: [{ id: 1 }] });

      const id = await cChainModule.fetchLatestBlock();

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO blocks"),
        ["C", "0xhash", 12345, expect.any(Date), "0xparent"]
      );
      expect(id).toBe(1);
    });

    test("fetchLatestBlock should throw on error", async () => {
      mockWeb3.eth.getBlock.mockRejectedValue(new Error("Block fetch failed"));
      await expect(cChainModule.fetchLatestBlock()).rejects.toThrow(
        "Block fetch failed"
      );
    });

    test("fetchTransactionsInBlock should insert transactions", async () => {
      const mockBlock = {
        number: 12345,
        hash: "0xhash",
        timestamp: 1609459200,
        parentHash: "0xparent",
        transactions: [
          {
            hash: "0xtx1",
            from: "0xfrom",
            to: "0xto",
            value: "1000000000000000000", // 1 ETH in wei
            gasPrice: "20000000000", // 20 gwei
          },
        ],
      };
      const mockReceipt = {
        gasUsed: 21000,
      };

      mockWeb3.eth.getBlock.mockResolvedValue(mockBlock);
      mockWeb3.eth.getTransactionReceipt.mockResolvedValue(mockReceipt);
      mockPool.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })
        .mockResolvedValue({});

      await cChainModule.fetchTransactionsInBlock(12345);

      expect(mockPool.query).toHaveBeenCalledTimes(2); // Block insert and tx insert
    });

    test("fetchTransactionsInBlock should handle block not found", async () => {
      mockWeb3.eth.getBlock.mockResolvedValue(null);
      const result = await cChainModule.fetchTransactionsInBlock(12345);
      expect(result).toBeUndefined();
    });

    test("fetchContractEvents should fetch logs", async () => {
      const mockLogs = [{ event: "Transfer" }];
      mockWeb3.eth.getPastLogs.mockResolvedValue(mockLogs);

      const logs = await cChainModule.fetchContractEvents();
      expect(logs).toEqual(mockLogs);
    });

    test("fetchContractEvents should throw on error", async () => {
      mockWeb3.eth.getPastLogs.mockRejectedValue(
        new Error("Logs fetch failed")
      );
      await expect(cChainModule.fetchContractEvents()).rejects.toThrow(
        "Logs fetch failed"
      );
    });
  });

  describe("X-Chain Ingestion", () => {
    let mockXChain;

    beforeEach(() => {
      mockXChain = {
        getAssetDescription: jest.fn(),
        getAllBalances: jest.fn(),
      };

      Avalanche.mockImplementation(() => ({
        XChain: jest.fn().mockReturnValue(mockXChain),
      }));
    });

    test("connectToXChain should connect successfully", async () => {
      const xChain = await xChainModule.connectToXChain();
      expect(xChain).toBe(mockXChain);
    });

    test("connectToXChain should throw on error", async () => {
      Avalanche.mockImplementation(() => {
        throw new Error("Connection failed");
      });
      await expect(xChainModule.connectToXChain()).rejects.toThrow(
        "Connection failed"
      );
    });

    test("fetchAssets should insert asset", async () => {
      const mockAssetDesc = {
        name: "Avalanche",
        symbol: "AVAX",
        denomination: 9,
      };

      mockXChain.getAssetDescription.mockResolvedValue(mockAssetDesc);
      mockPool.query.mockResolvedValue({});

      await xChainModule.fetchAssets();

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO assets"),
        [
          "FvwEAhmxKfeiG8SnEvq42hc6whRyY3EFYAvebMqDNDGCgxN5Z",
          "Avalanche",
          "AVAX",
          9,
        ]
      );
    });

    test("fetchAssets should handle errors", async () => {
      mockXChain.getAssetDescription.mockRejectedValue(
        new Error("Asset fetch failed")
      );
      await expect(xChainModule.fetchAssets()).rejects.toThrow(
        "Asset fetch failed"
      );
    });

    test("fetchBalances should log balances", async () => {
      const mockBalances = [{ assetID: "asset1", balance: "1000" }];

      mockXChain.getAllBalances.mockResolvedValue(mockBalances);

      await xChainModule.fetchBalances("address1");

      // Since it only logs, just check the call
      expect(mockXChain.getAllBalances).toHaveBeenCalledWith("address1");
    });

    test("fetchBalances should handle errors", async () => {
      mockXChain.getAllBalances.mockRejectedValue(
        new Error("Balance fetch failed")
      );
      await expect(xChainModule.fetchBalances("address1")).rejects.toThrow(
        "Balance fetch failed"
      );
    });
  });
});
