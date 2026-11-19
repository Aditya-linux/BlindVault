/** MagicBlock Devnet ephemeral oracle feeds (Pyth Lazer). */

export type FeedId = "sol" | "btc" | "eth";

export type PriceFeed = {
  id: FeedId;
  symbol: string;
  address: string;
};

export const PRICE_FEEDS: Record<FeedId, PriceFeed> = {
  sol: {
    id: "sol",
    symbol: "SOL/USD",
    address: "ENYwebBThHzmzwPLAQvCucUTsjyfBSZdD9ViXksS4jPu",
  },
  btc: {
    id: "btc",
    symbol: "BTC/USD",
    address: "71wtTRDY8Gxgw56bXFt2oc6qeAbTxzStdNiC425Z51sr",
  },
  eth: {
    id: "eth",
    symbol: "ETH/USD",
    address: "5vaYr1hpv8yrSpu8w3K95x22byYxUJCCNCSYJtqVWPvG",
  },
};

export const FEED_ORDER: FeedId[] = ["sol", "btc", "eth"];
