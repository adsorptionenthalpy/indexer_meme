const memoryStore = new Map<
  string, // tokenAddress lowercase
  {
    tokenName: string;
    tokenAddress: string;
    blockNumber: bigint;
    eventIndex: number;
    supply: bigint;
    price: string;
    marketCap: string;
    txHash?: string;
    timestamp: Date;
  }
>();

export async function saveState(data: {
  tokenName: string;
  tokenAddress: string;
  blockNumber: bigint;
  eventIndex: number;
  supply: bigint;
  price: string;
  marketCap: string;
  txHash?: string;
}) {
  const record = {
    ...data,
    blockNumber: data.blockNumber,
    supply: data.supply,
    timestamp: new Date(),
  };

  memoryStore.set(data.tokenAddress.toLowerCase(), record);
}

export async function getLatestState(address: string) {
  const key = address.toLowerCase();
  const record = memoryStore.get(key);
  if (!record) return null;

  return {
    ...record,
    blockNumber: BigInt(record.blockNumber),
    supply: BigInt(record.supply),
    timestamp: record.timestamp,
  };
}

process.on('SIGINT', () => {
  memoryStore.clear();
  console.log('\nIndexer stopped');
  process.exit(0);
});