import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/Haussmann",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
