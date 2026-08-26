const { createClient } = require("redis");

const redisClient = createClient({
    url: process.env.REDIS_URL
});

redisClient.on("error", (error) => {
    console.error("Redis error:", error);
});

async function connectRedis() {
    try {
        await redisClient.connect();
        console.log("Redis connected");
    } catch (error) {
        console.error("Redis connection failed:", error);
        process.exit(1);
    }
}

module.exports = {
    redisClient,
    connectRedis
};