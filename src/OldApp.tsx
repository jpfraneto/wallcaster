/* ──────────────────────────────────────────────────────────────
 *  App.tsx – Fricks Frame v2 mini-app
 *  "mint. activate. have fun."
 * ──────────────────────────────────────────────────────────── */
const API_URL = "https://poiesis.anky.app";

import { useState, useEffect, useCallback, useRef } from "react";
import sdk, { type Context } from "@farcaster/frame-sdk";
import { Transaction, PublicKey } from "@solana/web3.js";
import { motion, AnimatePresence } from "framer-motion";
import axios from "axios";
import StayTunedButton from "./components/ui/StayTunedButton";

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
import WallViewer from "./components/WallViewer";
import { Button } from "./components/ui/Button";

const TOTAL_SUPPLY = 888;
const MINT_PRICE_SOL = "0.0069420";

/* —— Add interface for inactive walls ——————————————— */
interface InactiveWall {
  pda: string;
  owner: string;
  displayName: string;
  pfp: string | null;
}

interface WallStub {
  id: number;
  owner: string;
  price: number;
  state: "Listed";
}

export default function App() {
  /* Frame context */
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [context, setContext] = useState<Context.FrameContext>();
  const [_showActivate, setShowActivate] = useState(false);
  const [castHashHex, setCastHashHex] = useState<string>();
  const [userHasMinted, setUserHasMinted] = useState(false);
  const [_walls, setWalls] = useState<WallStub[]>([]);

  const [activatedWalls, setActivatedWalls] = useState<ActivatedWall[]>([]);
  const [_inactiveWalls, setInactiveWalls] = useState<InactiveWall[]>([]); // NEW!
  const [chosenWallForOpening, setChosenWallForOpening] =
    useState<ActivatedWall | null>(null);
  const [_activationCastHash, setActivationCastHash] = useState<string>();

  /* Supply tracking */
  const [currentSupply, setCurrentSupply] = useState<number>(0);
  const [totalInactiveWalls, setTotalInactiveWalls] = useState<number>(0); // NEW!
  const [_loading, setLoading] = useState(true);
  const [mintState, setMintState] = useState<
    | { status: "none" }
    | { status: "pending" }
    | { status: "error"; error: Error }
    | { status: "success"; signature: string }
  >({ status: "none" });

  /* UI state */
  const [currentView, setCurrentView] = useState<
    "gallery" | "mint" | "profile"
  >("gallery");
  const [_initialData, setInitialData] = useState<any>(null);

  // Add state to track user's wall after minting
  const [userWallState, setUserWallState] = useState<{
    pda: string | null;
    state: "Inactive" | "Active" | "Listed" | null;
  }>({ pda: null, state: null });

  /* Solana wallet integration - following official patterns */
  const { publicKey, sendTransaction } = useSolanaWallet();
  const { connection } = useSolanaConnection();
  const solanaAddress = publicKey?.toBase58();

  /* SDK initialization - following official pattern */
  const apiCallMade = useRef(false);

  const [walletBalance, setWalletBalance] = useState<number>(0);

  /* Fetch wallet balance */
  useEffect(() => {
    const fetchBalance = async () => {
      if (!publicKey || !connection) return;
      try {
        const balance = await connection.getBalance(publicKey);
        setWalletBalance(balance / 1e9); // Convert lamports to SOL
      } catch (error) {
        console.error("Error fetching balance:", error);
      }
    };

    fetchBalance();
  }, [publicKey, connection]);

  useEffect(() => {
    const load = async () => {
      const frameContext = await sdk.context;
      setContext(frameContext);
      if (!frameContext) return;
      if (frameContext.user.fid && !apiCallMade.current) {
        apiCallMade.current = true;
        console.log("WE HAVE CONTEXT");
        const response = await axios.get(
          `${API_URL}/wallcaster/setup-app-for-fid/${frameContext.user.fid}?castHash=${castHashHex}&solanaAddress=${solanaAddress}&frameContext=${frameContext?.location?.type}`
        );
        const apiResponse = response.data;
        console.log("the api response data is", apiResponse);
        setInitialData(apiResponse.data);
        setActivatedWalls(apiResponse.data.activatedWalls || []);
        setInactiveWalls(apiResponse.data.inactiveWalls || []); // NEW!
        setCurrentSupply(apiResponse.data.stats?.totalMinted || 0);
        setTotalInactiveWalls(apiResponse.data.stats?.totalInactiveWalls || 0); // NEW!

        // Set user wall state from API response
        if (apiResponse.data.user?.wall) {
          setUserWallState({
            pda: apiResponse.data.user.wall.pda,
            state: apiResponse.data.user.wall.state,
          });
        }
      }

      if (frameContext.location?.type === "cast_embed") {
        setCastHashHex(frameContext.location.cast.hash);

        // Only show activate if the current user is the cast author
        if (frameContext.user.fid === frameContext.location.cast.fid) {
          setShowActivate(true);
        }
      }

      sdk.actions.ready({});
    };

    if (sdk && !isSDKLoaded) {
      setIsSDKLoaded(true);
      load();
    }
  }, [isSDKLoaded]);

  /* Fetch current supply */
  useEffect(() => {
    const fetchSupplyAndWalls = async () => {
      if (!connection) return;

      try {
        // Fetch current supply
        const account = await connection.getAccountInfo(registryPda());
        if (account) {
          const mintCount = account.data.readUInt16LE(8 + 32 + 32);
          setCurrentSupply(mintCount);
        }

        // For now, use demo walls - you can implement real wall fetching later
        const demoWalls: WallStub[] = [];
        setWalls(demoWalls);
      } catch (err) {
        console.error("Error fetching supply and walls:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSupplyAndWalls();
  }, [connection, mintState]);

  /* Derive PDA for the current user (if they own one) */
  const { wall } = useOwnedWall(
    connection,
    PROGRAM_ID.toBase58(),
    solanaAddress ?? null
  );

  // Helper function to derive wall PDA from registry and mint count
  const deriveUserWallPda = useCallback(async () => {
    if (!publicKey || !connection) return null;

    try {
      const registryAccount = await connection.getAccountInfo(registryPda());
      if (!registryAccount) return null;

      const mintCount = registryAccount.data.readUInt16LE(8 + 32 + 32);

      // The user's wall would be at the current mint count (since they just minted)
      const [wallPda] = await PublicKey.findProgramAddress(
        [
          Buffer.from("wall"),
          registryPda().toBuffer(),
          Buffer.from([mintCount & 0xff, (mintCount >> 8) & 0xff]), // Convert to little endian bytes
        ],
        PROGRAM_ID
      );

      return wallPda.toBase58();
    } catch (error) {
      console.error("Error deriving wall PDA:", error);
      return null;
    }
  }, [publicKey, connection]);

  /* Mint function - following official transaction pattern */
  const mint = useCallback(async () => {
    if (!publicKey || !connection) {
      setMintState({
        status: "error",
        error: new Error("Wallet not connected"),
      });
      return;
    }

    // Check if user already owns a wall (smart contract level)
    if (wall?.pda || userWallState.pda) {
      setMintState({
        status: "error",
        error: new Error(
          "You already own a wall! Each wallet can only mint one wall."
        ),
      });
      return;
    }

    // Check localStorage (client level)
    if (userHasMinted) {
      setMintState({
        status: "error",
        error: new Error("You have already minted a wall with this wallet."),
      });
      return;
    }

    setMintState({ status: "pending" });

    try {
      // Check if sold out
      if (currentSupply >= TOTAL_SUPPLY) {
        throw new Error("All 888 walls have been minted!");
      }

      /* Fetch registry to know current mint_count */
      const account = await connection.getAccountInfo(registryPda());
      if (!account) throw new Error("Registry not initialized");

      const mintCount = account.data.readUInt16LE(8 + 32 + 32);

      /* Get latest blockhash */
      const { blockhash } = await connection.getLatestBlockhash();
      if (!blockhash) {
        throw new Error("Failed to fetch latest Solana blockhash");
      }

      /* Create transaction following official pattern */
      const transaction = new Transaction();

      // Add mint instruction
      const mintInstruction = ixMintWall(publicKey, TREASURY_PUBKEY, mintCount);
      transaction.add(mintInstruction);

      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      /* Send transaction */
      const signature = await sendTransaction(transaction, connection);

      // Wait for confirmation to ensure the mint completed
      const confirmation = await connection.confirmTransaction(signature);

      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${confirmation.value.err}`);
      }

      // Derive the PDA of the newly minted wall
      const newWallPda = await deriveUserWallPda();

      // Update user wall state immediately after successful mint
      setUserWallState({
        pda: newWallPda,
        state: "Inactive", // Newly minted walls are always Inactive
      });

      // Mark user as having minted in localStorage
      const mintKey = `wallcaster_minted_${publicKey.toBase58()}`;
      localStorage.setItem(mintKey, "true");
      setUserHasMinted(true);

      // Update current supply
      setCurrentSupply((prev) => prev + 1);

      setMintState({ status: "success", signature });

      // Auto-switch to gallery view to show the activate button
      setTimeout(() => {
        setCurrentView("gallery");
      }, 2000);
    } catch (error: any) {
      console.error("Mint error:", error);
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
    userHasMinted,
    userWallState.pda,
    deriveUserWallPda,
  ]);

  // Add activation state tracking
  const [activationState, setActivationState] = useState<
    | { status: "idle" }
    | { status: "creating_cast" }
    | { status: "pending_activation" }
    | { status: "success"; signature: string }
    | { status: "error"; error: string }
  >({ status: "idle" });

  // Add analytics tracking for activation attempts
  useEffect(() => {
    if (activationState.status !== "idle") {
      console.log("Activation State Change:", {
        status: activationState.status,
        userWallet: solanaAddress,
        timestamp: Date.now(),
        error:
          activationState.status === "error" ? activationState.error : null,
      });
    }
  }, [activationState, solanaAddress]);

  const handleActivateWall = useCallback(
    async (castHash: string) => {
      const wallToActivate = wall?.pda || userWallState.pda;

      if (!publicKey || !connection || !wallToActivate) {
        setActivationState({
          status: "error",
          error: "Wallet not connected or no wall found",
        });
        return;
      }

      setActivationState({ status: "pending_activation" });

      try {
        console.log("🎯 Starting wall activation...");
        console.log("Wall PDA:", wallToActivate);
        console.log("Cast Hash:", castHash);
        console.log("Owner:", publicKey.toString());

        // Validate inputs
        if (!wallToActivate || !castHash) {
          throw new Error("Missing wall PDA or cast hash");
        }

        // Convert wall PDA string to PublicKey
        const wallPublicKey = new PublicKey(wallToActivate);

        // Verify the wall account exists and is owned by our program
        const wallAccount = await connection.getAccountInfo(wallPublicKey);
        if (!wallAccount) {
          throw new Error("Wall account not found");
        }

        if (!wallAccount.owner.equals(PROGRAM_ID)) {
          throw new Error(
            `Wall account not owned by program. Owner: ${wallAccount.owner.toString()}, Expected: ${PROGRAM_ID.toString()}`
          );
        }

        console.log("✅ Wall account verified");

        // Check current wall state to ensure it's inactive
        const wallData = wallAccount.data;
        const stateOffset = 8 + 32 + 32 + 8; // discriminator + owner + cast_hash + price
        const currentState = wallData[stateOffset];

        console.log("Current wall state:", currentState);

        if (currentState === 1) {
          throw new Error("Wall is already activated");
        }

        if (currentState === 2) {
          throw new Error("Wall is listed - cannot activate while listed");
        }

        // Verify ownership
        const ownerBytes = wallData.slice(8, 8 + 32); // Skip discriminator, get owner
        const wallOwner = new PublicKey(ownerBytes);

        if (!wallOwner.equals(publicKey)) {
          throw new Error(
            `You don't own this wall. Owner: ${wallOwner.toString()}, You: ${publicKey.toString()}`
          );
        }

        console.log("✅ Ownership verified");

        // Clean the cast hash (remove 0x prefix if present)
        const cleanCastHash = castHash.startsWith("0x")
          ? castHash.slice(2)
          : castHash;

        // Validate hex string
        if (!/^[0-9a-fA-F]+$/.test(cleanCastHash)) {
          throw new Error(`Invalid cast hash format: ${castHash}`);
        }

        console.log("✅ Cast hash validated:", cleanCastHash);

        // Get latest blockhash
        const { blockhash, lastValidBlockHeight } =
          await connection.getLatestBlockhash();

        // Create the activation instruction
        const activateInstruction = ixActivateWall(
          wallPublicKey,
          publicKey,
          castHash // Pass the original hex string
        );

        console.log("🔧 Activation instruction created");

        // Create transaction
        const transaction = new Transaction();
        transaction.add(activateInstruction);
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = publicKey;

        console.log("🔍 Simulating transaction...");

        // Simulate the transaction first
        const simulation = await connection.simulateTransaction(transaction);

        if (simulation.value.err) {
          console.error("❌ Simulation failed:", simulation.value.err);
          console.error("Simulation logs:", simulation.value.logs);

          // Parse custom program errors
          if (
            simulation.value.err &&
            typeof simulation.value.err === "object" &&
            "InstructionError" in simulation.value.err
          ) {
            const instructionError = simulation.value.err.InstructionError;
            if (
              Array.isArray(instructionError) &&
              instructionError.length > 1
            ) {
              const errorCode = instructionError[1];
              if (typeof errorCode === "object" && "Custom" in errorCode) {
                const customError = errorCode.Custom;

                const errorMessages: { [key: number]: string } = {
                  6000: "All 888 walls are minted",
                  6001: "Wall is already listed",
                  6002: "Wall is not listed",
                  6003: "Price must be > 0",
                  6004: "Cannot buy your own listing",
                  6005: "Seller provided is not the owner",
                  6006: "Insufficient funds",
                  6007: "Royalty overflow",
                  6008: "Wall is listed – unlist first",
                };

                const errorMessage =
                  errorMessages[customError] ||
                  `Unknown error code: ${customError}`;
                throw new Error(`Smart contract error: ${errorMessage}`);
              }
            }
          }

          throw new Error(
            `Transaction simulation failed: ${JSON.stringify(
              simulation.value.err
            )}`
          );
        }

        console.log("✅ Simulation successful");
        console.log("Simulation logs:", simulation.value.logs);

        // Send transaction
        console.log("📤 Sending activation transaction...");
        const signature = await sendTransaction(transaction, connection, {
          maxRetries: 3,
        });

        console.log("📝 Transaction sent:", signature);

        // Wait for confirmation
        const confirmation = await connection.confirmTransaction({
          signature,
          blockhash,
          lastValidBlockHeight,
        });

        if (confirmation.value.err) {
          throw new Error(`Transaction failed: ${confirmation.value.err}`);
        }

        // Update user wall state to Active
        setUserWallState((prev) => ({
          ...prev,
          state: "Active",
        }));

        console.log("🎉 Wall activated successfully!");
        setActivationState({ status: "success", signature });
      } catch (error: any) {
        console.error("❌ Activation failed:", error);
        setActivationState({
          status: "error",
          error: error.message || "Unknown error occurred",
        });
      }
    },
    [publicKey, connection, wall, userWallState.pda, sendTransaction]
  );

  // Handle the complete activation flow: cast creation + activation
  const initiateActivation = useCallback(async () => {
    setActivationState({ status: "creating_cast" });

    try {
      console.log("📝 Creating activation cast...");

      const activationCast = await sdk.actions.composeCast({
        text: "this cast will be my frick 🧱✨",
        embeds: ["https://fricks.lat"],
      });

      console.log("✅ Cast created:", activationCast.cast?.hash);

      // Store the cast hash
      setActivationCastHash(activationCast.cast?.hash || "");

      // Now activate the wall with this cast hash
      await handleActivateWall(activationCast.cast?.hash || "");
    } catch (error: any) {
      console.error("❌ Cast creation failed:", error);
      setActivationState({
        status: "error",
        error: `Failed to create cast: ${error.message}`,
      });
    }
  }, [handleActivateWall]);

  // const writeOnWall = useCallback((wall: ActivatedWall) => {
  //   sdk.actions.composeCast({
  //     parent: {
  //       type: "cast",
  //       hash: wall.castHash,
  //     },
  //     text: `sup ${wall.username}`,
  //   });
  // }, []);

  /* ——————————————————— render ——————————————————— */
  if (!isSDKLoaded) return splash("Loading SDK…");
  if (!solanaAddress) return splash("load this inside warpcast");

  const isSoldOut = currentSupply >= TOTAL_SUPPLY;

  // Updated logic to include userWallState
  const userOwnsWall = wall?.pda || userWallState.pda;
  const userWallIsInactive =
    wall?.state === "Inactive" || userWallState.state === "Inactive";
  const canMint = !userOwnsWall && !userHasMinted && !isSoldOut;

  // Determine primary action for bottom button
  const getPrimaryAction = () => {
    if (currentView === "gallery") {
      if (canMint) {
        return {
          text: "MINT YOUR WALL",
          action: () => setCurrentView("mint"),
          color: "bg-purple-600 hover:bg-purple-700",
        };
      } else if (userOwnsWall && userWallIsInactive) {
        return {
          text:
            activationState.status === "creating_cast"
              ? "CREATING CAST..."
              : activationState.status === "pending_activation"
              ? "ACTIVATING..."
              : "ACTIVATE YOUR WALL",
          action: initiateActivation,
          color: "bg-green-600 hover:bg-green-700",
          disabled:
            activationState.status === "creating_cast" ||
            activationState.status === "pending_activation",
        };
      } else if (userOwnsWall) {
        return {
          text: "VIEW YOUR FRICK",
          action: () => setCurrentView("profile"),
          color: "bg-blue-600 hover:bg-blue-700",
        };
      } else {
        return {
          text: "EXPLORE COMMUNITY",
          action: () => {
            // Maybe scroll to top or refresh
          },
          color: "bg-gray-600 hover:bg-gray-700",
        };
      }
    } else if (currentView === "mint") {
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
    } else {
      // profile view
      return {
        text: "BACK TO GALLERY",
        action: () => setCurrentView("gallery"),
        color: "bg-gray-600 hover:bg-gray-700",
      };
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
      {/* Wall Viewer Modal */}
      {chosenWallForOpening && (
        <WallViewer
          wall={chosenWallForOpening}
          onClose={() => setChosenWallForOpening(null)}
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 mb-20 overflow-y-auto">
        <AnimatePresence mode="wait">
          {currentView === "gallery" && (
            <motion.div
              key="gallery"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.3 }}
              className="p-6 space-y-6"
            >
              {/* Header */}
              <div className="text-center space-y-2">
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
                  onClick={() => {
                    sdk.actions.swapToken({
                      buyToken:
                        "eip155:8453/erc20:0xaeB9e71B11BD3ECb03897de7534F9dc33D9e6b07",
                    });
                  }}
                >
                  $fricks
                </motion.h1>
                <p className="text-lg opacity-80">mint. activate. have fun.</p>

                {/* Updated Stats */}
                <div className="flex justify-center gap-4 text-sm opacity-70">
                  <span>
                    {currentSupply} / {TOTAL_SUPPLY} minted
                  </span>
                  <span>{activatedWalls.length} active</span>
                  <span>{totalInactiveWalls} inactive</span>
                </div>
              </div>

              {/* Show activation status feedback */}
              {activationState.status === "creating_cast" && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-yellow-900/20 border border-yellow-500 rounded-lg p-4 text-center"
                >
                  <div className="text-yellow-400 font-semibold text-lg mb-2">
                    ✍️ Step 1/2: Creating your cast...
                  </div>
                  <div className="text-sm opacity-80">
                    Please complete the cast creation in Warpcast
                  </div>
                  <div className="flex justify-center mt-2">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{
                        duration: 1,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                      className="w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full"
                    />
                  </div>
                </motion.div>
              )}

              {activationState.status === "pending_activation" && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-blue-900/20 border border-blue-500 rounded-lg p-4 text-center"
                >
                  <div className="text-blue-400 font-semibold text-lg mb-2">
                    {context?.location?.type === "cast_embed" &&
                    context?.user?.fid === context?.location?.cast?.fid
                      ? "🎯 Activating with this cast..."
                      : "⛓️ Step 2/2: Activating on blockchain..."}
                  </div>
                  <div className="text-sm opacity-80">
                    Confirming your transaction on Solana
                  </div>
                  <div className="flex justify-center mt-2">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{
                        duration: 1,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                      className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full"
                    />
                  </div>
                </motion.div>
              )}

              {activationState.status === "success" && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-green-900/20 border border-green-500 rounded-lg p-4 text-center"
                >
                  <div className="text-green-400 font-semibold text-lg mb-2">
                    🎉 Wall activated successfully!
                  </div>
                  <a
                    href={`https://solscan.io/tx/${activationState.signature}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 underline text-sm hover:text-blue-300"
                  >
                    View transaction on Solscan
                  </a>
                </motion.div>
              )}

              {activationState.status === "error" && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-red-900/20 border border-red-500/30 rounded-lg p-4"
                >
                  <div className="text-red-400 font-semibold text-lg mb-2">
                    ❌ Activation Failed
                  </div>
                  <div className="text-red-300 text-sm leading-relaxed mb-3">
                    {activationState.error}
                  </div>
                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={initiateActivation}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded text-sm font-medium transition-colors"
                    >
                      🔄 Try Again
                    </button>
                    <button
                      onClick={() => setActivationState({ status: "idle" })}
                      className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded text-sm font-medium transition-colors"
                    >
                      Dismiss
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Show success message after minting */}
              {mintState.status === "success" && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-green-900/20 border border-green-500 rounded-lg p-4 text-center"
                >
                  <div className="text-green-400 font-semibold text-lg mb-2">
                    🎉 Wall #{currentSupply} minted successfully!
                  </div>
                  <div className="text-sm opacity-80">
                    Now activate it to make it live! 👇
                  </div>
                </motion.div>
              )}

              <p>this system was not prepared for the load that it received.</p>
              <p>the interface will be reworked in the next few days.</p>
              <p>
                add the app to farcaster to get a notification with next steps.
              </p>
              <StayTunedButton onClick={() => sdk.actions.addMiniApp()} />

              <p className="text-xs">
                (if you havent minted do it with the button down here)
              </p>
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
                <h2 className="text-3xl font-bold">Mint Your Wall</h2>
                <p className="text-lg opacity-80">
                  Own a piece of the blockchain
                  <br />
                  {MINT_PRICE_SOL} SOL per wall
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
                      ✅ Wall #{currentSupply} minted successfully!
                    </div>
                    <div className="text-sm opacity-80">
                      Now go to gallery and activate it! 🚀
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

          {currentView === "profile" && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="p-6 space-y-6"
            >
              <div className="text-center space-y-4">
                <img
                  src={context?.user?.pfpUrl || "/fallback-pfp.png"}
                  alt="Your profile"
                  className="w-20 h-20 rounded-full mx-auto ring-4 ring-purple-500/50"
                />
                <h2 className="text-2xl font-bold">Your Frick</h2>

                <div className="grid grid-cols-3 gap-4 text-center">
                  <p>
                    here you would see the people that have written on your
                    frick and what
                  </p>
                  <p>
                    you can also sell your frick on the marketplace that is
                    embedded on the smart contract
                  </p>
                  <Button
                    onClick={() => {
                      console.log(
                        "time to sell wall",
                        wall?.pda || userWallState.pda
                      );
                    }}
                  >
                    Sell Frick
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Fixed Bottom Action Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-900/95 backdrop-blur-sm border-t border-gray-800 p-4">
        <motion.button
          onClick={primaryAction.action}
          disabled={primaryAction.disabled}
          className={`w-full py-4 rounded-lg font-bold text-lg transition-all duration-200 ${primaryAction.color} disabled:opacity-50 disabled:cursor-not-allowed`}
          whileHover={{ scale: primaryAction.disabled ? 1 : 1.02 }}
          whileTap={{ scale: primaryAction.disabled ? 1 : 0.98 }}
        >
          {primaryAction.text}
        </motion.button>
      </div>
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
