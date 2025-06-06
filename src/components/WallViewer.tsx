// src/components/WallViewer.tsx
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import sdk from "@farcaster/frame-sdk";
import { ActivatedWall } from "../types/Wall";
import { Button } from "./ui/Button";
import axios from "axios";

export default function WallViewer({
  wall,
  onClose,
}: {
  wall: ActivatedWall;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [replies, setReplies] = useState<
    { hash: string; text: string; timestamp: number }[]
  >([]);
  const remaining = 180 - text.length;

  useEffect(() => {
    const fetchReplies = async () => {
      try {
        console.log("GOING TO FETCH REPLIES", import.meta.env.VITE_API_URL);

        const response = await axios.get(
          `${import.meta.env.VITE_API_URL}/wallcaster/get-wall-information/${
            wall.pda
          }`
        );
        console.log("RESPONSE", response.data);
        const formattedReplies = response.data.writings.map((reply: any) => ({
          hash: reply.hash,
          text: reply.text,
          timestamp: reply.timestamp,
        }));
        // Sort replies from oldest to newest
        formattedReplies.sort((a: any, b: any) => a.timestamp - b.timestamp);
        setReplies(formattedReplies);
      } catch (e) {
        console.error("Error fetching replies:", e);
      }
    };
    fetchReplies();
  }, [wall.castHash]);

  const send = async () => {
    try {
      if (!text.trim()) return;
      await sdk.actions.composeCast({
        text,
        parent: { type: "cast", hash: wall.castHash }, // reply-to parent
      });
      setText("");
      onClose();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col bg-gray-900 text-white"
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      exit={{ scale: 0 }}
      transition={{ type: "spring", stiffness: 200 }}
    >
      <header className="flex items-center gap-4 p-4 border-b border-gray-700">
        <img
          src={wall.pfp ?? "/fallback-pfp.png"}
          className="h-12 w-12 rounded-full"
        />
        <div className="flex-1">
          <h2 className="font-bold">{wall.username}</h2>
        </div>
        <button className="text-white w-fit px-8" onClick={onClose}>
          ✕
        </button>
      </header>

      <main className="flex-1 flex flex-col p-4 gap-4">
        <div className="flex-1 overflow-y-auto space-y-4">
          {replies.map((reply) => (
            <div key={reply.hash} className="bg-gray-800 rounded-lg p-4">
              <p className="text-white">{reply.text}</p>
              <p className="text-xs text-gray-400 mt-2">
                {new Date(reply.timestamp * 1000).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
        <textarea
          value={text}
          maxLength={280}
          onChange={(e) => {
            const newText = e.target.value.replace(/\n/g, " ");
            setText(newText);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
            }
          }}
          placeholder="max 180 chars"
          className="flex-1 bg-gray-800 p-3 rounded resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        <div className="flex justify-between text-sm opacity-70">
          <span>{remaining} left</span>
          <Button
            onClick={send}
            disabled={!text.trim()}
            className="bg-purple-600 hover:bg-purple-700"
          >
            write on frick ✨
          </Button>
        </div>
      </main>
    </motion.div>
  );
}
