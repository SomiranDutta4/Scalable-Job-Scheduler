require("dotenv").config();

const express = require("express");
const http = require("http");

const { connectDB } = require("./config/db");
const { connectRedis } = require("./config/redis");
const { router } = require("./routes/route");
const Worker = require("./src/services/worker");
const setupWebSocket = require("./src/websocket");

const app = express();
const server = http.createServer(app);

app.use(express.json());
app.use("/api", router);
const PORT = process.env.PORT || 3000;

async function startServer() {
    await connectDB();
    await connectRedis();
    setupWebSocket(server);
    const worker = new Worker();
    worker.start();
    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

startServer();