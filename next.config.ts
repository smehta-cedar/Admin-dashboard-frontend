import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev only: lets other devices on the LAN load dev assets via the Network URL.
  // These are DHCP-assigned IPs, so update them if the block warnings show new ones.
  allowedDevOrigins: ["192.168.1.134", "192.168.4.177"],
  experimental: {
    // Certification PDFs (up to 10 MB) go through a server action; the API
    // rejects anything bigger with a proper field error, so leave room above it.
    serverActions: { bodySizeLimit: "11mb" },
    proxyClientMaxBodySize: "11mb",
  },
};

export default nextConfig;
