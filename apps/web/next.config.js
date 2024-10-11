require("dotenv-mono").load();
/** @type {import('next').NextConfig} */

const nextConfig = {
  cacheHandler: require.resolve("./cache-handler.mjs"),
  env: {
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    NEXT_PUBLIC_ROOT_DOMAIN: process.env.NEXT_PUBLIC_ROOT_DOMAIN,
    POSTGRES_URL: process.env.POSTGRES_URL,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    REDIS_URL: process.env.REDIS_URL,
  },
};

module.exports = nextConfig;
