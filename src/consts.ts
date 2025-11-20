export const FACTORY_ADDRESS = "0x5c952063c7fc8610ffdb798152d69f0b9550762b";

export const SUBJECT_ABI = [
  "event Buy(address indexed buyer, uint256 amount, uint256 bnbPaid)",
  "event Sell(address indexed seller, uint256 amount, uint256 bnbReceived)",
  "event Trade(address indexed trader, uint256 amount, bool isBuy)",
  "function getVirtualReserves() view returns (uint256 tokenReserve, uint256 bnbReserve)",
  "function decimals() view returns (uint8)",
  "function name() view returns (string)"
];

export const PRICE_SLOPE = 0.0000105;