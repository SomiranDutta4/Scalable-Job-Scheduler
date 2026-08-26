const { randomUUID } = require("crypto");
const Job = require("../models/job");
const { redisClient } = require("../config/redis");

const publishEvent = async (jobId, userId, status, extra = {}) => {
    const event = {
        jobId: String(jobId),
        userId: String(userId),
        status,
        ...extra
    };
    await redisClient.publish(
        "events:jobs",
        JSON.stringify(event)
    );
};

const getQueue = priority => {
    if (priority === 3) {
        return "queue:immediate:high";
    }
    if (priority === 1) {
        return "queue:immediate:low";
    }
    return "queue:immediate:normal";
};

const createJob = async (req, res) => {
    try {
        const {
            description = "",
            task,
            scheduledFor,
            timeoutMs = 0,
            priority = 2
        } = req.body;
        console.log(scheduledFor);

        if (!task) {
            return res.status(400).json({
                message: "task is required"
            });
        }

        if (![1, 2, 3].includes(Number(priority))) {
            return res.status(400).json({
                message: "priority must be 1, 2 or 3"
            });
        }

        const jobId = randomUUID();
        const scheduledDate = scheduledFor
            ? new Date(scheduledFor)
            : new Date();

        if (isNaN(scheduledDate.getTime())) {
            return res.status(400).json({
                message: "Invalid scheduledFor"
            });
        }

        const job = new Job({
            id: jobId,
            userId: req.userId,
            description,
            task,
            scheduledFor: scheduledDate,
            timeoutMs,
            priority: Number(priority),
            status: "pending",
            attempts: 0
        });

        if (scheduledDate > new Date()) {
            await redisClient.zAdd("jobs:scheduled", {
                score: scheduledDate.getTime(),
                value: job.id
            });
        } else {
            await redisClient.rPush(
                getQueue(Number(priority)),
                job.id
            );
            job.status = "queued";
            job.sentToQueueAt = new Date();
        }

        await job.save();

        await publishEvent(
            job.id,
            job.userId,
            job.status,
            {
                priority: Number(priority)
            }
        );

        return res.status(201).json({
            message: "Job created successfully",
            job
        });
    } catch (error) {
        console.error("Create job error:", error);
        return res.status(500).json({
            message: "Internal server error"
        });
    }
};

const getJobs = async (req, res) => {
    try {
        const jobs = await Job.find({
            userId: req.userId
        }).sort({
            createdAt: -1
        });

        return res.status(200).json({
            jobs
        });
    } catch (error) {
        console.error("Get jobs error:", error);
        return res.status(500).json({
            message: "Internal server error"
        });
    }
};

const getJob = async (req, res) => {
    try {
        const { jobId } = req.params;
        const job = await Job.findOne({
            id: jobId,
            userId: req.userId
        });

        if (!job) {
            return res.status(404).json({
                message: "Job not found"
            });
        }

        return res.status(200).json({
            job
        });
    } catch (error) {
        console.error("Get job error:", error);
        return res.status(500).json({
            message: "Internal server error"
        });
    }
};

const cancelJob = async (req, res) => {
    try {
        const { jobId } = req.params;
        const job = await Job.findOne({
            id: jobId,
            userId: req.userId
        });

        if (!job) {
            return res.status(404).json({
                message: "Job not found"
            });
        }

        if (
            job.status === "pending" ||
            job.status === "retrying"
        ) {
            await redisClient.zRem(
                "jobs:scheduled",
                job.id
            );
        } else if (job.status === "processing") {
            // Worker will handle cancellation.
        } else if (
            job.status === "completed" ||
            job.status === "failed" ||
            job.status === "cancelled"
        ) {
            return res.status(400).json({
                message: `Job is already ${job.status}`
            });
        }

        job.status = "cancelled";
        await job.save();

        await publishEvent(
            job.id,
            job.userId,
            "cancelled"
        );

        return res.status(200).json({
            message: "Job cancelled successfully",
            job
        });
    } catch (error) {
        console.error("Cancel job error:", error);
        return res.status(500).json({
            message: "Internal server error"
        });
    }
};

const retryJob = async (req, res) => {
    try {
        const { jobId } = req.params;
        const job = await Job.findOne({
            id: jobId,
            userId: req.userId
        });

        if (!job) {
            return res.status(404).json({
                message: "Job not found"
            });
        }

        if (
            job.status !== "failed" &&
            job.status !== "cancelled"
        ) {
            return res.status(400).json({
                message: "Only failed or cancelled jobs can be retried"
            });
        }

        await redisClient.rPush(
            getQueue(job.priority),
            job.id
        );

        job.status = "queued";
        job.attempts += 1;
        job.sentToQueueAt = new Date();
        job.completedAt = null;

        await job.save();

        await publishEvent(
            job.id,
            job.userId,
            "queued",
            {
                priority: job.priority,
                msg: "Job manually retried"
            }
        );

        return res.status(200).json({
            message: "Job queued for retry",
            job
        });
    } catch (error) {
        console.error("Retry job error:", error);
        return res.status(500).json({
            message: "Internal server error"
        });
    }
};

module.exports = {
    createJob,
    getJob,
    getJobs,
    cancelJob,
    retryJob
};