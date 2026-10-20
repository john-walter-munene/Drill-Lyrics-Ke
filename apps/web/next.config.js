/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Compile the workspace shared package from its TypeScript sources. Its
  // package exports resolve to `src` for importers, so the web build never
  // depends on `packages/shared/dist` existing first.
  transpilePackages: ['@drillke/shared'],
  // Emit a self-contained server (.next/standalone) for lean Docker images.
  output: 'standalone',
  // Marketplace is out of v1 (docs/product.md §4.2). If it is ever reintroduced
  // under a real route, add the redirect here rather than in a page.
  async redirects() {
    return [{ source: '/marketplace', destination: '/support', permanent: true }];
  },
};

module.exports = nextConfig;
