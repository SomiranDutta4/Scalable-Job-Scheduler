const mongoose = require("mongoose");

const jobSchema = new mongoose.Schema(
    {
        id: {
            type: String,
            required: true,
            unique: true
        },
        description: {
            type: String,
            required: true
        },

        task: {
            type: String,
            required: true
        },

        createdAt: {
            type: Date,
            default: Date.now
        },

        scheduledFor: {
            type: Date,
            required: true
        },

        timeoutMs: {
            type: Number,
            required: true
        },

        status: {
            type: String,
            enum: [
                "pending",
                "queued",
                "processing",
                "completed",
                "retrying",
                "failed",
                "canceled"
            ],
            default: "pending"
        },

        attempts: {
            type: Number,
            default: 0
        },

        sentToQueueAt: {
            type: Date,
            default: null
        },

        completedAt: {
            type: Date,
            default: null
        }
    },
    {
        timestamps: false
    }
);

const Job = mongoose.model("Job", jobSchema);

module.exports = Job;