"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const database_1 = require("./database");
const metrics_1 = require("./metrics");
const app = (0, express_1.default)();
const server = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: `${process.env.CLIENT_URL}`, // Adjust this in production
        methods: ["GET", "POST"]
    }
});
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Root health check route
app.get('/', (req, res) => {
    res.json({
        status: 'ok',
        message: 'AI Factory API is running',
        endpoints: [
            'GET /api/metrics/factory',
            'GET /api/metrics/workers',
            'POST /api/events',
            'POST /api/seed'
        ]
    });
});
// Ingest an event
app.post('/api/events', async (req, res) => {
    try {
        const { timestamp, worker_id, workstation_id, event_type, confidence, count } = req.body;
        const db = await (0, database_1.getDb)();
        await db.run('INSERT INTO events (timestamp, worker_id, workstation_id, event_type, confidence, count) VALUES (?, ?, ?, ?, ?, ?)', [timestamp, worker_id, workstation_id, event_type, confidence, count || 0]);
        // Emit a real-time event to all connected clients
        io.emit('new_event', { workstation_id });
        res.status(201).json({ success: true });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to ingest event' });
    }
});
// Seed/Reset database
app.post('/api/seed', async (req, res) => {
    try {
        await (0, database_1.seedDb)();
        io.emit('new_event', { type: 'seed' });
        res.json({ success: true, message: 'Database seeded successfully' });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to seed database' });
    }
});
// Get Factory metrics
app.get('/api/metrics/factory', async (req, res) => {
    try {
        const data = await (0, metrics_1.computeMetrics)();
        res.json(data.factory);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to compute metrics' });
    }
});
// Get Worker metrics
app.get('/api/metrics/workers', async (req, res) => {
    try {
        const data = await (0, metrics_1.computeMetrics)();
        res.json(data.workers);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to compute metrics' });
    }
});
// Get Workstation metrics
app.get('/api/metrics/workstations', async (req, res) => {
    try {
        const data = await (0, metrics_1.computeMetrics)();
        res.json(data.workstations);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to compute metrics' });
    }
});
const PORT = process.env.PORT;
server.listen(PORT, async () => {
    await (0, database_1.seedDb)(); // Seed database on initial startup automatically
    console.log(`Backend server running on port ${PORT}`);
});
