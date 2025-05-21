import {
  Connection,
  PublicKey,
  GetProgramAccountsFilter,
} from "@solana/web3.js";

// ────────────────────────────────────────────────────────────
// ⚙️  1.  Layout constants (must match your on-chain struct)
//     Wall = [8-byte disc][32 registry][32 owner][32 castHash][1 activated]
// ────────────────────────────────────────────────────────────
const OWNER_OFFSET = 8 + 32; // 40
const CAST_HASH_OFFSET = OWNER_OFFSET + 32; // 72
const ACTIVATED_OFFSET = CAST_HASH_OFFSET + 32; // 104

export type WallAccount = {
  pda: PublicKey;
  owner: PublicKey;
  castHash: string | null; // hex string or null
  activated: boolean;
};

/**
 * Fetch at most one wall owned by `wallet`.
 * Returns `null` if the wallet never minted / bought a wall.
 */
export async function getWallByOwner(
  connection: Connection,
  programId: PublicKey,
  wallet: PublicKey
): Promise<WallAccount | null> {
  const filters: GetProgramAccountsFilter[] = [
    {
      memcmp: {
        /** compare the 32-byte owner field */
        offset: OWNER_OFFSET,
        bytes: wallet.toBase58(),
      },
    },
  ];

  const [account] = await connection.getProgramAccounts(programId, { filters });

  if (!account) return null;

  const data = account.account.data;
  const castHashBuf = data.subarray(CAST_HASH_OFFSET, CAST_HASH_OFFSET + 32);
  const activatedFlag = data[ACTIVATED_OFFSET];

  return {
    pda: account.pubkey,
    owner: wallet,
    castHash: castHashBuf.some((b) => b !== 0)
      ? Buffer.from(castHashBuf).toString("hex")
      : null,
    activated: Boolean(activatedFlag),
  };
}
