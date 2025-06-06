// components/ActivateWallButton.tsx
import { useState, useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction } from "@solana/web3.js";
import { motion } from "framer-motion";
import { Button } from "./ui/Button";
import { PROGRAM_ID, ixActivateWall } from "../lib/solana/wallcaster";

interface ActivateWallButtonProps {
  wallPda: string;
  castHashHex: string;
}

type ActivationState =
  | { status: "idle" }
  | { status: "pending" }
  | { status: "success"; signature: string }
  | { status: "error"; error: string };

export default function ActivateWallButton({
  wallPda,
  castHashHex,
}: ActivateWallButtonProps) {
  const [state, setState] = useState<ActivationState>({ status: "idle" });
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();

  const activateWall = useCallback(async () => {
    if (!publicKey || !connection) {
      setState({ status: "error", error: "Wallet not connected" });
      return;
    }

    setState({ status: "pending" });

    try {
      console.log("🎯 Starting wall activation...");
      console.log("Wall PDA:", wallPda);
      console.log("Cast Hash:", castHashHex);
      console.log("Owner:", publicKey.toString());

      // Validate inputs
      if (!wallPda || !castHashHex) {
        throw new Error("Missing wall PDA or cast hash");
      }

      // Convert wall PDA string to PublicKey
      const wallPublicKey = new PublicKey(wallPda);

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
        // Active
        throw new Error("Wall is already activated");
      }

      if (currentState === 2) {
        // Listed
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
      const cleanCastHash = castHashHex.startsWith("0x")
        ? castHashHex.slice(2)
        : castHashHex;

      // Validate hex string
      if (!/^[0-9a-fA-F]+$/.test(cleanCastHash)) {
        throw new Error(`Invalid cast hash format: ${castHashHex}`);
      }

      console.log("✅ Cast hash validated:", cleanCastHash);

      // Get latest blockhash
      const { blockhash, lastValidBlockHeight } =
        await connection.getLatestBlockhash();

      // Create the activation instruction
      const activateInstruction = ixActivateWall(
        wallPublicKey,
        publicKey,
        castHashHex // Pass the original hex string with or without 0x
      );

      console.log("🔧 Activation instruction created");
      console.log("Instruction keys:", activateInstruction.keys);
      console.log("Instruction data length:", activateInstruction.data.length);

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
          if (Array.isArray(instructionError) && instructionError.length > 1) {
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

      // Send the transaction
      console.log("📤 Sending transaction...");
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

      console.log("🎉 Wall activated successfully!");
      setState({ status: "success", signature });
    } catch (error: any) {
      console.error("❌ Activation failed:", error);
      setState({
        status: "error",
        error: error.message || "Unknown error occurred",
      });
    }
  }, [publicKey, connection, wallPda, castHashHex, sendTransaction]);

  const getButtonText = () => {
    switch (state.status) {
      case "pending":
        return "ACTIVATING...";
      case "success":
        return "✅ ACTIVATED";
      case "error":
        return "RETRY ACTIVATION";
      default:
        return "🚀 ACTIVATE WALL";
    }
  };

  const isDisabled = state.status === "pending" || state.status === "success";

  return (
    <div className="space-y-4">
      <motion.div
        whileHover={!isDisabled ? { scale: 1.05 } : {}}
        whileTap={!isDisabled ? { scale: 0.95 } : {}}
      >
        <Button
          onClick={activateWall}
          disabled={isDisabled}
          className={`
            text-xl px-8 py-4 font-bold transition-all duration-200
            ${
              state.status === "success"
                ? "bg-green-600 hover:bg-green-700"
                : state.status === "error"
                ? "bg-red-600 hover:bg-red-700"
                : "bg-purple-600 hover:bg-purple-700"
            }
            ${isDisabled ? "opacity-50 cursor-not-allowed" : ""}
          `}
        >
          <motion.span
            animate={state.status === "pending" ? { rotate: [0, 360] } : {}}
            transition={
              state.status === "pending"
                ? { duration: 1, repeat: Infinity, ease: "linear" }
                : {}
            }
          >
            {getButtonText()}
          </motion.span>
        </Button>
      </motion.div>

      {/* Status messages */}
      {state.status === "success" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-2"
        >
          <p className="text-green-400 font-semibold">
            🎉 Wall activated successfully!
          </p>
          <motion.a
            href={`https://solscan.io/tx/${state.signature}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 underline text-sm hover:text-blue-300"
            whileHover={{ scale: 1.05 }}
          >
            View transaction on Solscan
          </motion.a>
        </motion.div>
      )}

      {state.status === "error" && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-red-900/20 border border-red-500/30 rounded-lg p-4"
        >
          <p className="text-red-400 text-sm font-medium mb-2">
            ❌ Activation Failed
          </p>
          <p className="text-red-300 text-xs leading-relaxed">{state.error}</p>
        </motion.div>
      )}

      {/* Debug info in development */}
      {process.env.NODE_ENV === "development" && (
        <details className="mt-4">
          <summary className="text-xs text-gray-500 cursor-pointer">
            Debug Info
          </summary>
          <div className="mt-2 text-xs text-gray-400 space-y-1">
            <p>Wall PDA: {wallPda}</p>
            <p>Cast Hash: {castHashHex}</p>
            <p>Owner: {publicKey?.toString()}</p>
            <p>Status: {state.status}</p>
          </div>
        </details>
      )}
    </div>
  );
}
