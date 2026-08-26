const { createClient } = require("redis");

const redisClient = createClient({
    url: process.env.REDIS_URL
});

const subscriber = redisClient.duplicate();

redisClient.on("error", error => {
    console.error("Redis error:", error);
});

subscriber.on("error", error => {
    console.error("Redis subscriber error:", error);
});

async function connectRedis() {
    await redisClient.connect();
    await subscriber.connect();

    console.log("Redis connected");
}

module.exports = {
    redisClient,
    subscriber,
    connectRedis
};