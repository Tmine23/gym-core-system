import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: [
    "@react-pdf/renderer",
    "@whiskeysockets/baileys",
    "jimp",
    "sharp",
    "node-cache",
  ],
};

export default nextConfig;
