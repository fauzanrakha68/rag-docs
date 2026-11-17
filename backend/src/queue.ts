import { Queue } from "bullmq";

export const redisConnection = {
  host: process.env.REDIS_HOST || "localhost",
  port: Number(process.env.REDIS_PORT) || 6379,
};

export const ingestQueue = new Queue("ingest", { connection: redisConnection });