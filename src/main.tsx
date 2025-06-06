import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { FarcasterSolanaProvider } from "@farcaster/mini-app-solana";

const solanaEndpoint =
  "https://mainnet.helius-rpc.com/?api-key=2f9d82a6-d13a-4239-aa62-3c438c7ddb0f";

function Main() {
  return <App />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <FarcasterSolanaProvider endpoint={solanaEndpoint}>
      <Main />
    </FarcasterSolanaProvider>
  </React.StrictMode>
);
