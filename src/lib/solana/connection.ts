import { Connection } from "@solana/web3.js";

const RPC_URL =
  "https://solana-mainnet.g.alchemy.com/v2/QvlfwedPVx_GZrUcJ64yA_A4HmoQkofN";

/** ONE singleton Connection for the whole app */
export const solanaConnection = new Connection(RPC_URL, {
  commitment: "confirmed", // -> cached responses
  disableRetryOnRateLimit: true, // -> fail fast instead of retry-storm
});
