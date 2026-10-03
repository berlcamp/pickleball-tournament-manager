import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Public registration posts ID photos and a payment receipt in one
      // multipart action. Images are downscaled in the browser first, so this
      // is headroom rather than the expected payload: up to three 15MB
      // photos (two IDs and a receipt) when the browser can't resize them.
      bodySizeLimit: "50mb",
    },
  },
};

export default nextConfig;
