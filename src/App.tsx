import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  createApproveInstruction,
} from "@solana/spl-token";
import { jwtDecode } from "jwt-decode";

import { useOwnedWall } from "./hooks/useWall";

import { solanaConnection } from "./lib/solana/connection";

import { BaseError, UserRejectedRequestError } from "viem";

import { truncateAddress } from "./lib/truncateAddress";

import {
  PublicKey as SolanaPublicKey,
  SystemProgram as SolanaSystemProgram,
  Transaction as SolanaTransaction,
  VersionedTransaction,
  TransactionMessage,
  TransactionInstruction,
  PublicKey,
  Connection,
} from "@solana/web3.js";

import sdk, {
  FrameNotificationDetails,
  SignIn as SignInCore,
  type Context,
} from "@farcaster/frame-sdk";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "./components/ui/Button";

export default function App() {
  const [isSDKLoaded, setIsSDKLoaded] = useState(false);
  const [context, setContext] = useState<Context.FrameContext>();
  const [token, setToken] = useState<string | null>(null);

  const [notificationDetails, setNotificationDetails] =
    useState<FrameNotificationDetails | null>(null);

  const [solanaAddress, setSolanaAddress] = useState<string | null>(null);
  const [solanaProvider, setSolanaProvider] = useState<any>(null);
  const [contextCastHash, setContextCastHash] = useState<string | null>(null);
  const [contextCastFid, setContextCastFid] = useState<Number | null>(null);
  const [chosenWall, setChosenWall] = useState(0);
  const [showActivateWall, setShowActivateWall] = useState(false);

  const [displayMarketplace, setDisplayMarketplace] = useState(true);

  const PROGRAM_ID = "7UhisdAH7dosM1nfF1rbBXYv1Vtgr2yd6W4B7SuZJJVx";

  const { wall, loading: wallLoading } = useOwnedWall(
    solanaConnection,
    PROGRAM_ID,
    solanaAddress
  );

  useEffect(() => {
    setNotificationDetails(context?.client.notificationDetails ?? null);
  }, [context]);

  useEffect(() => {
    console.log(
      notificationDetails,
      contextCastHash,
      contextCastFid,
      wallLoading
    );
  }, []);

  useEffect(() => {
    const load = async () => {
      sdk.actions.ready({});
      const context = await sdk.context;
      setContext(context);
      const openedWhere = context.location?.type;
      console.log("IN HERE THE CONTEXT IS", context);

      if (openedWhere === "cast_embed") {
        setShowActivateWall(true);
        setContextCastHash(context.location?.cast.hash!);
        setContextCastFid(context.location?.cast.fid!);
      } else {
        setContextCastHash(null);
        setContextCastFid(null);
      }

      sdk.on("primaryButtonClicked", () => {
        console.log("primaryButtonClicked");
      });
    };
    if (sdk && !isSDKLoaded) {
      setIsSDKLoaded(true);
      load();
      return () => {
        sdk.removeAllListeners();
      };
    }
  }, [isSDKLoaded]);

  const { getSolanaProvider } = sdk.experimental;
  useEffect(() => {
    (async () => {
      const solanaProvider = await getSolanaProvider();
      if (!solanaProvider) {
        return;
      }
      setSolanaProvider(solanaProvider);
      const result = await solanaProvider.request({
        method: "connect",
      });
      setSolanaAddress(result?.publicKey.toString());
    })();
  }, [getSolanaProvider]);

  if (!isSDKLoaded) {
    return <div>Loading...</div>;
  }

  const defaultLayout = false;

  if (defaultLayout) {
    return (
      <div>
        {" "}
        {solanaAddress && (
          <div>
            <h2 className="font-2xl font-bold">Solana</h2>
            <div className="my-2 text-xs">
              Address:{" "}
              <pre className="inline">{truncateAddress(solanaAddress)}</pre>
            </div>
            <div className="mb-4">
              <SignSolanaMessage />
            </div>
            <div className="mb-4">
              <SendSolana />
            </div>
            <div className="mb-4">
              <SendTokenSolana />
            </div>
          </div>
        )}
        <div className="mb-4">
          <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg my-2">
            <pre className="font-mono text-xs whitespace-pre-wrap break-words max-w-[260px] overflow-x-">
              sdk.experimental.quickAuth
            </pre>
          </div>
          <QuickAuth setToken={setToken} token={token} />
        </div>
      </div>
    );
  }
  return (
    <div className="h-screen w-screen">
      <nav className="bg-gray-800 text-white p-4">
        <div className="container mx-auto flex justify-between items-center">
          <div className="text-2xl font-bold">wallcaster</div>
          <button
            onClick={() => {
              setDisplayMarketplace(!displayMarketplace);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all duration-300 ${
              displayMarketplace
                ? "bg-purple-600 shadow-lg shadow-purple-500/30"
                : "bg-gray-700 hover:bg-gray-600"
            }`}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className={`transition-transform duration-300 ${
                displayMarketplace ? "text-white" : "text-gray-300"
              }`}
            >
              <path
                d="M3 6C3 4.89543 3.89543 4 5 4H19C20.1046 4 21 4.89543 21 6V8C21 9.10457 20.1046 10 19 10H5C3.89543 10 3 9.10457 3 8V6Z"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                d="M4 10V18C4 19.1046 4.89543 20 6 20H18C19.1046 20 20 19.1046 20 18V10"
                stroke="currentColor"
                strokeWidth="2"
              />
              <path
                d="M8 14H16"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M8 17H12"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>

            {displayMarketplace && (
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-300 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-200"></span>
              </span>
            )}
          </button>
        </div>
      </nav>
      {displayMarketplace && solanaAddress && (
        <Marketplace
          isOpen={displayMarketplace}
          solanaProvider={solanaProvider}
          userSolanaAddress={solanaAddress}
        />
      )}
      <ActiveWallsScroller setChosenWall={setChosenWall} />
      {showActivateWall && (
        <ActivateWallButton
          wallPda={wall?.pda}
          castHash={contextCastHash!}
          connection={solanaConnection}
          solanaProvider={solanaProvider}
        />
      )}
      {chosenWall && <Wall chosenWall={chosenWall} />}
    </div>
  );
}

// ————————————————————————————————————————————————————————————————
// utils
// ————————————————————————————————————————————————————————————————
const ACTIVATE_WALL_DISCRIMINATOR = Buffer.from([
  /* sha256("global:activate_wall").slice(0,8) */
  88, 67, 119, 10, 202, 25, 16, 165,
]);

const to32ByteBuffer = (hex: string) => {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  return Buffer.from(clean.padStart(64, "0"), "hex");
};

// ————————————————————————————————————————————————————————————————
// UI component
// ————————————————————————————————————————————————————————————————
function ActivateWallButton({
  wallPda,
  castHash,
  connection,
  solanaProvider,
}: {
  wallPda: PublicKey | undefined;
  castHash: string;
  connection: Connection;
  solanaProvider: any;
}) {
  const [state, setState] = useState<
    | { status: "idle" }
    | { status: "sending" }
    | { status: "success"; sig: string }
    | { status: "error"; err: Error }
  >({ status: "idle" });

  const handleActivate = useCallback(async () => {
    if (!wallPda) return;
    setState({ status: "sending" });

    try {
      // 1️⃣ who is paying
      const { publicKey } = await solanaProvider.request({ method: "connect" });
      const payer = new PublicKey(publicKey as string);

      // 2️⃣ build instruction
      const ix = new TransactionInstruction({
        keys: [
          { pubkey: wallPda, isSigner: false, isWritable: true },
          { pubkey: payer, isSigner: true, isWritable: false },
        ],
        programId: wallPda, // <— if your program id is fixed use new PublicKey(PROGRAM_ID)
        data: Buffer.concat([
          ACTIVATE_WALL_DISCRIMINATOR, // 8-byte discriminator
          to32ByteBuffer(castHash), // 32-byte cast hash
        ]),
      });

      // 3️⃣ assemble + send
      const { blockhash } = await connection.getLatestBlockhash();
      const tx = new SolanaTransaction().add(ix);
      tx.recentBlockhash = blockhash;
      tx.feePayer = payer;

      const { signature } = await solanaProvider.signAndSendTransaction({
        transaction: tx,
        network: "mainnet-beta",
      });

      // 4️⃣ wait & finish
      await connection.confirmTransaction(signature, "confirmed");
      setState({ status: "success", sig: signature });
    } catch (err) {
      setState({ status: "error", err: err as Error });
    }
  }, [wallPda, castHash, connection, solanaProvider]);

  // ———————————————————————————————————————————— UI
  if (!wallPda) return null; // safety: nothing to activate
  return (
    <div className="fixed bottom-6 left-0 right-0 flex justify-center z-50">
      {state.status === "idle" && (
        <button
          onClick={handleActivate}
          className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-cyan-600 text-white rounded-xl font-bold shadow-lg hover:scale-105 transition"
        >
          activate wall
        </button>
      )}

      {state.status === "sending" && (
        <button className="px-6 py-3 bg-gray-700 text-white rounded-xl animate-pulse cursor-wait">
          activating…
        </button>
      )}

      {state.status === "success" && (
        <a
          href={`https://solscan.io/tx/${state.sig}`}
          target="_blank"
          rel="noreferrer"
          className="px-6 py-3 bg-green-600 text-white rounded-xl font-bold shadow-lg hover:underline"
        >
          wall activated ✓
        </a>
      )}

      {state.status === "error" && (
        <button
          onClick={() => setState({ status: "idle" })}
          className="px-6 py-3 bg-red-600 text-white rounded-xl font-bold shadow-lg"
        >
          retry – {state.err.message}
        </button>
      )}
    </div>
  );
}

