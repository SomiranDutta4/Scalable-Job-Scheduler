const { MongoClient } = require("mongodb");

const client = new MongoClient(process.env.MONGODB_URI);

let db;

async function connectDB() {
    try {
        await client.connect();

        db = client.db(process.env.MONGODB_DB_NAME);

        console.log("MongoDB connected");
    } catch (error) {
        console.error("MongoDB connection failed:", error);
        process.exit(1);
    }
}

function getDB() {
    if (!db) {
        throw new Error("Database not connected");
    }

    return db;
}

module.exports = {
    connectDB,
    getDB
};