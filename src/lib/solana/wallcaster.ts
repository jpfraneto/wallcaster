// lib/solana/wallcaster.ts
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";

export const TREASURY_PUBKEY = new PublicKey(
  "6nJXxD7VQJpnpE3tdWmM9VjTnC5mB2oREeWh5B6EHuzK"
);

export const PROGRAM_ID = new PublicKey(
  "7UhisdAH7dosM1nfF1rbBXYv1Vtgr2yd6W4B7SuZJJVx"
);

/* ---------------------------------  PDAs  --------------------------------- */
export const registryPda = () =>
  PublicKey.findProgramAddressSync([Buffer.from("registry")], PROGRAM_ID)[0];

export function wallPda(mintIndex: number): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("wall"),
      registryPda().toBuffer(),
      Buffer.from(new Uint16Array([mintIndex]).buffer),
    ],
    PROGRAM_ID
  );
  return pda;
}

/* ---------------------------  Core instructions  --------------------------- */
const DISC = {
  mint_wall: Buffer.from([254, 62, 48, 58, 150, 117, 204, 141]),
  activate_wall: Buffer.from([88, 67, 119, 10, 202, 25, 16, 165]),
  buy_wall: Buffer.from([249, 205, 81, 115, 77, 158, 27, 54]),
  list_wall: Buffer.from([161, 181, 22, 255, 201, 246, 76, 229]),
  unlist_wall: Buffer.from([191, 224, 115, 83, 170, 170, 255, 52]),
};

export function ixUnlistWall(
  wall: PublicKey,
  owner: PublicKey,
  treasury: PublicKey
): TransactionInstruction {
  return new TransactionInstruction({
    keys: [
      {
        pubkey: wall,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: owner,
        isSigner: true,
        isWritable: true, // Owner needs to be writable
      },
      {
        pubkey: treasury,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: new PublicKey("11111111111111111111111111111111"), // System program
        isSigner: false,
        isWritable: false,
      },
    ],
    programId: PROGRAM_ID,
    data: Buffer.from([191, 224, 115, 83, 170, 170, 255, 52]), // unlist_wall discriminator
  });
}

export function ixMintWall(
  payer: PublicKey,
  treasury: PublicKey,
  mintCount: number
) {
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: registryPda(), isSigner: false, isWritable: true },
      { pubkey: wallPda(mintCount), isSigner: false, isWritable: true },
      { pubkey: treasury, isSigner: false, isWritable: true },
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: DISC.mint_wall,
  });
}

// Helper function to convert hex string to 32-byte buffer
function hexStringToBuffer32(hexString: string): Buffer {
  // Remove 0x prefix if present
  const cleanHex = hexString.startsWith("0x") ? hexString.slice(2) : hexString;

  // Validate hex string
  if (!/^[0-9a-fA-F]*$/.test(cleanHex)) {
    throw new Error(`Invalid hex string: ${hexString}`);
  }

  // Convert to buffer
  let buffer = Buffer.from(cleanHex, "hex");

  // Ensure it's exactly 32 bytes
  if (buffer.length > 32) {
    // If too long, take first 32 bytes
    buffer = buffer.slice(0, 32);
  } else if (buffer.length < 32) {
    // If too short, pad with zeros
    const padded = Buffer.alloc(32);
    buffer.copy(padded);
    buffer = padded;
  }

  return buffer;
}

export function ixActivateWall(
  wall: PublicKey,
  owner: PublicKey,
  castHashHex: string
) {
  console.log("🎯 Creating activate wall instruction");
  console.log("Wall PDA:", wall.toString());
  console.log("Owner:", owner.toString());
  console.log("Cast hash input:", castHashHex);

  let castHash32: Buffer;

  try {
    castHash32 = hexStringToBuffer32(castHashHex);
    console.log("✅ Cast hash conversion successful:", {
      input: castHashHex,
      outputLength: castHash32.length,
      outputHex: castHash32.toString("hex"),
    });
  } catch (error) {
    console.error("❌ Cast hash conversion error:", error);
    console.log("Cast hash input details:", {
      input: castHashHex,
      type: typeof castHashHex,
      length: castHashHex?.length,
    });
    throw new Error(
      `Failed to convert cast hash to 32-byte buffer: ${castHashHex} - ${error}`
    );
  }

  const instruction = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: wall, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: false },
    ],
    data: Buffer.concat([DISC.activate_wall, castHash32]),
  });

  console.log("✅ Activate wall instruction created:");
  console.log("- Program ID:", instruction.programId.toString());
  console.log("- Keys:", instruction.keys);
  console.log("- Data length:", instruction.data.length);
  console.log("- Data (hex):", instruction.data.toString("hex"));
  console.log("- Discriminator:", DISC.activate_wall.toString("hex"));
  console.log("- Cast hash part:", castHash32.toString("hex"));

  return instruction;
}

export function ixListWall(
  wall: PublicKey,
  owner: PublicKey,
  price: bigint
): TransactionInstruction {
  return new TransactionInstruction({
    keys: [
      {
        pubkey: wall,
        isSigner: false,
        isWritable: true,
      },
      {
        pubkey: owner,
        isSigner: true,
        isWritable: false,
      },
    ],
    programId: PROGRAM_ID,
    data: Buffer.concat([
      // Discriminator for list_wall
      Buffer.from([161, 181, 22, 255, 201, 246, 76, 229]),
      // Price as u64 little endian
      (() => {
        const buf = Buffer.alloc(8);
        buf.writeBigUInt64LE(price, 0);
        return buf;
      })(),
    ]),
  });
}

export function ixBuyWall(
  wall: PublicKey,
  seller: PublicKey,
  buyer: PublicKey,
  treasury: PublicKey
) {
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: wall, isSigner: false, isWritable: true },
      { pubkey: seller, isSigner: false, isWritable: true },
      { pubkey: buyer, isSigner: true, isWritable: true },
      { pubkey: treasury, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: DISC.buy_wall,
  });
}

/* -------------------------------  Helpers  -------------------------------- */
export async function sendTx(
  conn: Connection,
  walletProvider: any,
  ixs: TransactionInstruction[]
) {
  const { publicKey } = await walletProvider.request({ method: "connect" });
  const payer = new PublicKey(publicKey as string);

  const { blockhash } = await conn.getLatestBlockhash("finalized");
  const tx = new Transaction({ feePayer: payer, recentBlockhash: blockhash });
  tx.add(...ixs);

  const { signature } = await walletProvider.signAndSendTransaction({
    transaction: tx,
    network: "mainnet-beta",
  });

  await conn.confirmTransaction(signature, "confirmed");
  return signature;
}
