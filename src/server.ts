import express from "express";
import { ethers } from "ethers";
import dotenv from "dotenv";
import { saveState, getLatestState } from "./db";
import { SUBJECT_ABI, PRICE_SLOPE } from "./consts";

dotenv.config();

const BNB_PRICE_USD = 800;

const app = express();
app.use(express.json());

const provider = new ethers.WebSocketProvider(process.env.RPC_URL!);

const liveState = new Map<
  string,
  { supply: bigint; name: string; decimals: number; contract: ethers.Contract }
>();

async function startIndexing(tokenName: string, tokenAddr: string) {
  const addr = tokenAddr.toLowerCase();
  if (liveState.has(addr)) return;

  const contract = new ethers.Contract(tokenAddr, SUBJECT_ABI, provider);

  let name = tokenName || "Unknown Token";
  let decimals = 18;
  let supply = 1_000_000_000n * 10n**18n; // fallback

  try {
    const reserves = await contract.getVirtualReserves();
    supply = reserves.tokenReserve;                 //  supply?
    decimals = Number(await contract.decimals());   
    name = await contract.name().catch(() => name);
  } catch (err) {
    console.log(`Warning: Using fallback values for ${tokenAddr}`);
  }

  liveState.set(addr, { supply, name, decimals, contract });

  const currentBlock = await provider.getBlockNumber();
  await updateToken(tokenAddr, 0n, true, BigInt(currentBlock), 0, "genesis");

  // Real-time listeners
contract.on("Buy", (buyer, amount, paid, ev) =>
  updateToken(tokenAddr, amount, true, BigInt(ev.blockNumber), ev.index, ev.transactionHash)
);

contract.on("Sell", (seller, amount, received, ev) =>
  updateToken(tokenAddr, amount, false, BigInt(ev.blockNumber), ev.index, ev.transactionHash)
);

contract.on("Trade", (trader, amount, isPurchase, ev) =>
  updateToken(tokenAddr, amount, !!isPurchase, BigInt(ev.blockNumber), ev.index, ev.transactionHash)
);

  console.log(`Now tracking ${name} (${tokenAddr}) — ${Number(supply)/10**decimals} tokens`);
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

  if (isBuy) {
    state.supply += amount;
  } else {
    state.supply = state.supply > amount ? state.supply - amount : 0n;
  }

  const decimals = state.decimals;
  const supplyNum = Number(state.supply) / (10 ** decimals);
  const price = supplyNum * PRICE_SLOPE;
  const marketCap = price * supplyNum;

  // Save the new state to DB
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

  // Real-time console log
  console.log(
    `${isBuy ? "BUY" : "SELL"} ${state.name} | ` +
    `Supply: ${(supplyNum / 1e6).toFixed(2)}M tokens | ` +
    `Price: ${price.toFixed(8)} BNB | ` +
    `MC: ${marketCap.toFixed(1)} BNB | ` +
    `Block: ${blockNumber}`
  );
}

app.get("/latest", async (req, res) => {

  const address = "0x83a5298f921cc42513f497cd9c4b6194e6e94444";
  const name = "PET";
  try {
  
  
  await startIndexing(name, address);

  const record = await getLatestState(address.toLowerCase());
  if (!record) {
    return res.status(503).json({ error: "Indexing started – refresh in 5s" });
  }

  const decimals = liveState.get(address.toLowerCase())?.decimals || 18;
  const supply = Number(record.supply) / (10 ** decimals);
  const price = parseFloat(record.price);
  const marketCap = parseFloat(record.marketCap);

  res.json({
    token: record.tokenName,
    address: address.toLowerCase(),
    supply: Number(supply.toFixed(2)),
    price,
    marketCap,
    priceUSD: Number((price * BNB_PRICE_USD).toFixed(6)),
    marketCapUSD: Number((marketCap * BNB_PRICE_USD).toFixed(2)),
    lastUpdated: record.timestamp.toISOString(),
    blockNumber: record.blockNumber,
  });

} catch (error) {
    return res.status(400).json({ error: 'Handled unknown error' });
  }
});

app.post("/latest", async (req, res) => {
  const { name, address } = req.body; //JSON body

  if (!address || typeof address !== "string" || !ethers.isAddress(address)) {
    return res.status(400).json({ error: "Invalid or missing address" });
  }

  try {

  await startIndexing(name, address);

  const record = await getLatestState(address.toLowerCase());
  if (!record) return res.status(503).json({ error: "Indexing started – refresh in 5s" });

  const decimals = liveState.get(address.toLowerCase())?.decimals || 18;
  const supply = Number(record.supply) / (10 ** decimals);
  const price = parseFloat(record.price);
  const marketCap = parseFloat(record.marketCap);

  res.json({
    token: record.tokenName,
    address: address.toLowerCase(),
    supply: Number(supply.toFixed(2)),
    price,
    marketCap,
    priceUSD: Number((price * BNB_PRICE_USD).toFixed(6)),
    marketCapUSD: Number((marketCap * BNB_PRICE_USD).toFixed(2)),
    lastUpdated: record.timestamp.toISOString(),
    blockNumber: record.blockNumber,
  });

} catch (error) {
    return res.status(400).json({ error: 'Handled unknown error' });
  }

});


app.listen(3001, () => {
  console.log("\nfour.meme Indexer READY");
  console.log("   → GET  http://localhost:3001/latest     (PET Token Test)");
  console.log("   → POST http://localhost:3001/latest     (JSON {name, address})\n");
});