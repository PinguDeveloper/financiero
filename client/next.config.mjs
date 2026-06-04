const apiProxyTarget = process.env.API_PROXY_TARGET ?? "http://127.0.0.1:4000";
const isStaticExport = process.env.NEXT_OUTPUT === "export";

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(isStaticExport
    ? {
        output: "export",
        trailingSlash: true,
        images: { unoptimized: true },
      }
    : {}),
  async rewrites() {
    if (isStaticExport || process.env.NEXT_PUBLIC_API_BASE) return [];
    return [
      { source: "/api/:path*", destination: `${apiProxyTarget}/api/:path*` },
      { source: "/auth/:path*", destination: `${apiProxyTarget}/auth/:path*` },
    ];
  },
};

export default nextConfig;
