import express from "express";
import { ethers } from "ethers";
import dotenv from "dotenv";
import { saveState, getLatestState } from "./db";
import { SUBJECT_ABI, PRICE_SLOPE, DECIMALS, DEFAULT_SUPPLY } from "./consts";

dotenv.config();

const BNB_PRICE_USD = 800;

const app = express();
app.use(express.json());

const provider = new ethers.WebSocketProvider(process.env.RPC_URL!);

const liveState = new Map<string, { supply: bigint; name: string; contract: ethers.Contract }>(); // Tracked tokens

async function startIndexing(tokenName: string, tokenAddr: string) {
  const addr = tokenAddr.toLowerCase();
  if (liveState.has(addr)) return; // Already tracking

  const contract = new ethers.Contract(tokenAddr, SUBJECT_ABI, provider);

  let supply: bigint;
  try {
    supply = await contract.totalSupply();
  } catch (err) {
    console.error(`Failed to query totalSupply for ${tokenAddr}: ${err}. Using default.`);
    supply = DEFAULT_SUPPLY;
  }

  liveState.set(addr, { supply, name: tokenName || "Unknown Token", contract });

  const currentBlock = await provider.getBlockNumber();

  // Save initial state immediately 
  await updateToken(tokenAddr, 0n, true, BigInt(currentBlock), 0, "initial");

  // Backfill in background
  setImmediate(async () => {
    try {
      const filterBuy = contract.filters.Buy();
      const pastBuys = await contract.queryFilter(filterBuy, currentBlock - 100, currentBlock);
      for (const log of pastBuys) {
        await updateToken(
          tokenAddr,
          (log as ethers.EventLog).args.amount,
          true,
          BigInt(log.blockNumber),
          log.index,
          log.transactionHash
        );
      }
      const filterSell = contract.filters.Sell();
      const pastSells = await contract.queryFilter(filterSell, currentBlock - 100, currentBlock);
      for (const log of pastSells) {
        await updateToken(
          tokenAddr,
          (log as ethers.EventLog).args.amount,
          false,
          BigInt(log.blockNumber),
          log.index,
          log.transactionHash
        );
      }
      console.log(`Backfill complete for ${tokenName} at ${tokenAddr}`);
    } catch (err) {
      console.error(`Backfill failed for ${tokenAddr}: ${err}`);
    }
  });

  // Subscribe to future events
  contract.on("Buy", (buyer, amount, paid, ev) => 
    updateToken(tokenAddr, amount, true, BigInt(ev.blockNumber), ev.index, ev.transactionHash)
  );

  contract.on("Sell", (seller, amount, received, ev) => 
    updateToken(tokenAddr, amount, false, BigInt(ev.blockNumber), ev.index, ev.transactionHash)
  );

  contract.on("Trade", (trader, amount, isBuy, ev) => 
    updateToken(tokenAddr, amount, isBuy, BigInt(ev.blockNumber), ev.index, ev.transactionHash)
  );

  console.log(`Started indexing ${tokenName || "Unknown Token"} at ${tokenAddr} (backfill running in background)`);
}

async function updateToken(
  tokenAddr: string,
  amount: bigint,
  isBuy: boolean,
  blockNumber: bigint,
  logIndex: number,
  txHash: string
) {
  const addr = tokenAddr.toLowerCase();
  const state = liveState.get(addr);
  if (!state) return;

  if (amount > 0n) { 
    if (isBuy) {
      state.supply += amount;
    } else {
      state.supply = state.supply > amount ? state.supply - amount : 0n;
    }
  }

  const supplyNum = Number(state.supply) / 10 ** DECIMALS;
  const price = supplyNum * PRICE_SLOPE;
  const marketCap = price * supplyNum;

  await saveState({
    tokenName: state.name,
    tokenAddress: addr,
    blockNumber,
    eventIndex: logIndex,
    supply: state.supply,
    price: price.toFixed(12).replace(/0+$/, ''),
    marketCap: marketCap.toFixed(8),
    txHash,
  });

  console.log(`${isBuy ? "BUY" : "SELL"} ${state.name} | Supply: ${supplyNum.toFixed(1)}M | Price: ${price.toFixed(6)} BNB | MC: ${marketCap.toFixed(1)} BNB`);
}


app.get("/latest", async (req, res) => {
  const { name, address } = req.query;

  if (!address || typeof address !== 'string' || !ethers.isAddress(address)) {
    return res.status(400).json({ error: "Invalid or missing address" });
  }

  const normalized = address.toLowerCase();

  // Start indexing if not already (initial state saved quickly, backfill async)
  await startIndexing(name as string, address as string);

  const record = await getLatestState(normalized);

  if (!record) {
    return res.status(404).json({ error: "No data yet—indexing started, try again soon" });
  }

  const supply = Number(record.supply) / 10 ** 18;
  const price = parseFloat(record.price);
  const marketCap = parseFloat(record.marketCap);

  res.json({
    tokenName: record.tokenName,
    tokenAddress: normalized,
    supply: Number(supply.toFixed(2)),
    price,
    marketCap,
    priceUsd: Number((price * BNB_PRICE_USD).toFixed(6)),
    marketCapUsd: Number((marketCap * BNB_PRICE_USD).toFixed(2)),
    lastUpdated: record.timestamp.toISOString(),
    blockNumber: record.blockNumber,
  });
});

app.listen(3001, () => {
  console.log("four.meme Indexer API running → GET http://localhost:3001/latest?address=0x...");
});