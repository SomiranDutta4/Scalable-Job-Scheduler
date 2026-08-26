const { WebSocketServer } = require("ws");
const { subscriber } = require("../config/redis");

const setupWebSocket = async (server) => {
    const wss = new WebSocketServer({
        server,
        path: "/ws"
    });
    await subscriber.subscribe("events:jobs", (message) => {
        console.log("Job event:", message);

        wss.clients.forEach((client) => {
            if (client.readyState === 1) {
                client.send(message);
            }
        });
    });
    wss.on("connection", (socket) => {
        console.log("WebSocket client connected");
        socket.on("close", () => {
            console.log("WebSocket client disconnected");
        });
        socket.on("error", (error) => {
            console.error("WebSocket error:", error);
        });
    });
    console.log("WebSocket server running on /ws");
};
module.exports = setupWebSocket;