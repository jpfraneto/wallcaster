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
import { Zap, Plus, Loader, User } from "lucide-react";

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

import UserFrickDisplay from "./components/ui/walls/UserFrickDisplay";

const TOTAL_SUPPLY = 888;
const MINT_PRICE_SOL = "0.0069420";

export interface Frick {
  pda: string | null;
  owner: FrickOwner | null;
  currentImage: string | null;
  castHash: string | null;
  state: "Inactive" | "Active" | "Listed" | null;
  index: number;
}

interface FrickOwner {
  fid: number;
  pfpUrl: string;
  username: string;
}

export default function App() {
  /* Frame context */
  const [loading, setLoading] = useState(true);

  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [context, setContext] = useState<Context.FrameContext>();

  const [userFrick, setUserFrick] = useState<Frick | null>(null);
  const [contextFrick, setContextFrick] = useState<Frick | null>(null);

  const [frickForDisplay, setFrickForDisplay] = useState<Frick | null>(null);

  /* Minting Process */
  const [currentSupply, setCurrentSupply] = useState<number>(0);

  const [mintState, setMintState] = useState<
    | { status: "none" }
    | { status: "pending" }
    | { status: "error"; error: Error }
    | { status: "success"; signature: string }
    | { status: "minted"; pda: string }
  >({ status: "none" });

  /* Solana wallet integration */
  const { publicKey, sendTransaction } = useSolanaWallet();
  const { connection } = useSolanaConnection();
  const solanaAddress = publicKey?.toBase58();

  /* SDK initialization */
  const [walletBalance, setWalletBalance] = useState<number>(0);

  const apiCallMade = useRef(false);

  /* Initialize SDK and store context */
  useEffect(() => {
    const initializeSDK = async () => {
      if (!isSDKLoaded) {
        setIsSDKLoaded(true);

        // Call ready() FIRST - this is crucial for performance
        await sdk.actions.ready({});
        console.log("✅ SDK ready called immediately");

        // THEN get context
        const frameContext = await sdk.context;
        const { token } = await sdk.experimental.quickAuth();
        setToken(token);
        setContext(frameContext);
      }
    };

    initializeSDK();
  }, [isSDKLoaded]);

  // Initial Data Loading
  useEffect(() => {
    const loadAppData = async () => {
      if (!context?.user.fid || apiCallMade.current || !solanaAddress) return;
      console.log("🔄 Loading app data...");

      apiCallMade.current = true;

      try {
        let castHashHere: string | null = null;
        let casterFidHere: number | null = null;
        if (context.location?.type === "cast_embed") {
          castHashHere = context.location.cast.hash;
          casterFidHere = context.location.cast.fid;
        }

        const payload = {
          casterFid: casterFidHere,
          castHash: castHashHere,
          solanaAddress,
        };
        console.log("the payload is: ", payload);

        const apiResponse = await axios.post(
          `${API_URL}/wallcaster/init-session`,
          payload,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        console.log("🔄 API response:", apiResponse);

        const data = apiResponse.data;
        console.log("THE DATA IS ", data);

        setUserFrick(data.userWall || null);
        setContextFrick(data.contextWall || null);

        // If there's a context wall, show it first
        if (data.contextWall) {
          setFrickForDisplay(data.contextWall);
        }
      } catch (error) {
        console.error("❌ Error loading app data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadAppData();
  }, [context, solanaAddress, token]);

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

    if (userFrick?.pda) {
      setMintState({
        status: "error",
        error: new Error(
          "You already own a frick! Each wallet can only mint one frick."
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

      // Create new user frick after minting
      const newUserFrick: Frick = {
        pda: wallPda.toBase58(),
        state: "Inactive",
        castHash: null,
        currentImage: context?.user?.pfpUrl ?? "",
        owner: {
          fid: context?.user?.fid ?? 0,
          pfpUrl: context?.user?.pfpUrl ?? "",
          username: context?.user?.username ?? "",
        },
        index: mintCount,
      };

      setUserFrick(newUserFrick);
      setCurrentSupply((prev) => prev + 1);
      setMintState({ status: "success", signature });
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
    userFrick?.pda,
    context,
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
      const wallToActivate = userFrick?.pda;

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
        setUserFrick((prev) =>
          prev
            ? {
                ...prev,
                state: "Active",
                castHash: castHash,
              }
            : null
        );
        setActivationState({ status: "success", signature });
      } catch (error: any) {
        console.error("❌ Activation failed:", error);
        setActivationState({
          status: "error",
          error: error.message || "Unknown error occurred",
        });
      }
    },
    [publicKey, connection, userFrick?.pda, sendTransaction]
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

  const handleFrickClick = useCallback((frick: Frick) => {
    setFrickForDisplay(frick);
  }, []);

  const openUserFrick = useCallback(() => {
    if (userFrick) {
      setFrickForDisplay(userFrick);
    }
  }, [userFrick]);

  const closeDisplay = useCallback(() => {
    // If we have a context frick, go back to it, otherwise show nothing
    setFrickForDisplay(contextFrick);
  }, [contextFrick]);

  /* ——————————————————— render ——————————————————— */
  // Show loading only for data, not SDK
  if (!isSDKLoaded) return splash("Loading SDK…");
  if (!solanaAddress) return splash("load this inside warpcast");

  const isSoldOut = currentSupply >= TOTAL_SUPPLY;
  const userOwnsFrick = userFrick?.pda;
  const userFrickIsInactive = userFrick?.state === "Inactive";
  const canMint = !userOwnsFrick && !isSoldOut;

  // Get primary action
  const getPrimaryAction = () => {
    if (loading)
      return {
        text: "LOADING",
        action: () => console.log("loading"),
        color: "bg-purple-600 hover:bg-purple-700",
        icon: <Loader className="w-5 h-5" />,
      };

    if (canMint) {
      return {
        text: "MINT YOUR FRICK",
        action: mint,
        color: "bg-purple-600 hover:bg-purple-700",
        icon: <Plus className="w-5 h-5" />,
        disabled: mintState.status === "pending",
      };
    } else if (userOwnsFrick && userFrickIsInactive) {
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
    } else if (walletBalance < parseFloat(MINT_PRICE_SOL)) {
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
    }

    return null;
  };

  const primaryAction = getPrimaryAction();

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-gray-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-white text-lg font-medium animate-pulse">
            Loading fricks...
          </p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="h-screen w-screen flex flex-col bg-gray-900 text-white overflow-hidden relative"
      style={{
        paddingTop: context?.client.safeAreaInsets?.top ?? 0,
        paddingBottom: context?.client.safeAreaInsets?.bottom ?? 0,
        paddingLeft: context?.client.safeAreaInsets?.left ?? 0,
        paddingRight: context?.client.safeAreaInsets?.right ?? 0,
      }}
    >
      {/* User Profile Button - Top Right */}
      {userFrick && (
        <motion.button
          onClick={openUserFrick}
          className="absolute top-4 right-4 z-50 w-12 h-12 rounded-full overflow-hidden border-2 border-purple-500 hover:border-purple-400 transition-colors bg-gray-800"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
        >
          {context?.user?.pfpUrl ? (
            <img
              src={context.user.pfpUrl}
              alt={context.user.username || "User"}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <User className="w-6 h-6 text-purple-400" />
            </div>
          )}
        </motion.button>
      )}

      {/* Main Content Area */}
      <div className="flex-1 mb-20 overflow-y-auto">
        <AnimatePresence mode="wait">
          {frickForDisplay ? (
            <motion.div
              key="frick-display"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="h-full"
            >
              <UserFrickDisplay
                chosenFrick={frickForDisplay}
                onClose={closeDisplay}
              />
            </motion.div>
          ) : (
            <motion.div
              key="default-view"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="p-6 space-y-6 flex flex-col justify-center min-h-full"
            >
              <div className="text-center space-y-6">
                <motion.h1
                  className="text-4xl font-bold"
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

                <div className="text-6xl">🧱</div>

                <h2 className="text-2xl font-bold">
                  {canMint ? "Mint Your Frick" : "Welcome to Fricks"}
                </h2>

                {canMint && (
                  <p className="text-lg opacity-80">
                    Own a piece of the blockchain
                    <br />
                    {MINT_PRICE_SOL} SOL
                    <br />
                    (about 1.5 usd)
                  </p>
                )}

                {canMint && walletBalance > 0 && (
                  <div className="bg-gray-800 p-4 rounded-lg">
                    <div className="text-sm opacity-70 mb-2">Your Balance</div>
                    <div className="text-2xl font-bold">
                      {walletBalance.toFixed(4)} SOL
                    </div>
                  </div>
                )}

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
                            hash: userFrick?.castHash!,
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

      {/* Navigation Bar */}
      {!frickForDisplay && (
        <div className="h-12 w-full flex-row flex items-center justify-center space-x-4 px-4">
          <button className="bg-purple-600 hover:bg-purple-700 rounded-lg px-4 py-2 text-sm font-medium transition-colors">
            marketplace
          </button>
          {userFrick && (
            <button
              onClick={openUserFrick}
              className="bg-gray-700 hover:bg-gray-600 rounded-lg px-4 py-2 text-sm font-medium transition-colors"
            >
              your frick
            </button>
          )}
        </div>
      )}

      {/* Fixed Bottom Action Button */}
      {primaryAction && (
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

          {/* Back button when displaying a frick */}
          {frickForDisplay && (
            <motion.button
              onClick={closeDisplay}
              className="w-full mt-2 py-2 rounded-lg font-medium text-sm bg-gray-700 hover:bg-gray-600 transition-colors"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              ← Back
            </motion.button>
          )}
        </div>
      )}
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
