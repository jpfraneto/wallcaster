/* ──────────────────────────────────────────────────────────────
 *  App.tsx – Fricks Frame v2 mini-app (OPTIMIZED)
 *  "mint. activate. have fun."
 * ──────────────────────────────────────────────────────────── */
const API_URL = "https://poiesis.anky.app";

import { useState, useEffect, useCallback, useRef } from "react";
import sdk, { type Context } from "@farcaster/frame-sdk";
import { Transaction, PublicKey } from "@solana/web3.js";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import { Shuffle, Zap, Plus, Loader } from "lucide-react";

import {
  useConnection as useSolanaConnection,
  useWallet as useSolanaWallet,
} from "@solana/wallet-adapter-react";

import {
  PROGRAM_ID,
  TREASURY_PUBKEY,
  registryPda,
  ixMintWall,
  ixActivateWall,
} from "./lib/solana/wallcaster";

import { useOwnedWall } from "./hooks/useWall";
import { ActivatedWall } from "./types/Wall";
import UserWallDisplay from "./components/ui/walls/UserWallDisplay";

const TOTAL_SUPPLY = 888;
const MINT_PRICE_SOL = "0.0069420";

interface InactiveWall {
  pda: string;
  owner: string;
  username: string;
  pfp: string | null;
  fid: number;
}

interface GridWall {
  castHash: string;
  username: string;
  pfp: string;
  fid: number;
  isActive: boolean;
}

