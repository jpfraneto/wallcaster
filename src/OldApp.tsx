// src/App.tsx
/* eslint-disable @typescript-eslint/ban-ts-comment */
import { useState, useEffect, useMemo, useCallback } from "react";
import { AlertCircle, ShoppingBag, X, Check, Tag } from "lucide-react";
import {
  Connection,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { AnchorProvider, Program, BN } from "@project-serum/anchor";
import { useAnchorWallet } from "@solana/wallet-adapter-react";
import idl from "./idl/wallcaster.json";
import sdk from "@farcaster/frame-sdk";
import { Buffer } from "buffer";

// ──────────────────────────────────────────────────────────
// Browser poly-fill (Anchor PDA helpers expect Buffer global)
// ──────────────────────────────────────────────────────────
if (!(window as any).Buffer) (window as any).Buffer = Buffer;

// ──────────────────────────────────────────────────────────
// Constants – change only if your on-chain values move
// ──────────────────────────────────────────────────────────
const RPC_ENDPOINT =
  "https://solana-mainnet.g.alchemy.com/v2/QvlfwedPVx_GZrUcJ64yA_A4HmoQkofN";
const PROGRAM_ID = new PublicKey(
  "7UhisdAH7dosM1nfF1rbBXYv1Vtgr2yd6W4B7SuZJJVx"
);
const TREASURY = new PublicKey("6nJXxD7VQJpnpE3tdWmM9VjTnC5mB2oREeWh5B6EHuzK");
const TOTAL_SUPPLY = 888;
// const MINT_PRICE_LAMPORTS = 6_900_000; // 0.0069 SOL

// ──────────────────────────────────────────────────────────
// Type helpers
// ──────────────────────────────────────────────────────────
export interface WallAccount {
  owner: PublicKey;
  state: number;
  price: BN;
  castHash: Uint8Array; // 32 bytes
}
interface WallUI {
  id: number;
  pubkey: string;
  owner: string;
  listed: boolean;
  priceSol: number;
  castHash: string;
}

// ──────────────────────────────────────────────────────────
// Main component
// ──────────────────────────────────────────────────────────
const App = () => {
  // 1.  Wallet / network / Anchor glue
  const wallet = useAnchorWallet();
  const connection = useMemo(
    () => new Connection(RPC_ENDPOINT, "confirmed"),
    []
  );
  const provider = useMemo(
    () =>
      wallet
        ? new AnchorProvider(connection, wallet, { commitment: "confirmed" })
        : null,
    [connection, wallet]
  );
  const program = useMemo(
    () => (provider ? new Program(idl as any, PROGRAM_ID, provider) : null),
    [provider]
  );

  // 2.  PDA helpers
  const registryPda = useMemo(
    () =>
      PublicKey.findProgramAddressSync(
        [Buffer.from("registry")],
        PROGRAM_ID
      )[0],
    []
  );

  // 3.  UI state
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{
    msg: string;
    ok?: boolean;
  } | null>(null);
  const [registryMinted, setRegistryMinted] = useState<number>(0);
  const [walls, setWalls] = useState<WallUI[]>([]);
  const [market, setMarket] = useState<WallUI[]>([]);
  const [showMarket, setShowMarket] = useState(false);
  const [priceInput, setPriceInput] = useState("");
  const [selectedWall, setSelectedWall] = useState<string | null>(null);
  const [activeCastHash, setActiveCastHash] = useState<string>("");

  // 4.  Farcaster frame context (only needed once)
  useEffect(() => {
    (async () => {
      try {
        await sdk.actions.ready();
        const ctx = await sdk.context;
        if (ctx.location?.type === "cast_embed") {
          setActiveCastHash(ctx.location.cast.hash);
        }
      } catch (e) {
        console.error("Frame-SDK init error", e);
      }
    })();
  }, []);

  // 5.  Registry & wallet walls
  const fetchRegistry = useCallback(async () => {
    if (!program) return;
    const data: any = await program.account.registry.fetch(registryPda);
    setRegistryMinted(data.mintCount.toNumber());
  }, [program, registryPda]);

  const fetchWalletWalls = useCallback(async () => {
    if (!program || !wallet) return;
    setLoading(true);
    try {
      const owned = await program.account.wall.all([
        {
          memcmp: {
            offset: 8, // discriminator
            bytes: wallet.publicKey.toBase58(),
          },
        },
      ]);

      setWalls(
        owned.map((acc, i) => {
          const w: WallAccount = acc.account as any;
          return {
            id: i,
            pubkey: acc.publicKey.toBase58(),
            owner: w.owner.toBase58(),
            listed: w.state === 2,
            priceSol: w.state === 2 ? w.price.toNumber() / LAMPORTS_PER_SOL : 0,
            castHash: Buffer.from(w.castHash).toString("hex"),
          };
        })
      );
    } finally {
      setLoading(false);
    }
  }, [program, wallet]);

  const fetchMarket = useCallback(async () => {
    if (!program) return;
    setLoading(true);
    try {
      const all = await program.account.wall.all();
      setMarket(
        all
          .filter((a) => (a.account as any).state === 2)
          .map((acc, i) => {
            const w: WallAccount = acc.account as any;
            return {
              id: i,
              pubkey: acc.publicKey.toBase58(),
              owner: w.owner.toBase58(),
              listed: true,
              priceSol: w.price.toNumber() / LAMPORTS_PER_SOL,
              castHash: Buffer.from(w.castHash).toString("hex"),
            };
          })
      );
    } finally {
      setLoading(false);
    }
  }, [program]);

  // Refresh when program / wallet becomes ready
  useEffect(() => {
    if (program) fetchRegistry();
    if (wallet) fetchWalletWalls();
  }, [program, wallet, fetchRegistry, fetchWalletWalls]);

  // 6.  On-chain actions (mint / activate / list / unlist / buy)
  const mintWall = useCallback(async () => {
    if (!program || !wallet) return notify("Connect your wallet first");
    setLoading(true);
    try {
      const wallIdx = registryMinted;
      const [wallPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("wall"),
          registryPda.toBuffer(),
          new BN(wallIdx).toArrayLike(Buffer, "le", 8),
        ],
        PROGRAM_ID
      );

      await program.methods
        .mintWall()
        .accounts({
          registry: registryPda,
          wall: wallPda,
          treasury: TREASURY,
          payer: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc({ commitment: "confirmed" });

      notify(`Wall #${wallIdx} minted (0.0069 SOL)`, true);
      fetchRegistry();
      fetchWalletWalls();
    } catch (e: any) {
      notify(e.message || "Mint failed");
    } finally {
      setLoading(false);
    }
  }, [
    program,
    wallet,
    registryMinted,
    registryPda,
    fetchRegistry,
    fetchWalletWalls,
  ]);

  const activateWall = useCallback(
    async (wallPk: string) => {
      if (!program || !wallet) return notify("Connect your wallet first");
      if (!activeCastHash)
        return notify("Open the mini-app from the cast you want as hash");
      setLoading(true);
      try {
        await program.methods
          .activateWall(activeCastHash)
          .accounts({
            wall: new PublicKey(wallPk),
            owner: wallet.publicKey,
          })
          .rpc({ commitment: "confirmed" });

        notify("Wall activated 🎉", true);
        fetchWalletWalls();
      } catch (e: any) {
        notify(e.message || "Activation failed");
      } finally {
        setLoading(false);
      }
    },
    [program, wallet, activeCastHash, fetchWalletWalls]
  );

  const listWall = useCallback(
    async (wallPk: string, priceSol: number) => {
      if (!program || !wallet) return notify("Connect your wallet first");
      setLoading(true);
      try {
        await program.methods
          .listWall(new BN(priceSol * LAMPORTS_PER_SOL))
          .accounts({
            wall: new PublicKey(wallPk),
            owner: wallet.publicKey,
          })
          .rpc({ commitment: "confirmed" });

        notify(`Listed for ${priceSol} SOL`, true);
        fetchWalletWalls();
      } catch (e: any) {
        notify(e.message || "Listing failed");
      } finally {
        setLoading(false);
      }
    },
    [program, wallet, fetchWalletWalls]
  );

  const unlistWall = useCallback(
    async (wallPk: string) => {
      if (!program || !wallet) return notify("Connect your wallet first");
      setLoading(true);
      try {
        await program.methods
          .unlistWall()
          .accounts({
            wall: new PublicKey(wallPk),
            owner: wallet.publicKey,
            treasury: TREASURY,
            systemProgram: SystemProgram.programId,
          })
          .rpc({ commitment: "confirmed" });

        notify("Unlisted (8 % fee charged)", true);
        fetchWalletWalls();
      } catch (e: any) {
        notify(e.message || "Unlist failed");
      } finally {
        setLoading(false);
      }
    },
    [program, wallet, fetchWalletWalls]
  );

  const buyWall = useCallback(
    async (wall: WallUI) => {
      if (!program || !wallet) return notify("Connect your wallet first");
      setLoading(true);
      try {
        await program.methods
          .buyWall()
          .accounts({
            wall: new PublicKey(wall.pubkey),
            seller: new PublicKey(wall.owner),
            buyer: wallet.publicKey,
            treasury: TREASURY,
            systemProgram: SystemProgram.programId,
          })
          .rpc({ commitment: "confirmed" });

        notify(`Bought for ${wall.priceSol} SOL`, true);
        fetchWalletWalls();
        fetchMarket();
      } catch (e: any) {
        notify(e.message || "Buy failed");
      } finally {
        setLoading(false);
      }
    },
    [program, wallet, fetchWalletWalls, fetchMarket]
  );

  // 7.  Helpers
  const notify = (msg: string, ok = false) => {
    setNotification({ msg, ok });
    setTimeout(() => setNotification(null), 5_000);
  };

  // ────────────────────────────────────────────────────────
  // UI
  // ────────────────────────────────────────────────────────
  if (!wallet)
    return (
      <ScreenCenter>
        <p className="mb-6 text-gray-600">your cozy corner on the internet</p>
      </ScreenCenter>
    );

  return (
    <div className="min-h-screen bg-gray-50">
      <Header
        toggleMarket={() => {
          if (!showMarket) fetchMarket();
          setShowMarket(!showMarket);
        }}
      />

      <main className="max-w-lg mx-auto p-4">
        {notification && (
          <Toast ok={notification.ok} onClose={() => setNotification(null)}>
            {notification.msg}
          </Toast>
        )}

        {loading && <Spinner />}

        {!loading && (
          <>
            {/* mint button */}
            {registryMinted < TOTAL_SUPPLY && (
              <MintBanner
                remaining={TOTAL_SUPPLY - registryMinted}
                onMint={mintWall}
              />
            )}

            {/* walls or marketplace */}
            {showMarket ? (
              market.length ? (
                market.map((w) => (
                  <WallCard key={w.pubkey} wall={w} market buyWall={buyWall} />
                ))
              ) : (
                <Empty msg="No walls listed for sale" />
              )
            ) : walls.length ? (
              walls.map((w) => (
                <WallCard
                  key={w.pubkey}
                  wall={w}
                  activateWall={activateWall}
                  listWall={listWall}
                  unlistWall={unlistWall}
                  priceInput={priceInput}
                  setPriceInput={setPriceInput}
                  selectedWall={selectedWall}
                  setSelectedWall={setSelectedWall}
                />
              ))
            ) : (
              <Empty msg="You don't own any walls yet" />
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default App;

// ──────────────────────────────────────────────────────────
// Small presentational components
// (all purely visual – no state, no hooks)
// ──────────────────────────────────────────────────────────
const Header = ({ toggleMarket }: { toggleMarket: () => void }) => (
  <div className="relative w-full h-24 overflow-hidden bg-gradient-to-r from-purple-500 via-pink-500 to-red-500">
    <div
      className="absolute inset-0 bg-[radial-gradient(circle,_transparent_20%,_#8b5cf6_20%,_#8b5cf6_30%,_transparent_30%,_transparent_40%,_#d946ef_40%,_#d946ef_50%,_transparent_50%,_transparent_60%,_#ec4899_60%,_#ec4899_70%,_transparent_70%)] bg-opacity-30"
      style={{ backgroundSize: "20px 20px" }}
    />
    <div className="relative flex items-center justify-center h-full">
      <h1 className="text-4xl font-bold text-white tracking-wider">
        Wallcaster
      </h1>
    </div>
    <button
      onClick={toggleMarket}
      className="absolute top-4 right-4 p-2 bg-white rounded-full shadow hover:shadow-lg"
    >
      <ShoppingBag className="h-6 w-6 text-purple-600" />
    </button>
  </div>
);

const ScreenCenter: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
    {children}
  </div>
);

const Spinner = () => (
  <div className="text-center py-8">
    <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
    <p className="text-gray-500">Loading…</p>
  </div>
);

const Toast: React.FC<{
  ok?: boolean;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ ok, onClose, children }) => (
  <div
    className={`mb-4 p-3 rounded flex items-center ${
      ok ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
    }`}
  >
    {ok ? (
      <Check className="w-5 h-5 mr-2" />
    ) : (
      <AlertCircle className="w-5 h-5 mr-2" />
    )}
    {children}
    <button onClick={onClose} className="ml-auto">
      <X className="w-4 h-4" />
    </button>
  </div>
);

const Empty = ({ msg }: { msg: string }) => (
  <div className="text-center py-8 text-gray-500">{msg}</div>
);

const MintBanner = ({
  remaining,
  onMint,
}: {
  remaining: number;
  onMint: () => void;
}) => (
  <div className="mb-6 text-center">
    <button
      onClick={onMint}
      className="mb-2 px-6 py-3 bg-purple-600 text-white rounded-lg shadow hover:bg-purple-700"
    >
      Mint Wall (0.0069 SOL)
    </button>
    <div className="text-xs text-purple-600">
      supply – {remaining} / {TOTAL_SUPPLY} remaining
    </div>
  </div>
);

interface CardProps {
  wall: WallUI;
  market?: boolean;
  buyWall?: (w: WallUI) => void;
  activateWall?: (pk: string) => void;
  listWall?: (pk: string, price: number) => void;
  unlistWall?: (pk: string) => void;
  selectedWall?: string | null;
  setSelectedWall?: (pk: string | null) => void;
  priceInput?: string;
  setPriceInput?: (v: string) => void;
}

const WallCard: React.FC<CardProps> = ({
  wall,
  market,
  buyWall,
  activateWall,
  listWall,
  unlistWall,
  selectedWall,
  setSelectedWall,
  priceInput,
  setPriceInput,
}) => {
  const isSelected = selectedWall === wall.pubkey;
  return (
    <div
      className={`p-4 mb-4 rounded border ${
        wall.listed
          ? "border-green-400 bg-green-50"
          : "border-gray-200 bg-white"
      }`}
    >
      <div className="flex justify-between mb-2">
        <h3 className="font-medium">Wall #{wall.id}</h3>
        {wall.listed && <Tag className="h-4 w-4 text-green-600" />}
      </div>

      <p className="text-sm text-gray-600 mb-1">
        Owner: {wall.owner.slice(0, 4)}…{wall.owner.slice(-4)}
      </p>

      {wall.listed && (
        <p className="text-sm font-medium text-green-600 mb-2">
          Listed: {wall.priceSol} SOL
        </p>
      )}

      <p className="text-xs text-gray-500 truncate mb-3">
        Hash:{" "}
        {wall.castHash ? wall.castHash.slice(0, 18) + "…" : "Not activated"}
      </p>

      {/* action buttons */}
      <div className="flex justify-end space-x-2">
        {market ? (
          <button
            onClick={() => buyWall?.(wall)}
            className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
          >
            Buy for {wall.priceSol} SOL
          </button>
        ) : wall.listed ? (
          <button
            onClick={() => unlistWall?.(wall.pubkey)}
            className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
          >
            Unlist
          </button>
        ) : (
          <>
            {!wall.castHash ||
            wall.castHash ===
              "0000000000000000000000000000000000000000000000000000000000000000" ? (
              <button
                onClick={() => activateWall?.(wall.pubkey)}
                className="px-3 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
              >
                Activate
              </button>
            ) : null}

            <button
              onClick={() => setSelectedWall?.(isSelected ? null : wall.pubkey)}
              className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
            >
              List
            </button>
          </>
        )}
      </div>

      {/* list price input */}
      {isSelected && (
        <div className="mt-3 p-3 bg-gray-50 rounded border">
          <input
            type="number"
            placeholder="Price in SOL"
            value={priceInput}
            onChange={(e) => setPriceInput?.(e.target.value)}
            className="w-full mb-2 px-2 py-1 text-sm border rounded"
            min="0.01"
            step="0.01"
          />
          <div className="flex justify-end space-x-2">
            <button
              onClick={() => setSelectedWall?.(null)}
              className="px-2 py-1 text-xs bg-gray-200 rounded hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                const p = parseFloat(priceInput || "0");
                if (p > 0) listWall?.(wall.pubkey, p);
              }}
              className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Confirm
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
