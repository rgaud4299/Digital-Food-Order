const { Queue, Worker } = require("bullmq");
const IORedis = require("ioredis");

const connection = new IORedis(
  "rediss://default:AaoVAAIncDFlNjA5MDYwNzE1NmU0NTgwYTZkNmRiNDVjODIxODVjMnAxNDM1NDE@one-elk-43541.upstash.io:6379",
  {
    tls: {},               
    maxRetriesPerRequest: null,
  }
);

connection.on("connect", () => {
  console.log("✅ Connected to Redis Cloud");
});

connection.on("error", (err) => {
  console.error("❌ Redis Error:", err);
});

const messageQueue = new Queue("messageQueue", { connection });

module.exports = { messageQueue, Worker, connection };