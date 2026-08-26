const { randomUUID } = require("crypto");
var MAX_ATTEMPTS=5

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
        await connectRedis();
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
            if (!job) {
                continue;
            }
            if (job.status === "cancelled") {
                continue;
            }
            await redisClient.lPush(
                "queue:immediate:normal",
                jobId
            );
            job.status = "queued";
            job.sentToQueueAt = new Date();
            await job.save();
            await this.publishEvent(
                jobId,
                "queued"
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
            if (!currentJob || currentJob.status === "cancelled") {
                return;
            }
            currentJob.status = "processing";
            currentJob.startedAt = new Date();
            await currentJob.save();

            await this.publishEvent(
                jobId,
                "processing"
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
            } else {
                await this.publishEvent(
                    jobId,
                    "failed"
                );
                await this.processFailure(
                    jobId
                );
            }
        } catch (error) {
            console.error(
                `Worker error while processing job ${jobId}:`,
                error.message
            );
            await this.processFailure(jobId);
        }finally {
            await redisClient.del(
                lockKey
            );
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
            if (random < 0.2) {
                console.log(
                    `Job ${jobId} failed at second ${second}`
                );
                return false;
            }
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
    const maxAttempts = Number(process.env.MAX_ATTEMPTS);

    if (job.attempts >= maxAttempts) {
        job.status = "failed";
        await job.save();

        await this.publishEvent(
            jobId,
            "failed"
        );
        return;
    }
    const delaySeconds = 2 ** job.attempts;
    const retryTime =
        Date.now() +
        delaySeconds * 1000;
    job.attempts += 1;
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
            retryIn: delaySeconds
        }
    );
}
async publishEvent(jobId, status, extra = {}) {
    const job = await Job.findOne({ id: jobId });
    if (!job) {
        return;
    }
    const event = {
        jobId: String(jobId),
        status,
        ...extra
    };
    await redisClient.publish(
        `events:user:${job.userId}`,
        JSON.stringify(event)
    );
}
    // async cancelJob(jobId) {
    //     const job = await Job.findOne({
    //         id: jobId
    //     });

    //     if (!job) {
    //         return;
    //     }
    //     if (
    //         job.status === "pending" ||
    //         job.status === "retrying"
    //     ) {
    //         await redisClient.zRem(
    //             "jobs:scheduled",
    //             jobId
    //         );
    //         job.status = "cancelled";
    //         await job.save();
    //         await this.publishEvent(
    //             jobId,
    //             "cancelled",
    //         );
    //         return;
    //     }
    //     if (job.status === "queued") {
    //         job.status = "cancelled";
    //         await job.save();
    //         await this.publishEvent(
    //             jobId,
    //             "cancelled"
    //         );
    //         return;
    //     }

    //     // Processing cancellation will need
    //     // additional handling because another
    //     // worker may currently own the lock.
    //     if (job.status === "processing") {
    //         console.log(
    //             `Job ${jobId} is currently processing`
    //         );

    //         return;
    //     }
    // }
}

module.exports = Worker;