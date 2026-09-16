import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev only: lets other devices on the LAN load dev assets via the Network URL.
  // These are DHCP-assigned IPs, so update them if the block warnings show new ones.
  allowedDevOrigins: ["192.168.1.134", "192.168.4.177"],
};

export default nextConfig;
