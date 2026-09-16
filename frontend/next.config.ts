import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["mongoose", "ioredis", "bcryptjs", "dockerode", "bullmq"],
};

export default nextConfig;
