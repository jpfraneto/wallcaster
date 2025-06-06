import { sdk } from "@farcaster/frame-sdk";
import { useState } from "react";

export default function FricksLogo() {
  const [isPressed, setIsPressed] = useState(false);

  const handleClick = () => {
    setIsPressed(true);

    // Call swap token action
    sdk.actions.swapToken({
      buyToken: "eip155:8453/erc20:0xaeB9e71B11BD3ECb03D9e6b07",
    });

    // Reset pressed state after animation
    setTimeout(() => setIsPressed(false), 200);
  };

  return (
    <button
      onClick={handleClick}
      className={`
        relative
        px-6 py-3
        bg-gradient-to-br from-purple-900 to-purple-800
        rounded-lg
        border border-purple-600/50
        transition-all duration-200
        ${isPressed ? "scale-95" : "hover:scale-105"}
      `}
      style={{
        boxShadow: `
          0 0 15px rgba(168, 85, 247, 0.3),
          0 0 25px rgba(236, 72, 153, 0.2)
        `,
      }}
    >
      <span
        className="text-2xl font-bold tracking-wide text-pink-400"
        style={{
          textShadow: `
            0 0 8px rgba(236, 72, 153, 0.8),
            0 0 15px rgba(168, 85, 247, 0.5)
          `,
        }}
      >
        $fricks
      </span>
    </button>
  );
}
