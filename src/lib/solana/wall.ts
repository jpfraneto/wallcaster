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
  state: "Listed" | "Active" | "Inactive" | "Sold";
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
  console.log("🔍 Searching for wall owned by:", wallet.toBase58());
  console.log("🔑 Using program ID:", programId.toBase58());

  try {
    const filters: GetProgramAccountsFilter[] = [
      {
        memcmp: {
          /** compare the 32-byte owner field */
          offset: OWNER_OFFSET,
          bytes: wallet.toBase58(),
        },
      },
    ];

    console.log("🔧 Applying filters:", JSON.stringify(filters));
    const accounts = await connection.getProgramAccounts(programId, {
      filters,
    });
    console.log(`🔍 Found ${accounts.length} accounts matching filter`);

    const [account] = accounts;

    if (!account) {
      console.log("❌ No wall found for this wallet");
      return null;
    }

    console.log("✅ Wall found:", account.pubkey.toBase58());

    try {
      const data = account.account.data;
      const castHashBuf = data.subarray(
        CAST_HASH_OFFSET,
        CAST_HASH_OFFSET + 32
      );
      const activatedFlag = data[ACTIVATED_OFFSET];

      const wallAccount: WallAccount = {
        pda: account.pubkey,
        owner: wallet,
        castHash: castHashBuf.some((b) => b !== 0)
          ? Buffer.from(castHashBuf).toString("hex")
          : null,
        activated: Boolean(activatedFlag),
        state: Boolean(activatedFlag) ? "Active" : "Inactive",
      };

      console.log("🧱 Wall details:", {
        pda: wallAccount.pda.toBase58(),
        owner: wallAccount.owner.toBase58(),
        activated: wallAccount.activated,
        hasCastHash: wallAccount.castHash !== null,
        state: wallAccount.activated ? "Active" : "Inactive",
      });

      return wallAccount;
    } catch (err: any) {
      console.error("❌ Error parsing wall account data:", err);
      throw new Error(`Failed to parse wall account data: ${err.message}`);
    }
  } catch (err: any) {
    console.error("❌ Error fetching wall account:", err);
    throw new Error(
      `Failed to fetch wall for owner ${wallet.toBase58()}: ${err.message}`
    );
  }
}
