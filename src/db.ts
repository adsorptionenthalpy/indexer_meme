import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
  await prisma.tokenState.create({
    data: {
      tokenName: data.tokenName,
      tokenAddress: data.tokenAddress.toLowerCase(),
      blockNumber: data.blockNumber.toString(),
      eventIndex: data.eventIndex,
      supply: data.supply.toString(),
      price: data.price,
      marketCap: data.marketCap,
      txHash: data.txHash,
    },
  });
}

export async function getLatestState(address: string) {
  return await prisma.tokenState.findFirst({
    where: { tokenAddress: address.toLowerCase() },
    orderBy: { id: 'desc' },
  });
}