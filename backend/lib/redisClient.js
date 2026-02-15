import { createClient } from "redis";

let redisClient = null;
let connectPromise = null;

const initRedisClient = () => {
  if (redisClient) return redisClient;
  const url = process.env.REDIS_URL;
  if (!url) return null;

  redisClient = createClient({ url });
  redisClient.on("error", () => {
    console.warn("WARN Redis connection error.");
  });
  connectPromise = redisClient.connect().catch(() => {
    console.warn("WARN Redis connection failed.");
  });
  return redisClient;
};

export const getRedisClient = async () => {
  const client = initRedisClient();
  if (!client) return null;

  if (connectPromise) {
    try {
      await connectPromise;
    } catch {
      return null;
    }
  }

  if (!client.isOpen) return null;
  return client;
};

export const readJson = async (client, key) => {
  const value = await client.get(key);
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

export const writeJson = async (client, key, payload, ttlMs) => {
  const data = JSON.stringify(payload);
  if (Number.isFinite(ttlMs)) {
    await client.set(key, data, { PX: ttlMs });
    return;
  }
  await client.set(key, data);
};
