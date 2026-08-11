import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "vrvhweigjuejbbimoqcx.supabase.co",
        pathname: "/storage/v1/object/public/crests/**",
      },
    ],
  },
};

export default nextConfig;
