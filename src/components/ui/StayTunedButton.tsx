// components/ui/StayTunedButton.tsx
import { motion } from "framer-motion";

export default function StayTunedButton({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      className="w-full rounded-lg p-4 font-bold text-xl tracking-widest relative text-purple-200 bg-[#1b1029] border-2 border-purple-600 shadow-[0_0_12px_2px_rgba(168,85,247,0.5)]"
      style={{
        textShadow: "0 0 8px rgba(236, 72, 255, 0.6)",
        backgroundImage:
          "linear-gradient(145deg, rgba(64, 0, 109, 0.8), rgba(26, 0, 43, 0.8))",
      }}
    >
      <span className="inline-block glow-text">STAY TUNED</span>
    </motion.button>
  );
}
