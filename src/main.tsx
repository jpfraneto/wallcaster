import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css"; // Create a basic CSS file or use the styles.css from earlier
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-wallets";

// Default styles that can be overridden by your app
import "@solana/wallet-adapter-react-ui/styles.css";

function Main() {
  // You can use the Solana RPC endpoint or a service like QuickNode for better performance
  const endpoint =
    "https://solana-mainnet.g.alchemy.com/v2/QvlfwedPVx_GZrUcJ64yA_A4HmoQkofN";

  // Setup wallet adapters for most common wallets
  const wallets = [new PhantomWalletAdapter()];

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <App />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Main />
  </React.StrictMode>
);
