const { randomUUID } = require("crypto");
const {
    connectRedis,
    redisClient
} = require("../config/redis");
const Job = require("../models/job");

const QUEUES = [
    "queue:immediate:high",
    "queue:immediate:normal",
    "queue:immediate:low"
];

class Worker {
    constructor() {
        this.running = true;
        this.workerId = randomUUID();
    }

    async start() {
        console.log(`Worker ${this.workerId} started`);
        while (this.running) {
            try {
                await this.processDelayedJob();

                const result = await redisClient.brPop(
                    QUEUES,
                    1
                );

                if (result) {
                    const { key, element } = result;

                    console.log(
                        `Received ${element} from ${key}`
                    );

                    await this.processJob(element);
                }
            } catch (error) {
                console.error(
                    "Worker error:",
                    error
                );

                await new Promise(resolve =>
                    setTimeout(resolve, 1000)
                );
            }
        }
    }

    async processDelayedJob() {
        const now = Date.now();

        const jobs = await redisClient.zRangeByScore(
            "jobs:scheduled",
            0,
            now
        );

        for (const jobId of jobs) {
            const removed = await redisClient.zRem(
                "jobs:scheduled",
                jobId
            );

            if (!removed) {
                continue;
            }

            const job = await Job.findOne({
                id: jobId
            });

            if (!job || job.status === "cancelled") {
                continue;
            }

            let queue = "queue:immediate:normal";

            if (job.priority === 3) {
                queue = "queue:immediate:high";
            } else if (job.priority === 1) {
                queue = "queue:immediate:low";
            }

            await redisClient.rPush(
                queue,
                jobId
            );

            job.status = "queued";
            job.sentToQueueAt = new Date();

            await job.save();

            await this.publishEvent(
                jobId,
                "queued",
                {
                    priority: job.priority
                }
            );

            console.log(
                `Moved delayed job ${jobId} to ${queue}`
            );
        }
    }

    async processJob(jobId) {
        const job = await Job.findOne({
            id: jobId
        });

        if (!job || job.status === "cancelled") {
            return;
        }

        const lockKey = `lock:job:${jobId}`;

        const isLocked = await redisClient.set(
            lockKey,
            this.workerId,
            {
                NX: true,
                EX: 300
            }
        );

        if (!isLocked) {
            return;
        }

        console.log(
            `Worker ${this.workerId} processing job ${jobId}`
        );

        try {
            const currentJob = await Job.findOne({
                id: jobId
            });

            if (
                !currentJob ||
                currentJob.status === "cancelled"
            ) {
                return;
            }

            currentJob.attempts += 1;
            currentJob.status = "processing";
            currentJob.startedAt = new Date();

            await currentJob.save();

            await this.publishEvent(
                jobId,
                "processing",
                {
                    attempt: currentJob.attempts
                }
            );

            const success = await this.executeTask(
                jobId
            );

            if (success) {
                currentJob.status = "completed";
                currentJob.completedAt = new Date();

                await currentJob.save();

                await this.publishEvent(
                    jobId,
                    "completed"
                );

                console.log(
                    `Job ${jobId} completed`
                );
            } else {
                await this.processFailure(jobId);
            }
        } catch (error) {
            console.error(
                `Worker error while processing job ${jobId}:`,
                error.message
            );

            await this.processFailure(jobId);
        } finally {
            await redisClient.del(lockKey);
        }
    }

    async executeTask(jobId) {
        const duration =
            Math.floor(Math.random() * 9) + 2;

        console.log(
            `Job ${jobId} will take ${duration} seconds`
        );

        for (
            let second = 1;
            second <= duration;
            second++
        ) {
            await new Promise(resolve =>
                setTimeout(resolve, 1000)
            );

            const random = Math.random();

            if (random < 0.05) {
                console.log(
                    `Job ${jobId} failed at second ${second}`
                );

                return false;
            }

            console.log(
                `Job ${jobId}: ${second}/${duration} seconds`
            );
        }

        return true;
    }

    async processFailure(jobId) {
        const job = await Job.findOne({
            id: jobId
        });

        if (!job) {
            return;
        }

        const maxAttempts =
            Number(process.env.MAX_ATTEMPTS);

        if (job.attempts >= maxAttempts) {
            job.status = "failed";

            await job.save();

            await this.publishEvent(
                jobId,
                "failed",
                {
                    attempts: job.attempts
                }
            );

            console.log(
                `Job ${jobId} permanently failed after ${job.attempts} attempts`
            );

            return;
        }

        const delaySeconds =
            2 ** (job.attempts - 1);

        const retryTime =
            Date.now() +
            delaySeconds * 1000;

        job.status = "retrying";

        await job.save();

        await redisClient.zAdd(
            "jobs:scheduled",
            {
                score: retryTime,
                value: jobId
            }
        );

        await this.publishEvent(
            jobId,
            "retrying",
            {
                retryIn: delaySeconds,
                attempt: job.attempts
            }
        );

        console.log(
            `Job ${jobId} failed. Retry ${job.attempts}/${maxAttempts} in ${delaySeconds}s`
        );
    }

    async publishEvent(jobId, status, extra = {}) {
        const job = await Job.findOne({
            id: jobId
        });

        if (!job) {
            return;
        }

        const event = {
            jobId: String(jobId),
            userId: String(job.userId),
            status,
            timestamp: new Date().toISOString(),
            ...extra
        };

        await redisClient.publish(
            "events:jobs",
            JSON.stringify(event)
        );
    }
}

module.exports = Worker;