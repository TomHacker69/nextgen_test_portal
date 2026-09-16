const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    // Allow the shared-types source package to be type-resolved without a build step.
    // shared-types is imported as `import type` only, so nothing is transpiled at runtime.
    externalDir: false,
  },
};

export default nextConfig;
