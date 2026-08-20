import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Public registration posts ID photos and a payment receipt in one
      // multipart action. Images are downscaled in the browser first, so this
      // is headroom rather than the expected payload.
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
