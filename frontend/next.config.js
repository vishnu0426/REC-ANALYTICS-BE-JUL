/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Hides the floating "N" dev-mode indicator (dev server only; it never
  // appears in production builds).
  devIndicators: false,
  // Traces the minimal set of files/node_modules the server actually needs
  // into .next/standalone — lets the production Dockerfile copy a small,
  // self-contained bundle instead of the entire node_modules tree.
  output: "standalone",
};

module.exports = nextConfig;
