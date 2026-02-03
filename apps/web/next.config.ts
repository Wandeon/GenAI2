import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable React strict mode
  reactStrictMode: true,

  // Standalone output for Docker deployment
  output: "standalone",

  // Transpile workspace packages
  transpilePackages: ["@genai/ui", "@genai/trpc", "@genai/shared"],
};

export default nextConfig;