export default function App() {
  /* Frame context */
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [context, setContext] = useState<Context.FrameContext>();
  const [_castHashHex, setCastHashHex] = useState<string>();
  const [userHasMinted, setUserHasMinted] = useState(false);

  const [activatedWalls, setActivatedWalls] = useState<ActivatedWall[]>([]);
  const [_inactiveWalls, setInactiveWalls] = useState<InactiveWall[]>([]);
  const [currentGrid, setCurrentGrid] = useState<GridWall[]>([]);
  const [displayWallModal, setDisplayWallModal] = useState(false);
  const [chosenWall, setChosenWall] = useState<GridWall | null>(null);

  /* Supply tracking */
  const [currentSupply, setCurrentSupply] = useState<number>(0);
  const [totalInactiveWalls, setTotalInactiveWalls] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [mintState, setMintState] = useState<
    | { status: "none" }
    | { status: "pending" }
    | { status: "error"; error: Error }
    | { status: "success"; signature: string }
  >({ status: "none" });

  /* UI state */
  const [currentView, setCurrentView] = useState<"grid" | "mint">("grid");
  const [_initialData, setInitialData] = useState<any>(null);

  // Add state to track user's wall after minting
  const [userWallState, setUserWallState] = useState<{
    pda: string | null;
    state: "Inactive" | "Active" | "Listed" | null;
    castHash: string | null;
  }>({ pda: null, state: null, castHash: null });

  /* Solana wallet integration */
  const { publicKey, sendTransaction } = useSolanaWallet();
  const { connection } = useSolanaConnection();
  const solanaAddress = publicKey?.toBase58();

  /* SDK initialization */
  const apiCallMade = useRef(false);
  const [walletBalance, setWalletBalance] = useState<number>(0);

  /* Generate random grid from available walls */
  const generateRandomGrid = useCallback(() => {
    const shuffled = activatedWalls
      .sort(() => 0.5 - Math.random())
      .slice(0, 36);

    while (shuffled.length < 36 && activatedWalls.length > 0) {
      const randomActive =
        activatedWalls[Math.floor(Math.random() * activatedWalls.length)];
      if (
        !randomActive?.pfp ||
        !randomActive?.castHash ||
        !randomActive?.username ||
        !randomActive?.fid
      )
        continue;

      shuffled.push({
        castHash: randomActive.castHash,
        username: randomActive.username,
        pfp: randomActive.pfp,
        fid: randomActive.fid,
        pda: randomActive.pda,
        owner: randomActive.owner,
      });
    }

    setCurrentGrid(shuffled as unknown as GridWall[]);
  }, [activatedWalls]);

  // OPTIMIZATION 1: Call sdk.actions.ready() IMMEDIATELY
  useEffect(() => {
    const initializeSDK = async () => {
      if (!isSDKLoaded) {
        setIsSDKLoaded(true);

        // Call ready() FIRST - this is crucial for performance
        await sdk.actions.ready({});
        console.log("✅ SDK ready called immediately");

        // THEN get context
        const frameContext = await sdk.context;
        setContext(frameContext);

        if (frameContext?.location?.type === "cast_embed") {
          setCastHashHex(frameContext.location.cast.hash);
        }
      }
    };

    initializeSDK();
  }, [isSDKLoaded]);

  // OPTIMIZATION 2: Separate data loading from SDK initialization
  useEffect(() => {
    const loadAppData = async () => {
      if (!context?.user.fid || apiCallMade.current) return;

      apiCallMade.current = true;

      try {
        let castHashHere = "";
        if (context.location?.type === "cast_embed") {
          castHashHere = context.location.cast.hash;
        }

        // OPTIMIZATION 3: Use Promise.all for parallel requests when possible
        const [apiResponse] = await Promise.all([
          axios.get(
            `${API_URL}/wallcaster/setup-app-for-fid/${context.user.fid}?castHash=${castHashHere}&solanaAddress=${solanaAddress}&frameContext=${context?.location?.type}`
          ),
          // Add wallet balance fetch here if needed
          solanaAddress && connection
            ? connection
                .getBalance(publicKey!)
                .then((balance) => setWalletBalance(balance / 1e9))
                .catch(console.error)
            : Promise.resolve(),
        ]);

        const data = apiResponse.data.data;
        console.log("📊 API data loaded:", data);

        // OPTIMIZATION 4: Batch state updates
        setActivatedWalls(data.activatedWalls || []);
        setInactiveWalls(data.inactiveWalls || []);
        setCurrentSupply(data.stats?.totalMinted || 0);
        setTotalInactiveWalls(data.stats?.totalInactiveWalls || 0);
        setInitialData(data);

        // Check user wall state
        const userActiveWall = data.activatedWalls?.find(
          (wall: ActivatedWall) => wall.fid === context.user.fid
        );
        const userInactiveWall = data.inactiveWalls?.find(
          (wall: InactiveWall) => wall.fid === context.user.fid
        );
        const userWall = userActiveWall || userInactiveWall;

        if (userWall) {
          setUserWallState({
            pda: userWall.pda,
            state: userWall.state || (userActiveWall ? "Active" : "Inactive"),
            castHash: userWall.castHash || null,
          });
          setUserHasMinted(true);
        }
      } catch (error) {
        console.error("❌ Error loading app data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadAppData();
  }, [context, solanaAddress, publicKey, connection]);

  // OPTIMIZATION 5: Separate wallet balance loading
  useEffect(() => {
    const fetchBalance = async () => {
      if (!publicKey || !connection) return;
      try {
        const balance = await connection.getBalance(publicKey);
        setWalletBalance(balance / 1e9);
      } catch (error) {
        console.error("Error fetching balance:", error);
      }
    };

    // Only fetch if we don't have it yet
    if (publicKey && connection && walletBalance === 0) {
      fetchBalance();
    }
  }, [publicKey, connection]);

  /* Generate initial grid when data loads */
  useEffect(() => {
    if (activatedWalls.length > 0) {
      generateRandomGrid();
    }
  }, [activatedWalls, generateRandomGrid]);

  /* Derive PDA for the current user */
  const { wall } = useOwnedWall(
    connection,
    PROGRAM_ID.toBase58(),
    solanaAddress ?? null
  );

  /* Mint function - OPTIMIZED */
  const mint = useCallback(async () => {
    console.log("🎯 Starting mint process...");

    if (!publicKey || !connection) {
      setMintState({
        status: "error",
        error: new Error("Wallet not connected"),
      });
      return;
    }

    if (wall?.pda || userWallState.pda) {
      setMintState({
        status: "error",
        error: new Error(
          "You already own a wall! Each wallet can only mint one wall."
        ),
      });
      return;
    }

    setMintState({ status: "pending" });

    try {
      if (currentSupply >= TOTAL_SUPPLY) {
        throw new Error("All 888 walls have been minted!");
      }

      // OPTIMIZATION: Batch blockchain calls
      const [account, { blockhash }] = await Promise.all([
        connection.getAccountInfo(registryPda()),
        connection.getLatestBlockhash(),
      ]);

      if (!account) throw new Error("Registry not initialized");
      if (!blockhash)
        throw new Error("Failed to fetch latest Solana blockhash");

      const mintCount = account.data.readUInt16LE(8 + 32 + 32);
      const [wallPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("wall"),
          registryPda().toBuffer(),
          Buffer.from([mintCount & 0xff, (mintCount >> 8) & 0xff]),
        ],
        PROGRAM_ID
      );

      const transaction = new Transaction();
      transaction.add(ixMintWall(publicKey, TREASURY_PUBKEY, mintCount));
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      const signature = await sendTransaction(transaction, connection);

      // Update state optimistically
      setUserWallState({
        pda: wallPda.toBase58(),
        state: "Inactive",
        castHash: null,
      });
      setUserHasMinted(true);
      setCurrentSupply((prev) => prev + 1);
      setMintState({ status: "success", signature });

      setTimeout(() => setCurrentView("grid"), 2000);
    } catch (error: any) {
      console.error("❌ Mint error:", error);
      setMintState({
        status: "error",
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }, [
    publicKey,
    sendTransaction,
    connection,
    currentSupply,
    wall,
    userWallState.pda,
  ]);

  // Add activation state tracking
  const [activationState, setActivationState] = useState<
    | { status: "idle" }
    | { status: "creating_cast" }
    | { status: "pending_activation" }
    | { status: "success"; signature: string }
    | { status: "error"; error: string }
  >({ status: "idle" });

  const handleActivateWall = useCallback(
    async (castHash: string) => {
      const wallToActivate = userWallState.pda;

      if (!publicKey || !connection || !wallToActivate) {
        setActivationState({
          status: "error",
          error: "Wallet not connected or no wall found",
        });
        return;
      }

      setActivationState({ status: "pending_activation" });

      try {
        const wallPublicKey = new PublicKey(wallToActivate);

        // OPTIMIZATION: Batch validation calls
        const [wallAccount, { blockhash, lastValidBlockHeight }] =
          await Promise.all([
            connection.getAccountInfo(wallPublicKey),
            connection.getLatestBlockhash(),
          ]);

        if (!wallAccount || !wallAccount.owner.equals(PROGRAM_ID)) {
          throw new Error("Wall account not found or invalid");
        }

        // Validate ownership and state
        const wallData = wallAccount.data;
        const ownerBytes = wallData.slice(8, 8 + 32);
        const wallOwner = new PublicKey(ownerBytes);

        if (!wallOwner.equals(publicKey)) {
          throw new Error("You don't own this wall");
        }

        const stateOffset = 8 + 32 + 32 + 8;
        const currentState = wallData[stateOffset];

        if (currentState === 1) throw new Error("Wall is already activated");
        if (currentState === 2)
          throw new Error("Wall is listed - cannot activate while listed");

        // Build transaction
        const activateInstruction = ixActivateWall(
          wallPublicKey,
          publicKey,
          castHash
        );
        const transaction = new Transaction();
        transaction.add(activateInstruction);
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = publicKey;

        // Simulate first
        const simulation = await connection.simulateTransaction(transaction);
        if (simulation.value.err) {
          throw new Error(
            `Transaction simulation failed: ${JSON.stringify(
              simulation.value.err
            )}`
          );
        }

        const signature = await sendTransaction(transaction, connection, {
          maxRetries: 3,
        });
        const confirmation = await connection.confirmTransaction({
          signature,
          blockhash,
          lastValidBlockHeight,
        });

        if (confirmation.value.err) {
          throw new Error(`Transaction failed: ${confirmation.value.err}`);
        }

        // Update state
        setUserWallState((prev) => ({
          ...prev,
          state: "Active",
          castHash: castHash,
        }));
        setActivationState({ status: "success", signature });
        generateRandomGrid();
      } catch (error: any) {
        console.error("❌ Activation failed:", error);
        setActivationState({
          status: "error",
          error: error.message || "Unknown error occurred",
        });
      }
    },
    [
      publicKey,
      connection,
      userWallState.pda,
      sendTransaction,
      generateRandomGrid,
    ]
  );

  const initiateActivation = useCallback(async () => {
    setActivationState({ status: "creating_cast" });

    try {
      const activationCast = await sdk.actions.composeCast({
        text: "this cast will be my frick\n\n(and i don't know what im doing)",
        embeds: ["https://fricks.lat"],
      });

      if (activationCast.cast?.hash) {
        await handleActivateWall(activationCast.cast.hash);
      }
    } catch (error: any) {
      console.error("❌ Cast creation failed:", error);
      setActivationState({
        status: "error",
        error: `Failed to create cast: ${error.message}`,
      });
    }
  }, [handleActivateWall]);

  const handleWallClick = useCallback((gridWall: GridWall) => {
    setDisplayWallModal(true);
    setChosenWall(gridWall);
  }, []);

  /* ——————————————————— render ——————————————————— */
  // OPTIMIZATION 6: Show loading only for data, not SDK
  if (!isSDKLoaded) return splash("Loading SDK…");
  if (!solanaAddress) return splash("load this inside warpcast");

  const isSoldOut = currentSupply >= TOTAL_SUPPLY;
  const userOwnsWall = wall?.pda || userWallState.pda;
  const userWallIsInactive =
    wall?.state === "Inactive" || userWallState.state === "Inactive";
  const canMint = !userOwnsWall && !userHasMinted && !isSoldOut;

  // Get primary action
  const getPrimaryAction = () => {
    if (loading)
      return {
        text: "LOADING",
        action: () => console.log("loading"),
        color: "bg-purple-600 hover:bg-purple-700",
        icon: <Loader className="w-5 h-5" />,
      };
    if (currentView === "grid") {
      if (canMint) {
        return {
          text: "MINT YOUR FRICK",
          action: () => setCurrentView("mint"),
          color: "bg-purple-600 hover:bg-purple-700",
          icon: <Plus className="w-5 h-5" />,
        };
      } else if (userOwnsWall && userWallIsInactive) {
        return {
          text:
            activationState.status === "creating_cast"
              ? "CREATING CAST..."
              : activationState.status === "pending_activation"
              ? "ACTIVATING..."
              : "ACTIVATE YOUR FRICK",
          action: initiateActivation,
          color: "bg-green-600 hover:bg-green-700",
          icon: <Zap className="w-5 h-5" />,
          disabled:
            activationState.status === "creating_cast" ||
            activationState.status === "pending_activation",
        };
      } else {
        return {
          text: "SEE MORE",
          action: generateRandomGrid,
          color: "bg-blue-600 hover:bg-blue-700",
          icon: <Shuffle className="w-5 h-5" />,
        };
      }
    } else {
      if (walletBalance < 0.006942) {
        return {
          text: "GET SOL TO MINT",
          action: () => {
            sdk.actions.swapToken({
              sellToken: "",
              buyToken: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp/slip44:501",
              sellAmount: "69420000000",
            });
          },
          color: "bg-yellow-600 hover:bg-yellow-700",
        };
      } else {
        return {
          text: mintState.status === "pending" ? "MINTING..." : "MINT NOW",
          action: mint,
          color: "bg-purple-600 hover:bg-purple-700",
          disabled: mintState.status === "pending",
        };
      }
    }
  };

  const primaryAction = getPrimaryAction();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="h-screen w-screen flex flex-col bg-gray-900 text-white overflow-hidden"
      style={{
        paddingTop: context?.client.safeAreaInsets?.top ?? 0,
        paddingBottom: context?.client.safeAreaInsets?.bottom ?? 0,
        paddingLeft: context?.client.safeAreaInsets?.left ?? 0,
        paddingRight: context?.client.safeAreaInsets?.right ?? 0,
      }}
    >
      {/* Main Content Area */}
      <div className="flex-1 mb-20 overflow-y-auto">
        <AnimatePresence mode="wait">
          {currentView === "grid" && (
            <motion.div
              key="grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="p-4 space-y-6"
            >
              {/* Header */}
              <div className="text-center space-y-2">
                <motion.h1
                  className="text-3xl font-bold"
                  animate={{
                    background: [
                      "linear-gradient(45deg, #ffffff, #a855f7)",
                      "linear-gradient(45deg, #a855f7, #06b6d4)",
                      "linear-gradient(45deg, #06b6d4, #ffffff)",
                    ],
                  }}
                  transition={{ duration: 3, repeat: Infinity }}
                  style={{
                    backgroundClip: "text",
                    WebkitBackgroundClip: "text",
                    color: "white",
                  }}
                >
                  $fricks
                </motion.h1>
                <p className="text-sm opacity-80">
                  tap to write on someone's frick
                </p>

                <div className="flex justify-center gap-4 text-xs opacity-70">
                  <span>
                    {currentSupply}/{TOTAL_SUPPLY} minted
                  </span>
                  <span>{activatedWalls.length} active</span>
                  <span>{totalInactiveWalls} inactive</span>
                </div>
              </div>

              {/* Status Messages */}
              {activationState.status === "creating_cast" && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-yellow-900/20 border border-yellow-500 rounded-lg p-3 text-center"
                >
                  <div className="text-yellow-400 font-semibold mb-1">
                    ✍️ Creating your cast...
                  </div>
                  <div className="text-xs opacity-80">
                    Complete the cast creation in Warpcast
                  </div>
                </motion.div>
              )}

              {activationState.status === "pending_activation" && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-blue-900/20 border border-blue-500 rounded-lg p-3 text-center"
                >
                  <div className="text-blue-400 font-semibold mb-1">
                    ⛓️ Activating on blockchain...
                  </div>
                  <div className="text-xs opacity-80">
                    Confirming your transaction on Solana
                  </div>
                </motion.div>
              )}

              {activationState.status === "success" && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-green-900/20 border border-green-500 rounded-lg p-3 text-center"
                >
                  <div className="text-green-400 font-semibold mb-1">
                    🎉 Frick activated!
                  </div>
                  <a
                    href={`https://solscan.io/tx/${activationState.signature}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 underline text-xs hover:text-blue-300"
                  >
                    View transaction
                  </a>
                  <button
                    onClick={async () => {
                      const response = await sdk.actions.composeCast({
                        parent: {
                          type: "cast" as const,
                          hash: userWallState.castHash!,
                        },
                        text: "writing on my frick for the first time",
                      });
                      console.log("Cast response:", response);
                    }}
                    className="mx-3 px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-xs font-medium transition-colors"
                  >
                    ✍️ Write on Your Frick
                  </button>
                </motion.div>
              )}

              {activationState.status === "error" && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-red-900/20 border border-red-500/30 rounded-lg p-3"
                >
                  <div className="text-red-400 font-semibold mb-1">
                    ❌ Activation Failed
                  </div>
                  <div className="text-red-300 text-xs mb-2">
                    {activationState.error}
                  </div>
                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={initiateActivation}
                      className="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-xs font-medium transition-colors"
                    >
                      🔄 Try Again
                    </button>
                    <button
                      onClick={() => setActivationState({ status: "idle" })}
                      className="px-3 py-1 bg-gray-600 hover:bg-gray-700 rounded text-xs font-medium transition-colors"
                    >
                      Dismiss
                    </button>
                  </div>
                </motion.div>
              )}

              {mintState.status === "success" && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-green-900/20 border border-green-500 rounded-lg p-3 text-center"
                >
                  <div className="text-green-400 font-semibold mb-1">
                    🎉 Frick #{currentSupply} minted!
                  </div>
                  <div className="text-xs opacity-80">
                    Now activate it to make it live! 👇
                  </div>
                </motion.div>
              )}

              {/* 6x6 Grid */}
              {loading ? (
                <div className="flex justify-center items-center py-20">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                    className="w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-6 gap-1 max-w-sm mx-auto">
                  {currentGrid.map((gridWall, index) => (
                    <motion.button
                      key={`${gridWall.username}-${index}`}
                      className="relative aspect-square rounded-lg overflow-hidden bg-gray-800 border border-gray-700 hover:border-purple-500 transition-all duration-200"
                      onClick={() => handleWallClick(gridWall)}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: index * 0.02 }}
                    >
                      <img
                        src={gridWall.pfp}
                        alt={gridWall.username}
                        className="w-full h-full object-cover"
                      />

                      {/* Inactive overlay */}
                      {!gridWall.castHash &&
                        gridWall.castHash.slice(0, 4) !== "0x00" && (
                          <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                            <div className="text-white/60 text-xs font-bold">
                              💤
                            </div>
                          </div>
                        )}

                      {/* Hover effect for active walls */}
                      {gridWall.castHash &&
                        gridWall.castHash.slice(0, 4) !== "0x00" && (
                          <div className="absolute inset-0 bg-purple-500/0 hover:bg-purple-500/20 transition-colors duration-200 flex items-center justify-center opacity-0 hover:opacity-100">
                            <div className="text-white text-xs font-bold">
                              ✍️
                            </div>
                          </div>
                        )}
                    </motion.button>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {currentView === "mint" && (
            <motion.div
              key="mint"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="p-6 space-y-6 flex flex-col justify-center min-h-full"
            >
              <div className="text-center space-y-6">
                <div className="text-6xl">🧱</div>
                <h2 className="text-3xl font-bold">Mint Your Frick</h2>
                <p className="text-lg opacity-80">
                  Own a piece of the blockchain
                  <br />
                  {MINT_PRICE_SOL} SOL
                  <br />
                  (about 1.5 usd)
                </p>

                <div className="bg-gray-800 p-4 rounded-lg">
                  <div className="text-sm opacity-70 mb-2">Your Balance</div>
                  <div className="text-2xl font-bold">
                    {walletBalance.toFixed(4)} SOL
                  </div>
                </div>

                {mintState.status === "success" && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-center space-y-4"
                  >
                    <div className="text-green-400 font-semibold text-lg">
                      ✅ Frick #{currentSupply} minted successfully!
                    </div>
                    <div className="text-sm opacity-80">
                      Now activate it to make it your wall.
                    </div>
                    <a
                      href={`https://solscan.io/tx/${mintState.signature}`}
                      target="_blank"
                      className="text-blue-400 underline text-sm"
                    >
                      View transaction
                    </a>
                  </motion.div>
                )}

                {mintState.status === "error" && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="text-red-400 text-center bg-red-900/20 p-4 rounded-lg"
                  >
                    {mintState.error.message}
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="h-12 w-full flex-row flex items-center justify-center">
        <button className="bg-purple-600 hover:bg-purple-700 rounded-lg p-2 text-sm font-medium transition-colors">
          marketplace
        </button>
        <button>your frick</button>
      </div>

      {/* Fixed Bottom Action Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur-sm border-t border-gray-800 p-4">
        <motion.button
          onClick={primaryAction.action}
          disabled={primaryAction.disabled}
          className={`w-full py-4 rounded-lg font-bold text-lg transition-all duration-200 ${primaryAction.color} disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
          whileHover={{ scale: primaryAction.disabled ? 1 : 1.02 }}
          whileTap={{ scale: primaryAction.disabled ? 1 : 0.98 }}
        >
          {primaryAction.icon && primaryAction.icon}
          {primaryAction.text}
        </motion.button>

        {/* Back button for mint view */}
        {currentView === "mint" && (
          <motion.button
            onClick={() => setCurrentView("grid")}
            className="w-full mt-2 py-2 rounded-lg font-medium text-sm bg-gray-700 hover:bg-gray-600 transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            ← Back to Grid
          </motion.button>
        )}
      </div>

      {/* Wall Modal */}
      <AnimatePresence>
        {displayWallModal && chosenWall && (
          <UserWallDisplay
            chosenWall={chosenWall}
            onClose={() => setDisplayWallModal(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ————— helpers ————— */
const splash = (msg: string) => (
  <div className="h-screen w-screen flex items-center justify-center bg-gray-900 text-white">
    <div className="text-center space-y-4">
      <div className="text-6xl">🧱</div>
      <div>{msg}</div>
      <div>
        <a
          href="https://farcaster.xyz/jpfraneto.eth/0x81e09a78"
          target="_blank"
        >
          fricks.lat
        </a>
      </div>
    </div>
  </div>
);
