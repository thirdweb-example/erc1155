import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ThirdwebProvider } from "@thirdweb-dev/react";
import "./styles/globals.css";
import { Toaster } from "./components/ui/Toaster";
import { getGasless } from "./utils/getGasless";

const container = document.getElementById("root");
const root = createRoot(container!);
const urlParams = new URL(window.location.toString()).searchParams;
const chain =
  urlParams.get("chain") && JSON.parse(urlParams.get("chain") || "");
const relayerUrl = urlParams.get("relayUrl") || "";
const biconomyApiKey = urlParams.get("biconomyApiKey") || "";
const biconomyApiId = urlParams.get("biconomyApiId") || "";
const sdkOptions = getGasless(relayerUrl, biconomyApiKey, biconomyApiId);

/* Use this when every embed changes to new embeds
const network = urlParams.get("network") || "ethereum";
const activeChain = getChainBySlug(network); */

root.render(
  <React.StrictMode>
    <ThirdwebProvider activeChain={chain} sdkOptions={sdkOptions}>
      <Toaster />
      <App />
    </ThirdwebProvider>
  </React.StrictMode>,
);
