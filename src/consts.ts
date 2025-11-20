export const FACTORY_ADDRESS = "0x5c952063c7fc8610ffdb798152d69f0b9550762b";

export const SUBJECT_ABI = [
  "event Buy(address indexed buyer, uint256 amount, uint256 bnbPaid)",
  "event Sell(address indexed seller, uint256 amount, uint256 bnbReceived)",
  "event Trade(address indexed trader, uint256 amount, bool isBuy)"
];

export const PRICE_SLOPE = 0.0000105;
export const DECIMALS = 18;
export const DEFAULT_SUPPLY = 1000000000n * (10n ** BigInt(18));