function Wall({ chosenWall }: { chosenWall: number }) {
  const [message, setMessage] = useState("");

  const handleSend = useCallback(() => {
    if (message.trim()) {
      sdk.actions.composeCast({
        parent: {
          type: "cast",
          hash: "TODO: INSERT CAST HASH OF THIS WALL HERE",
        },
        text: message,
      });
      setMessage("");
    }
  }, [message, chosenWall]);

  return (
    <div className="h-[60%] w-full flex flex-col items-center p-4 bg-gradient-to-r from-purple-800 to-indigo-900 overflow-y-auto">
      <div className="flex w-full max-w-4xl mb-6">
        <textarea
          className="h-16 w-4/5 p-4 bg-purple-100 text-purple-900 rounded-l-lg shadow-inner resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
          placeholder={`Write something on wall ${chosenWall}...`}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <button
          className="h-16 w-1/5 bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold rounded-r-lg hover:from-pink-600 hover:to-purple-700 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
          onClick={handleSend}
        >
          Send
        </button>
      </div>

      {/* Wall messages - placeholders */}
      <div className="w-full max-w-4xl space-y-4">
        {[1, 2, 3].map((item) => (
          <div
            key={item}
            className="bg-purple-700 bg-opacity-50 rounded-lg p-4 shadow-md"
          >
            <div className="flex items-center mb-2">
              <div className="w-10 h-10 rounded-full bg-gradient-to-r from-pink-400 to-purple-500 mr-3"></div>
              <div>
                <h3 className="text-white font-medium">Anonymous User</h3>
                <p className="text-purple-200 text-sm">
                  {new Date().toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
            <p className="text-white">
              This is a placeholder message on wall #{chosenWall}. People will
              be able to write their thoughts here!
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActiveWallsScroller({
  setChosenWall,
}: {
  setChosenWall: (wall: number) => void;
}) {
  const [scrollPosition, setScrollPosition] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (containerRef.current) {
        const newPosition = scrollPosition + e.deltaX;
        setScrollPosition(newPosition);
        containerRef.current.scrollLeft = newPosition;
      }
    },
    [scrollPosition]
  );

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollPosition(e.currentTarget.scrollLeft);
  }, []);

  // Generate 50 squares with different colors
  const squares = useMemo(() => {
    return Array.from({ length: 50 }).map((_, index) => {
      // Generate a vibrant hue for each square
      const hue = (index * 137) % 360; // Golden angle approximation for good distribution
      const color = `hsl(${hue}, 80%, 60%)`;
      return { id: index, color };
    });
  }, []);

  return (
    <div className="h-[40%] w-full overflow-hidden relative z-0 bg-purple-500">
      <div
        ref={containerRef}
        className="flex items-center h-full overflow-x-auto scrollbar-hide snap-x snap-mandatory"
        style={{
          scrollBehavior: "smooth",
          WebkitOverflowScrolling: "touch",
        }}
        onWheel={handleWheel}
        onScroll={handleScroll}
      >
        {squares.map((square: any) => (
          <div
            onClick={() => setChosenWall(square.id)}
            key={square.id}
            className="flex-shrink-0 h-4/5 aspect-square mx-4 rounded-lg shadow-lg transform transition-transform duration-200 hover:scale-105 snap-center"
            style={{
              backgroundColor: square.color,
              perspective: "1000px",
              transformStyle: "preserve-3d",
              boxShadow:
                "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
            }}
          >
            <div className="w-full h-full flex items-center justify-center text-white font-bold text-xl">
              {square.id + 1}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
function Marketplace({
  isOpen,
  solanaProvider,
  userSolanaAddress,
}: {
  isOpen: boolean;
  solanaProvider: any;
  userSolanaAddress: string | null;
}) {
  const walls: any[] = []; // TODO: get walls from the contract

  const [mintStatus, setMintStatus] = useState<
    "idle" | "preparing" | "confirming" | "success" | "error"
  >("idle");
  const [buyStatus, setBuyStatus] = useState<{
    status: "idle" | "processing" | "success" | "error";
    wallId: number | null;
    message: string | null;
  }>({ status: "idle", wallId: null, message: null });
  const [mintTxHash, setMintTxHash] = useState<string | null>(null);
  const [buyTxHash, setBuyTxHash] = useState<string | null>(null);
  const [mintError, setMintError] = useState<string | null>(null);
  const [localSupply, setLocalSupply] = useState<number | null>(null);
  const [confetti, setConfetti] = useState(false);

  // Animation states
  const [mintAnimation, setMintAnimation] = useState(false);
  const [purchaseAnimation, setPurchaseAnimation] = useState(false);

  const PROGRAM_ID = "7UhisdAH7dosM1nfF1rbBXYv1Vtgr2yd6W4B7SuZJJVx";

  // Sound effects
  const playSuccessSound = useCallback(() => {
    const audio = new Audio("/sounds/success.mp3");
    audio.volume = 0.5;
    audio.play().catch((e) => console.log("Audio play failed:", e));
  }, []);

  const playErrorSound = useCallback(() => {
    const audio = new Audio("/sounds/error.mp3");
    audio.volume = 0.3;
    audio.play().catch((e) => console.log("Audio play failed:", e));
  }, []);

  const playClickSound = useCallback(() => {
    const audio = new Audio("/sounds/click.mp3");
    audio.volume = 0.2;
    audio.play().catch((e) => console.log("Audio play failed:", e));
  }, []);

  useEffect(() => {
    console.log(
      localSupply,
      mintAnimation,
      purchaseAnimation,
      buyTxHash,
      buyStatus
    );
  }, []);

  const handleBuyWallOnMarketplace = useCallback(
    async (wallId: number) => {
      playClickSound();
      console.log("🔄 Buying wall", wallId);
      if (!solanaProvider) {
        console.log("🚫 No Solana wallet connected");
        setBuyStatus({
          status: "error",
          wallId,
          message:
            "No Solana wallet connected. Please connect your wallet first.",
        });
        playErrorSound();
        return;
      }

      try {
        console.log("🔄 Preparing to buy wall...");
        setBuyStatus({
          status: "processing",
          wallId,
          message: "Preparing transaction...",
        });
        setPurchaseAnimation(true);

        const wall = walls && walls?.find((w) => w.id === wallId);
        if (!wall) {
          throw new Error("Wall not found");
        }
        console.log("THE USER SOLANA ADDRESS IS", userSolanaAddress);

        const ourSolanaAddress = userSolanaAddress;
        if (!ourSolanaAddress) {
          throw new Error("Failed to fetch Solana address");
        }

        // Check user's SOL balance
        const userPubkey = new SolanaPublicKey(ourSolanaAddress);
        const balance = await solanaConnection.getBalance(userPubkey);
        const solBalance = balance / 1000000000; // Convert lamports to SOL

        if (solBalance < wall.price + 0.001) {
          // Add buffer for fees
          throw new Error(
            `Insufficient SOL balance. You need at least ${
              wall.price + 0.001
            } SOL to buy this wall.`
          );
        }

        const { blockhash } = await solanaConnection.getLatestBlockhash();
        if (!blockhash) {
          throw new Error("Failed to fetch latest Solana blockhash");
        }

        // Create a transaction to buy a wall
        const transaction = new SolanaTransaction();

        // Create the buy_wall instruction
        const programId = new SolanaPublicKey(PROGRAM_ID);
        const buyerPubkey = new SolanaPublicKey(ourSolanaAddress);

        // For demo purposes, we're using a dummy wall address
        // In a real implementation, you would fetch the actual wall PDA
        const wallPubkey = new SolanaPublicKey(PROGRAM_ID); // This should be the actual wall PDA
        const sellerPubkey = new SolanaPublicKey(wall.owner.replace("...", "")); // This should be the actual seller pubkey
        const treasuryPubkey = new SolanaPublicKey(PROGRAM_ID); // This should be the actual treasury PDA

        // Add the buy_wall instruction
        transaction.add({
          keys: [
            { pubkey: wallPubkey, isSigner: false, isWritable: true },
            { pubkey: sellerPubkey, isSigner: false, isWritable: true },
            { pubkey: buyerPubkey, isSigner: true, isWritable: true },
            { pubkey: treasuryPubkey, isSigner: false, isWritable: true },
            {
              pubkey: SolanaSystemProgram.programId,
              isSigner: false,
              isWritable: false,
            },
          ],
          programId: programId,
          data: Buffer.from([249, 205, 81, 115, 77, 158, 27, 54]), // buy_wall discriminator
        });

        transaction.recentBlockhash = blockhash;
        transaction.feePayer = buyerPubkey;

        setBuyStatus({
          status: "processing",
          wallId,
          message: "Waiting for wallet confirmation...",
        });

        const { signature } = await solanaProvider.signAndSendTransaction({
          transaction: transaction
            .serialize({
              verifySignatures: false,
              requireAllSignatures: false,
            })
            .toString("base64"),
          network: "mainnet-beta",
        });

        setBuyStatus({
          status: "processing",
          wallId,
          message: "Transaction submitted, waiting for confirmation...",
        });

        console.log(`📨 Transaction sent with signature: ${signature}`);

        // Wait for confirmation
        await solanaConnection.confirmTransaction(signature);

        setBuyTxHash(signature);
        setBuyStatus({
          status: "success",
          wallId,
          message: "Wall purchased successfully!",
        });

        // Trigger success effects
        setConfetti(true);
        playSuccessSound();
        setTimeout(() => setConfetti(false), 5000);
        setTimeout(() => setPurchaseAnimation(false), 1000);

        console.log(`🎉 Wall purchased! Transaction: ${signature}`);
      } catch (error) {
        console.error("❌ Error buying wall:", error);
        setPurchaseAnimation(false);
        playErrorSound();
        setBuyStatus({
          status: "error",
          wallId,
          message:
            error instanceof Error ? error.message : "Unknown error occurred",
        });
      }
    },
    [solanaProvider, walls, playClickSound, playSuccessSound, playErrorSound]
  );

  const mintNextWall = useCallback(async () => {
    playClickSound();
    console.log("🔄 Minting next wall...");
    if (!solanaProvider) {
      console.log("🚫 No Solana wallet connected");
      setMintError(
        "No Solana wallet connected. Please connect your wallet first."
      );
      setMintStatus("error");
      playErrorSound();
      return;
    }

    try {
      console.log("🔄 Preparing to mint wall...");
      setMintStatus("preparing");
      setMintError(null);
      setMintAnimation(true);

      const ourSolanaAddress = userSolanaAddress;
      console.log("THE USER SOLANA ADDRESS IS", userSolanaAddress);
      if (!ourSolanaAddress) {
        throw new Error("Failed to fetch Solana address");
      }

      // Check user's SOL balance
      const userPubkey = new SolanaPublicKey(ourSolanaAddress);
      const balance = await solanaConnection.getBalance(userPubkey);
      const solBalance = balance / 1000000000; // Convert lamports to SOL
      console.log(`User SOL balance: ${solBalance} SOL`);

      // Ensure user has enough SOL for the transaction
      if (solBalance < 0.006942) {
        // Assuming 0.0069420 SOL is needed for the transaction
        throw new Error(
          "Insufficient SOL balance. You need at least 0.0069420 SOL to mint a wall."
        );
      }

      const fromPubkey = new SolanaPublicKey(ourSolanaAddress);
      console.log(`👛 Using wallet: ${fromPubkey.toString().slice(0, 8)}...`);
      const programId = new SolanaPublicKey(PROGRAM_ID);

      // Get the registry PDA
      const registrySeeds = [Buffer.from("registry")];
      const [registryPda] = SolanaPublicKey.findProgramAddressSync(
        registrySeeds,
        programId
      );
      console.log("🔑 Registry PDA:", registryPda.toString());

      const registryAccount = await solanaConnection.getAccountInfo(
        registryPda
      );
      if (!registryAccount) throw new Error("Registry not initialized yet");
      console.log("🔑 Registry account:", registryAccount);

      const REGISTRY_OFFSET = 8 /*disc*/ + 32 /*authority*/ + 32; /*treasury*/
      const mintCount = registryAccount.data.readUInt16LE(REGISTRY_OFFSET); // 72
      console.log("🔑 Mint count:", mintCount);
      setLocalSupply(888 - mintCount);
      const mintCountBuf = Buffer.alloc(2);
      mintCountBuf.writeUInt16LE(mintCount);
      console.log("🔑 Mint count buffer:", mintCountBuf);
      const treasuryPubkey = new SolanaPublicKey(
        "6nJXxD7VQJpnpE3tdWmM9VjTnC5mB2oREeWh5B6EHuzK"
      );

      // wall PDA for "next" wall
      const [wallPda] = SolanaPublicKey.findProgramAddressSync(
        [Buffer.from("wall"), registryPda.toBuffer(), mintCountBuf],
        programId
      );
      console.log("🔑 Wall PDA:", wallPda.toString());

      console.log("🔑 Creating mint instruction");

      const ix = new TransactionInstruction({
        keys: [
          { pubkey: registryPda, isSigner: false, isWritable: true },
          { pubkey: wallPda, isSigner: false, isWritable: true },
          { pubkey: treasuryPubkey, isSigner: false, isWritable: true },
          { pubkey: fromPubkey, isSigner: true, isWritable: true },
          {
            pubkey: SolanaSystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
        ],
        programId,
        data: Buffer.from([254, 62, 48, 58, 150, 117, 204, 141]), // mint_wall
      });
      const tx = new SolanaTransaction().add(ix);
      const { blockhash } = await solanaConnection.getLatestBlockhash();
      console.log("🔑 Blockhash:", blockhash);
      tx.recentBlockhash = blockhash;
      tx.feePayer = fromPubkey;

      setMintStatus("confirming");
      const { signature } = await solanaProvider.signAndSendTransaction({
        transaction: tx,
        network: "mainnet-beta",
      });

      console.log("➕ Added mint instruction to transaction");
      console.log(`📨 Transaction sent with signature: ${signature}`);

      // Wait for confirmation
      console.log("⏳ Waiting for confirmation...");
      await solanaConnection.confirmTransaction(signature);
      console.log("🎯 Transaction confirmed!");

      setMintTxHash(signature);
      setMintStatus("success");
      console.log(
        `🧱 Wall minted! Supply remaining: ${(localSupply || 0) - 1}`
      );
      setLocalSupply((prev) => Math.max(0, (prev || 0) - 1));

      // Trigger success effects
      setConfetti(true);
      playSuccessSound();
      setTimeout(() => setConfetti(false), 5000);
      setTimeout(() => setMintAnimation(false), 1000);
    } catch (error) {
      console.error("❌ Mint error:", error);
      setMintAnimation(false);
      playErrorSound();
      setMintError(
        error instanceof Error ? error.message : "Unknown error occurred"
      );
      setMintStatus("error");
    }
  }, [
    solanaProvider,
    localSupply,
    playClickSound,
    playSuccessSound,
    playErrorSound,
  ]);

  // Render different button states based on mint status
  const renderMintButton = () => {
    switch (mintStatus) {
      case "preparing":
        return (
          <button className="bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-500 text-white py-2.5 px-4 rounded-lg text-7xl font-medium transition-all duration-300 shadow-lg animate-pulse">
            <div className="flex items-center justify-center">
              <div className="animate-spin h-12 w-12 border-4 border-white border-t-transparent rounded-full mr-3"></div>
              preparing...
            </div>
          </button>
        );
      case "confirming":
        return (
          <button className="bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-500 text-white py-2.5 px-4 rounded-lg text-7xl font-medium transition-all duration-300 shadow-lg animate-pulse">
            <div className="flex items-center justify-center">
              <div className="animate-spin h-12 w-12 border-4 border-white border-t-transparent rounded-full mr-3"></div>
              confirming...
            </div>
          </button>
        );
      case "success":
        return (
          <div className="flex flex-col items-center">
            <button className="bg-gradient-to-r from-green-400 to-emerald-500 text-white py-2.5 px-4 rounded-lg text-7xl font-medium transition-all duration-300 shadow-lg hover:shadow-[0_0_20px_rgba(16,185,129,0.5)]">
              minted! 🎉
            </button>
            {mintTxHash && (
              <a
                href={`https://solscan.io/tx/${mintTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 text-blue-300 hover:text-blue-200 underline"
              >
                View transaction
              </a>
            )}
          </div>
        );
      case "error":
        return (
          <div className="flex flex-col items-center">
            <button
              onClick={mintNextWall}
              className="bg-gradient-to-r from-red-500 to-pink-600 text-white py-2.5 px-4 rounded-lg text-7xl font-medium transition-all duration-300 shadow-lg hover:shadow-[0_0_20px_rgba(239,68,68,0.5)]"
            >
              try again
            </button>
            <p className="mt-2 text-red-300 text-center max-w-md">
              {mintError || "Something went wrong"}
            </p>
          </div>
        );
      default:
        if (!userSolanaAddress) {
          return (
            <button className="relative overflow-hidden bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-500 hover:from-pink-600 hover:via-purple-700 hover:to-indigo-600 text-white py-3 px-6 rounded-2xl text-7xl font-bold transition-all duration-300 shadow-xl hover:shadow-[0_0_30px_rgba(236,72,153,0.7)] transform hover:scale-105 group">
              connect wallet
            </button>
          );
        }
        return (
          <button
            className="relative overflow-hidden bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-500 hover:from-pink-600 hover:via-purple-700 hover:to-indigo-600 text-white py-3 px-6 rounded-2xl text-7xl font-bold transition-all duration-300 shadow-xl hover:shadow-[0_0_30px_rgba(236,72,153,0.7)] transform hover:scale-105 group"
            onClick={mintNextWall}
          >
            <span className="relative z-10 flex items-center justify-center gap-3">
              mint wall
            </span>
            <span className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent opacity-0 group-hover:opacity-20 transition-opacity duration-300"></span>
            <span className="absolute -inset-x-1 bottom-0 h-1 bg-gradient-to-r from-pink-300 via-purple-300 to-indigo-300 transform translate-y-1 group-hover:translate-y-0 transition-transform duration-300"></span>
          </button>
        );
    }
  };

  return (
    <div
      className={`z-50 fixed bottom-0 left-0 right-0 bg-gradient-to-br from-purple-900 via-indigo-800 to-blue-900 h-[90vh] rounded-t-xl shadow-lg transform transition-transform duration-500 ease-in-out ${
        isOpen ? "translate-y-0" : "translate-y-full"
      }`}
      style={{
        maxHeight: "80vh",
        overflowY: "auto",
        backgroundSize: "400% 400%",
        animation: "gradient 15s ease infinite",
      }}
    >
      {confetti && (
        <div className="fixed inset-0 pointer-events-none z-50">
          <div className="absolute inset-0 overflow-hidden">
            {Array.from({ length: 100 }).map((_, i) => (
              <div
                key={i}
                className="absolute animate-confetti"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `-5%`,
                  width: `${Math.random() * 10 + 5}px`,
                  height: `${Math.random() * 10 + 5}px`,
                  background: `hsl(${Math.random() * 360}, 100%, 50%)`,
                  borderRadius: Math.random() > 0.5 ? "50%" : "0",
                  transform: `rotate(${Math.random() * 360}deg)`,
                  animation: `fall ${Math.random() * 3 + 2}s linear forwards`,
                }}
              />
            ))}
          </div>
        </div>
      )}

      <div className="p-6 relative">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.8)_0%,_transparent_70%)]"></div>
        {localSupply && localSupply > 0 ? (
          <div className="flex flex-col items-center justify-center">
            <h2 className="text-3xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-pink-300 via-purple-300 to-indigo-400 relative z-10">
              {localSupply}/888 available
            </h2>
            {renderMintButton()}
            <small className="mt-12 text-center text-xl text-purple-100">
              0.0069420 SOL / 1.2 usd
            </small>
            <small className="mt-12 text-center text-xl text-purple-100">
              there is a marketplace embedded on this smart contract for walls
            </small>
            <small className="mt-12 text-center text-xl text-purple-100">
              i take 8% of every sale
            </small>
            <small className="mt-12 text-center text-xl text-purple-100">
              to unlist a wall you must pay 8% of the listing price
            </small>
          </div>
        ) : (
          <>
            <h2 className="text-3xl font-bold mb-6 text-transparent bg-clip-text bg-gradient-to-r from-pink-300 via-purple-300 to-indigo-400 relative z-10">
              walls for sale
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {walls.map((wall) => (
                <div
                  key={wall.id}
                  className="border border-purple-500/30 rounded-xl p-5 backdrop-blur-sm bg-white/10 hover:bg-white/20 transition-all duration-300 transform hover:scale-105 hover:shadow-[0_0_15px_rgba(167,139,250,0.5)]"
                >
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-xl font-semibold text-pink-200">
                      Wall #{wall.id}
                    </h3>
                    <span className="bg-gradient-to-r from-blue-400 to-purple-500 text-white px-3 py-1 rounded-full text-xs font-medium">
                      {wall.state}
                    </span>
                  </div>
                  <div className="text-sm text-indigo-100">
                    <p className="mb-2">Owner: {truncateAddress(wall.owner)}</p>
                    <p className="font-medium text-lg text-yellow-200">
                      {wall.price} SOL
                    </p>
                  </div>
                  <button
                    onClick={() => handleBuyWallOnMarketplace(wall.id)}
                    className="mt-4 w-full bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-500 hover:from-pink-600 hover:via-purple-700 hover:to-indigo-600 text-white py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-300 shadow-lg hover:shadow-[0_0_20px_rgba(236,72,153,0.5)]"
                  >
                    Buy
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SignSolanaMessage() {
  const [signature, setSignature] = useState<string | undefined>();
  const [signError, setSignError] = useState<Error | undefined>();
  const [signPending, setSignPending] = useState(false);

  const { getSolanaProvider } = sdk.experimental;
  const handleSignMessage = useCallback(async () => {
    setSignPending(true);
    try {
      const solanaProvider = await getSolanaProvider();
      if (!solanaProvider) {
        throw new Error("no Solana provider");
      }
      const result = await solanaProvider.signMessage("Hello from Frames v2!");
      setSignature(result.signature);
      setSignError(undefined);
    } catch (e) {
      if (e instanceof Error) {
        setSignError(e);
      }
      throw e;
    } finally {
      setSignPending(false);
    }
  }, [getSolanaProvider]);

  return (
    <>
      <Button
        onClick={handleSignMessage}
        disabled={signPending}
        isLoading={signPending}
      >
        Sign Message
      </Button>
      {signError && renderError(signError)}
      {signature && (
        <div className="mt-2 text-xs">
          <div>Signature: {signature}</div>
        </div>
      )}
    </>
  );
}

const jpsPhantomSolanaWallet = "6nJXxD7VQJpnpE3tdWmM9VjTnC5mB2oREeWh5B6EHuzK";

function SendTokenSolana() {
  const [state, setState] = useState<
    | { status: "none" }
    | { status: "pending" }
    | { status: "error"; error: Error }
    | { status: "success"; signature: string; type: "send" | "approve" }
  >({ status: "none" });

  const [selectedSymbol, setSelectedSymbol] = useState(""); // Initialize with empty string
  const [associatedMapping, setAssociatedMapping] = useState<
    { token: string; decimals: number } | undefined
  >(undefined);

  const [destinationAddress, setDestinationAddress] = useState("");
  const [simulation, setSimulation] = useState("");
  const [useVersionedTransaction, setUseVersionedTransaction] = useState(false);

  const { getSolanaProvider } = sdk.experimental;

  const setCurrentAddress = useCallback(async () => {
    const solanaProvider = await getSolanaProvider();
    if (!solanaProvider) {
      throw new Error(
        "No Solana provider found. Make sure your wallet is connected and configured."
      );
    }

    // The connect method is often called when the app loads or when the user explicitly connects their wallet.
    // It might not be needed right before every transaction if the wallet is already connected.
    // However, calling it here ensures we have the public key.
    const connectResult = await solanaProvider.request({
      method: "connect",
      // params: [{ onlyIfTrusted: true }] // Optional: attempt to connect without a popup if already trusted
    });
    setDestinationAddress(connectResult?.publicKey);
  }, [getSolanaProvider]);

  useEffect(() => {
    setCurrentAddress();
  }, [setCurrentAddress]);

  const tokenOptions = [
    { label: "Select a token", value: "", disabled: true }, // Added a disabled default option
    { label: "USDC", value: "USDC" },
    { label: "Tether", value: "Tether" },
    { label: "Bonk", value: "Bonk" },
    { label: "GOGS", value: "GOGS" },
  ];

  const handleValueChange = (value: string) => {
    setSelectedSymbol(value);
    setState({ status: "none" }); // Reset status when token changes
    if (!value) {
      setAssociatedMapping(undefined);
      return;
    }

    let valueToSet = "";
    let decimalsToSet = 0;
    switch (value) {
      case "USDC":
        valueToSet = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"; // USDC Mint address
        decimalsToSet = 6;
        break;
      case "Tether":
        valueToSet = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";
        decimalsToSet = 6;
        break;
      case "Bonk":
        valueToSet = "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263";
        decimalsToSet = 5;
        break;
      case "GOGS":
        valueToSet = "HxptKywiNbHobJD4XMMBn1czMUGkdMrUkeUErQLKbonk";
        decimalsToSet = 6;
        break;
      default:
        // It's better to handle this case gracefully, e.g., by clearing the mapping
        // or simply not setting it if the value is unexpected (though the select should prevent this)
        console.error("Invalid symbol selected:", value);
        setAssociatedMapping(undefined);
        return;
    }
    setAssociatedMapping({
      token: valueToSet,
      decimals: decimalsToSet,
    });
  };

  const handleApprove = useCallback(async () => {
    if (!selectedSymbol || !associatedMapping) {
      setState({
        status: "error",
        error: new Error("Please select a token to approve."),
      });
      return;
    }

    if (!destinationAddress) {
      setState({
        status: "error",
        error: new Error("Please enter a destination address."),
      });
      return;
    }

    setState({ status: "pending" });
    try {
      const solanaProvider = await getSolanaProvider();
      if (!solanaProvider) {
        throw new Error(
          "No Solana provider found. Make sure your wallet is connected and configured."
        );
      }

      const connectResult = await solanaProvider.request({
        method: "connect",
      });

      const warpletPublicKey = new SolanaPublicKey(connectResult?.publicKey);
      if (
        !connectResult ||
        typeof connectResult !== "object" ||
        !("publicKey" in connectResult) ||
        !connectResult.publicKey
      ) {
        throw new Error(
          "Failed to connect to Solana wallet or fetch public key."
        );
      }

      const { blockhash } = await solanaConnection.getLatestBlockhash();
      if (!blockhash) {
        throw new Error("Failed to fetch the latest Solana blockhash.");
      }

      const transaction = new SolanaTransaction();

      const tokenMintPublicKey = new SolanaPublicKey(associatedMapping.token);
      const spenderPublicKey = new SolanaPublicKey(destinationAddress);

      // Calculate the amount to approve: 1000 tokens in smallest units
      const amountToApprove = 1000;
      const amountInSmallestUnit = BigInt(
        Math.round(amountToApprove * Math.pow(10, associatedMapping.decimals))
      );

      if (amountInSmallestUnit <= 0) {
        throw new Error(
          "Calculated token amount to approve is zero or less. Check decimals and amount."
        );
      }

      // Get the owner's ATA for the token
      const ownerAta = await getAssociatedTokenAddress(
        tokenMintPublicKey,
        warpletPublicKey
      );

      // Add the approve instruction
      transaction.add(
        createApproveInstruction(
          ownerAta, // Token account to approve from
          spenderPublicKey, // Account authorized to transfer tokens
          warpletPublicKey, // Owner of the token account
          amountInSmallestUnit // Amount to approve in smallest units
        )
      );

      transaction.recentBlockhash = blockhash;
      transaction.feePayer = new SolanaPublicKey(warpletPublicKey);

      let finalTransaction: SolanaTransaction | VersionedTransaction =
        transaction;

      if (useVersionedTransaction) {
        // Create a v0 compatible message
        const messageV0 = new TransactionMessage({
          payerKey: warpletPublicKey,
          recentBlockhash: blockhash,
          instructions: transaction.instructions,
        }).compileToV0Message();

        // Create a new VersionedTransaction
        finalTransaction = new VersionedTransaction(messageV0);
        console.log("Created versioned transaction for approval");
      }

      console.log("Simulating approval transaction:", finalTransaction);
      const { signature } = await solanaProvider.signAndSendTransaction({
        transaction: finalTransaction,
      });
      setState({ status: "success", signature, type: "approve" });
      console.log("Approval transaction successful, signature:", signature);
    } catch (e) {
      console.error("Approval transaction failed:", e);
      if (e instanceof Error) {
        setState({ status: "error", error: e });
      } else {
        setState({ status: "error", error: new Error(String(e)) });
      }
    }
  }, [
    getSolanaProvider,
    selectedSymbol,
    associatedMapping,
    destinationAddress,
    useVersionedTransaction,
  ]);

  const handleSend = useCallback(async () => {
    if (!selectedSymbol || !associatedMapping) {
      setState({
        status: "error",
        error: new Error("Please select a token to send."),
      });
      return;
    }

    setState({ status: "pending" });
    try {
      const solanaProvider = await getSolanaProvider();
      if (!solanaProvider) {
        throw new Error(
          "No Solana provider found. Make sure your wallet is connected and configured."
        );
      }

      // The connect method is often called when the app loads or when the user explicitly connects their wallet.
      // It might not be needed right before every transaction if the wallet is already connected.
      // However, calling it here ensures we have the public key.
      const connectResult = await solanaProvider.request({
        method: "connect",
        // params: [{ onlyIfTrusted: true }] // Optional: attempt to connect without a popup if already trusted
      });

      const warpletPublicKey = new SolanaPublicKey(connectResult?.publicKey);
      // Type guard to ensure connectResult is not null and has a publicKey
      if (
        !connectResult ||
        typeof connectResult !== "object" ||
        !("publicKey" in connectResult) ||
        !connectResult.publicKey
      ) {
        throw new Error(
          "Failed to connect to Solana wallet or fetch public key."
        );
      }
      const { blockhash } = await solanaConnection.getLatestBlockhash();
      if (!blockhash) {
        throw new Error("Failed to fetch the latest Solana blockhash.");
      }

      const transaction = new SolanaTransaction();

      const tokenMintPublicKey = new SolanaPublicKey(associatedMapping.token);
      const recipientPublicKey = new SolanaPublicKey(destinationAddress);

      // Calculate the amount in the smallest unit of the token
      // Sending 0.1 of the token
      const amountToSend = 0.1;
      const amountInSmallestUnit = BigInt(
        Math.round(amountToSend * Math.pow(10, associatedMapping.decimals))
      );

      if (amountInSmallestUnit <= 0) {
        throw new Error(
          "Calculated token amount to send is zero or less. Check decimals and amount."
        );
      }

      // 1. Get the sender's ATA for the token
      const fromAta = await getAssociatedTokenAddress(
        tokenMintPublicKey,
        warpletPublicKey
      );

      // 2. Get the recipient's ATA for the token
      const toAta = await getAssociatedTokenAddress(
        tokenMintPublicKey,
        recipientPublicKey
      );

      // 3. Check if the recipient's ATA exists. If not, add an instruction to create it.
      const toAtaAccountInfo = await solanaConnection.getAccountInfo(toAta);
      if (!toAtaAccountInfo) {
        console.log(
          `Recipient's Associated Token Account (${toAta.toBase58()}) for ${selectedSymbol} does not exist. Creating it.`
        );
        transaction.add(
          createAssociatedTokenAccountInstruction(
            warpletPublicKey,
            toAta,
            recipientPublicKey,
            tokenMintPublicKey
            // TOKEN_PROGRAM_ID and ASSOCIATED_TOKEN_PROGRAM_ID are often defaulted by the library
          )
        );
      }

      // 4. Add the token transfer instruction
      transaction.add(
        createTransferCheckedInstruction(
          fromAta, // Source_associated_token_account
          tokenMintPublicKey, // Token mint_address
          toAta, // Destination_associated_token_account
          warpletPublicKey, // Wallet address of the owner of the source account
          amountInSmallestUnit, // Amount, in smallest units (e.g., lamports for SOL, or smallest unit for the token)
          associatedMapping.decimals // Decimals of the token (for validation)
          // [],                  // Optional: multiSigners
          // TOKEN_PROGRAM_ID     // Optional: SPL Token program ID, defaults correctly in recent library versions
        )
      );

      // This is a SOL transfer, not a token transfer.
      // To send SPL tokens, you'd use Token.createTransferInstruction from @solana/spl-token
      // and need the sender's token account address and the recipient's token account address.
      // The current code sends 0.000000001 SOL (1 lamport).
      // If you intend to send SPL tokens (USDC, $TRUMP), this part needs to be changed significantly.

      // For now, I'll keep the SOL transfer as in your original code,
      // but highlight that this doesn't use the selected `associatedMapping` for token details.
      // To send the selected token, you would use associatedMapping.token (mint address)
      // and associatedMapping.decimals.
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = new SolanaPublicKey(warpletPublicKey);

      let finalTransaction: SolanaTransaction | VersionedTransaction =
        transaction;

      if (useVersionedTransaction) {
        // Create a v0 compatible message
        const messageV0 = new TransactionMessage({
          payerKey: warpletPublicKey,
          recentBlockhash: blockhash,
          instructions: transaction.instructions,
        }).compileToV0Message();

        // Create a new VersionedTransaction
        finalTransaction = new VersionedTransaction(messageV0);
        console.log("Created versioned transaction");
      }

      console.log("Simulating transaction:", finalTransaction);
      const simulation = await solanaConnection.simulateTransaction(
        finalTransaction as VersionedTransaction
      );
      setSimulation(JSON.stringify(simulation.value));

      // The provider's signAndSendTransaction method might take the transaction directly
      // or might require it to be serialized. Check your provider's documentation.
      // For Phantom, typically you pass the Transaction object.
      const { signature } = await solanaProvider.signAndSendTransaction({
        transaction: finalTransaction, // Pass the SolanaTransaction or VersionedTransaction object
        // requestPayer: ourSolanaAddress, // some providers might need this
        // network: 'devnet', // some providers might need this
      });
      setState({ status: "success", signature, type: "send" });
      console.log("Transaction successful, signature:", signature);
    } catch (e) {
      console.error("Transaction failed:", e);
      if (e instanceof Error) {
        setState({ status: "error", error: e });
      } else {
        // Handle cases where e is not an Error instance (e.g., string or object)
        setState({ status: "error", error: new Error(String(e)) });
      }
      // Removed `throw e;` as it might cause unhandled promise rejection if not caught upstream.
      // The state update is usually sufficient for UI feedback.
    }
  }, [
    getSolanaProvider,
    selectedSymbol,
    associatedMapping,
    destinationAddress,
    useVersionedTransaction,
  ]); // Added solanaConnection

  return (
    <div className="p-4 max-w-md mx-auto space-y-4">
      {" "}
      {/* Added some basic styling for layout */}
      <h2 className="text-xl font-semibold">Send Solana Transaction</h2>
      <div>
        <label
          htmlFor="destination-address"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Destination Address
        </label>
        <input
          type="text"
          id="destination-address"
          value={destinationAddress}
          onChange={(e) => setDestinationAddress(e.target.value)}
          className="w-full bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
        />
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="use-versioned"
          checked={useVersionedTransaction}
          onChange={(e) => setUseVersionedTransaction(e.target.checked)}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded bg-white dark:bg-gray-900"
        />
        <label
          htmlFor="use-versioned"
          className="text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Use Versioned Transaction
        </label>
      </div>
      <div>
        <label
          htmlFor="token-select"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Select Token
        </label>
        <select
          value={selectedSymbol}
          onChange={(e) => handleValueChange(e.target.value)}
          className="w-full bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
        >
          {tokenOptions.map((option) => (
            <option
              key={option.value}
              value={option.value}
              disabled={option.disabled}
            >
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex gap-2">
        <Button
          onClick={handleSend}
          disabled={state.status === "pending" || !selectedSymbol} // Disable if no token selected or pending
          isLoading={state.status === "pending"}
          className="flex-1" // Make button share width equally
        >
          Send Token {selectedSymbol ? `(0.1 ${selectedSymbol})` : ""}
        </Button>

        <Button
          onClick={handleApprove}
          disabled={state.status === "pending" || !selectedSymbol} // Disable if no token selected or pending
          isLoading={state.status === "pending"}
          className="flex-1" // Make button share width equally
        >
          Approve {selectedSymbol ? `(1000 ${selectedSymbol})` : ""}
        </Button>
      </div>
      {state.status === "none" && !selectedSymbol && (
        <div className="mt-2 text-xs text-gray-500">Please select a token.</div>
      )}
      {state.status === "error" && renderError(state.error)}
      {state.status === "success" && (
        <div className="mt-2 text-xs p-2 bg-green-50 border border-green-200 rounded">
          <div className="font-semibold text-green-700">
            {state.type === "approve" ? "Approval" : "Send"} Transaction
            Successful!
          </div>
          <div>
            Signature:{" "}
            <a
              href={`https://explorer.solana.com/tx/${state.signature}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              {truncateAddress(state.signature)}
            </a>
          </div>
        </div>
      )}
      {simulation && (
        <div className="mt-2 text-xs p-2 bg-green-50 border border-green-200 rounded">
          <div className="font-semibold text-green-700">Simulation Result:</div>
          <div>{simulation}</div>
        </div>
      )}
    </div>
  );
}

function SendSolana() {
  const [state, setState] = useState<
    | { status: "none" }
    | { status: "pending" }
    | { status: "error"; error: Error }
    | { status: "success"; signature: string }
  >({ status: "none" });

  const { getSolanaProvider } = sdk.experimental;

  const handleSend = useCallback(async () => {
    setState({ status: "pending" });
    try {
      const solanaProvider = await getSolanaProvider();
      if (!solanaProvider) {
        throw new Error("no Solana provider");
      }

      const result = await solanaProvider.request({
        method: "connect",
      });
      const ourSolanaAddress = result?.publicKey.toString();
      if (!ourSolanaAddress) {
        throw new Error("failed to fetch Solana address");
      }

      const { blockhash } = await solanaConnection.getLatestBlockhash();
      if (!blockhash) {
        throw new Error("failed to fetch latest Solana blockhash");
      }

      const transaction = new SolanaTransaction();
      transaction.add(
        SolanaSystemProgram.transfer({
          fromPubkey: new SolanaPublicKey(ourSolanaAddress),
          toPubkey: new SolanaPublicKey(jpsPhantomSolanaWallet),
          lamports: 1n,
        })
      );
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = new SolanaPublicKey(ourSolanaAddress);

      const simulation = await solanaConnection.simulateTransaction(
        transaction
      );
      if (simulation.value.err) {
        throw new Error("Simulation failed");
      }

      const { signature } = await solanaProvider.signAndSendTransaction({
        transaction,
      });
      setState({ status: "success", signature });
    } catch (e) {
      if (e instanceof Error) {
        setState({ status: "error", error: e });
      } else {
        setState({ status: "none" });
      }
      throw e;
    }
  }, [getSolanaProvider]);

  return (
    <>
      <Button
        onClick={handleSend}
        disabled={state.status === "pending"}
        isLoading={state.status === "pending"}
      >
        Send Transaction
      </Button>
      {state.status === "error" && renderError(state.error)}
      {state.status === "success" && (
        <div className="mt-2 text-xs">
          <div>Hash: {truncateAddress(state.signature)}</div>
        </div>
      )}
    </>
  );
}

const renderError = (error: Error | null) => {
  if (!error) return null;
  if (error instanceof BaseError) {
    const isUserRejection = error.walk(
      (e) => e instanceof UserRejectedRequestError
    );

    if (isUserRejection) {
      return <div className="text-red-500 text-xs mt-1">Rejected by user.</div>;
    }
  }

  return <div className="text-red-500 text-xs mt-1">{error.message}</div>;
};

function QuickAuth({
  setToken,
  token,
}: {
  setToken: (token: string | null) => void;
  token: string | null;
}) {
  const [signingIn, setSigningIn] = useState(false);
  const [signInFailure, setSignInFailure] = useState<string>();

  const handleSignIn = useCallback(async () => {
    try {
      setSigningIn(true);
      setSignInFailure(undefined);

      const { token } = await sdk.experimental.quickAuth();

      setToken(token);

      // Demonstrate hitting an authed endpoint
      const response = await fetch("/api/me", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Network response was not ok");
      }

      return;
    } catch (e) {
      if (e instanceof SignInCore.RejectedByUser) {
        setSignInFailure("Rejected by user");
        return;
      }

      setSignInFailure("Unknown error");
    } finally {
      setSigningIn(false);
    }
  }, [setToken]);

  const handleSignOut = useCallback(async () => {
    setToken(null);
  }, [setToken]);

  return (
    <>
      {status !== "authenticated" && (
        <Button onClick={handleSignIn} disabled={signingIn}>
          Sign In
        </Button>
      )}
      {status === "authenticated" && (
        <Button onClick={handleSignOut}>Sign out</Button>
      )}
      {token && (
        <>
          <div className="my-2 p-2 text-xs overflow-x-scroll bg-gray-100 dark:bg-gray-800 rounded-lg font-mono">
            <div className="font-semibold text-gray-500 dark:text-gray-300 mb-1">
              Raw JWT
            </div>
            <div className="whitespace-pre">{token}</div>
          </div>
          <div className="my-2 p-2 text-xs overflow-x-scroll bg-gray-100 dark:bg-gray-800 rounded-lg font-mono">
            <div className="font-semibold text-gray-500 dark:text-gray-300 mb-1">
              Decoded JWT
            </div>
            <div className="whitespace-pre">
              {JSON.stringify(jwtDecode(token), undefined, 2)}
            </div>
          </div>
        </>
      )}
      {signInFailure && !signingIn && (
        <div className="my-2 p-2 text-xs overflow-x-scroll bg-gray-100 dark:bg-gray-800 rounded-lg font-mono">
          <div className="font-semibold text-gray-500 dark:text-gray-300 mb-1">
            SIWF Result
          </div>
          <div className="whitespace-pre">{signInFailure}</div>
        </div>
      )}
    </>
  );
}
