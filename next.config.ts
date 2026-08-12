import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/sunday-school",
  async redirects() {
    return [
      {
        source: "/",
        destination: "/john",
        permanent: true,
      },
      {
        source: "/sundayschool",
        destination: "/sunday-school/john",
        permanent: true,
        basePath: false,
      },
    ];
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
