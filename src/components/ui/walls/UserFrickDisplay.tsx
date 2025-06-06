import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import sdk from "@farcaster/frame-sdk";
import { Frick } from "../../../App";

interface Reply {
  text: string;
  timestamp: string;
  author: {
    username: string;
    pfp_url: string;
  };
  castHash: string;
}

interface UserFrickDisplayProps {
  chosenFrick: Frick;
  onClose: () => void;
}

export default function UserFrickDisplay({
  chosenFrick,
  onClose,
}: UserFrickDisplayProps) {
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use ref to prevent duplicate API calls
  const fetchedRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // OPTIMIZATION 1: Memoized fetch function with abort controller
  const fetchReplies = useCallback(async () => {
    if (fetchedRef.current) return;

    // Cancel any existing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    fetchedRef.current = true;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/fricks/by-hash/${
          chosenFrick.castHash
        }`,
        {
          signal: abortControllerRef.current.signal,
          // Add cache headers for better performance
          headers: {
            "Cache-Control": "max-age=30", // Cache for 30 seconds
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch replies: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to load wall data");
      }

      // OPTIMIZATION 2: More efficient data transformation
      const formattedReplies =
        data.data.replies?.map((reply: any) => ({
          text: reply.text,
          timestamp: new Date(reply.timestamp).toLocaleString(),
          author: {
            username: reply.author.username,
            pfp_url: reply.author.pfp_url,
          },
          castHash: reply.hash,
        })) || [];

      setReplies(formattedReplies);
    } catch (error: any) {
      if (error.name !== "AbortError") {
        console.error("Failed to fetch replies:", error);
        setError(error.message || "Failed to load replies");
      }
    } finally {
      if (!abortControllerRef.current?.signal.aborted) {
        setLoading(false);
      }
    }
  }, [chosenFrick.castHash]);

  // OPTIMIZATION 3: Only fetch once on mount
  useEffect(() => {
    fetchReplies();

    // Cleanup on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchReplies]);

  // OPTIMIZATION 4: Optimized submit handler
  const handleSubmit = useCallback(async () => {
    if (!text.trim() || submitting) return;

    setSubmitting(true);
    try {
      if (!chosenFrick.castHash) {
        throw new Error("No cast hash found");
      }
      const result = await sdk.actions.composeCast({
        text: text.trim(),
        parent: {
          type: "cast" as const,
          hash: chosenFrick.castHash,
        },
      });

      setText("");

      // OPTIMIZATION 5: Optimistic update - add the new reply immediately
      if (result?.cast) {
        const newReply: Reply = {
          text: text.trim(),
          timestamp: new Date().toLocaleString(),
          author: {
            username: "You", // Will be replaced when we refresh
            pfp_url: "", // Will be replaced when we refresh
          },
          castHash: result.cast.hash,
        };
        setReplies((prev) => [newReply, ...prev]);
      }

      // Optional: Refresh replies after a short delay to get the real data
      setTimeout(() => {
        fetchedRef.current = false;
        fetchReplies();
      }, 2000);
    } catch (error) {
      console.error("Failed to post reply:", error);
      setError("Failed to post reply. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [text, submitting, chosenFrick.castHash, fetchReplies]);

  // OPTIMIZATION 6: Optimized text change handler
  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newText = e.target.value.replace(/\n/g, "");
      if (newText.length <= 180) {
        setText(newText);
        setError(null); // Clear any previous errors
      }
    },
    []
  );

  // OPTIMIZATION 7: Memoized reply click handler
  const handleReplyClick = useCallback((castHash: string) => {
    sdk.actions.viewCast({ hash: castHash });
  }, []);

  // OPTIMIZATION 8: Handle escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  // OPTIMIZATION 9: Early return for invalid wall
  if (!chosenFrick?.castHash) {
    return (
      <div className="text-center py-8 text-red-400">Invalid wall data</div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-gray-800 rounded-xl w-full max-w-md h-[80vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-700 flex items-center gap-3">
          <img
            src={chosenFrick?.owner?.pfpUrl}
            alt={chosenFrick?.owner?.username}
            className="w-12 h-12 rounded-full"
            loading="lazy"
          />
          <div className="flex-1">
            <h3 className="font-bold text-lg">
              @{chosenFrick?.owner?.username}
            </h3>
            <p className="text-sm text-gray-400">
              {replies.length} {replies.length === 1 ? "reply" : "replies"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Error Message */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-red-900/20 border-b border-red-500/30 px-4 py-2"
            >
              <p className="text-red-400 text-sm">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Compose Area */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex gap-2">
            <textarea
              value={text}
              onChange={handleTextChange}
              placeholder={`Write on @${chosenFrick?.owner?.username}'s frick...`}
              className="flex-1 p-3 rounded-lg bg-purple-900/50 border border-purple-500/30 focus:border-purple-500 focus:outline-none resize-none text-white placeholder-purple-300/50 text-sm"
              rows={2}
              disabled={submitting}
            />
            <button
              onClick={handleSubmit}
              disabled={!text.trim() || submitting}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800/50 disabled:cursor-not-allowed rounded-lg text-white font-medium transition-colors text-sm whitespace-nowrap"
            >
              {submitting ? "..." : "Send"}
            </button>
          </div>
          <div className="flex justify-between items-center mt-2">
            <p className="text-xs text-gray-400">
              {text.length}/180 characters
            </p>
            {submitting && (
              <p className="text-xs text-purple-400">Posting...</p>
            )}
          </div>
        </div>

        {/* Replies List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin h-6 w-6 border-2 border-purple-500 border-t-transparent rounded-full"></div>
              <p className="ml-2 text-gray-400">Loading replies...</p>
            </div>
          ) : replies.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <div className="text-4xl mb-2">✍️</div>
              <p>No replies yet.</p>
              <p className="text-sm">Be the first to write on this frick!</p>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              <AnimatePresence>
                {replies.map((reply, index) => (
                  <motion.div
                    key={`${reply.castHash}-${index}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-purple-900/30 hover:bg-purple-800/50 rounded-lg p-3 cursor-pointer transition-colors"
                    onClick={() => handleReplyClick(reply.castHash)}
                  >
                    <div className="flex items-start gap-2">
                      <img
                        src={reply.author.pfp_url}
                        alt={reply.author.username}
                        className="w-8 h-8 rounded-full flex-shrink-0"
                        loading="lazy"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-sm truncate">
                            @{reply.author.username}
                          </p>
                          <p className="text-xs text-gray-400 flex-shrink-0">
                            {reply.timestamp}
                          </p>
                        </div>
                        <p className="text-gray-200 text-sm leading-relaxed break-words">
                          {reply.text}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
