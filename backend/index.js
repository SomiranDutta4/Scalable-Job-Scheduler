require("dotenv").config();

const express = require("express");
const { connectDB } = require("./config/db");
const { connectRedis } = require("./config/redis");
const {router}=require('./routes/route')

const app = express();

app.use(express.json());
app.use('/api',router)

const PORT = process.env.PORT || 3000;

async function startServer() {
    await connectDB();
    await connectRedis();

    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

startServer();