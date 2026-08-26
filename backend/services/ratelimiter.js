const { redisClient } = require("../../config/redis");

const rateLimiter = (limit = 10, window = 60) => {
    return async (req, res, next) => {
        try {
            const key = `ratelimit:${req.userId}`;
            const current = await redisClient.incr(key);
            if (current === 1) {
                await redisClient.expire(
                    key,
                    window
                );
            }
            if (current > limit) {
                return res.status(429).json({
                    message: "Rate limit exceeded"
                });
            }
            next();
        } catch (error) {
            console.error(
                "Rate Limiter Error:",
                error
            );
            next();
        }
    };
};

module.exports = rateLimiter;