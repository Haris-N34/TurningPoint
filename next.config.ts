import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The live demo may run on the dev server; keep the Next.js badge off the screen.
  devIndicators: false,
  // Cross-origin isolation lets the on-device caption model use several CPU threads (SharedArrayBuffer).
  // "credentialless" keeps cross-origin fetches (the model files) working without extra headers on their side.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
        ],
      },
    ];
  },
};

export default nextConfig;
