import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "firebase/app": path.resolve(__dirname, "node_modules/firebase/app/dist/index.cjs.js"),
      "firebase/auth": path.resolve(__dirname, "node_modules/firebase/auth/dist/index.cjs.js"),
      "firebase/database": path.resolve(__dirname, "node_modules/firebase/database/dist/index.cjs.js"),
      "firebase/storage": path.resolve(__dirname, "node_modules/firebase/storage/dist/index.cjs.js"),
    };
    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "api.dicebear.com",
      },
    ],
  },
};

export default nextConfig;
