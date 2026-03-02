import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { getDb, seedDb } from './database';
import { computeMetrics } from './metrics';

const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: `${process.env.CLIENT_URL}`, // Adjust this in production
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());

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
        const db = await getDb();

        await db.run(
            'INSERT INTO events (timestamp, worker_id, workstation_id, event_type, confidence, count) VALUES (?, ?, ?, ?, ?, ?)',
            [timestamp, worker_id, workstation_id, event_type, confidence, count || 0]
        );

        // Emit a real-time event to all connected clients
        io.emit('new_event', { workstation_id });

        res.status(201).json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to ingest event' });
    }
});

// Seed/Reset database
app.post('/api/seed', async (req, res) => {
    try {
        await seedDb();
        io.emit('new_event', { type: 'seed' });
        res.json({ success: true, message: 'Database seeded successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to seed database' });
    }
});

// Get Factory metrics
app.get('/api/metrics/factory', async (req, res) => {
    try {
        const data = await computeMetrics();
        res.json(data.factory);
    } catch (error) {
        res.status(500).json({ error: 'Failed to compute metrics' });
    }
});

// Get Worker metrics
app.get('/api/metrics/workers', async (req, res) => {
    try {
        const data = await computeMetrics();
        res.json(data.workers);
    } catch (error) {
        res.status(500).json({ error: 'Failed to compute metrics' });
    }
});

// Get Workstation metrics
app.get('/api/metrics/workstations', async (req, res) => {
    try {
        const data = await computeMetrics();
        res.json(data.workstations);
    } catch (error) {
        res.status(500).json({ error: 'Failed to compute metrics' });
    }
});

const PORT = process.env.PORT;

server.listen(PORT, async () => {
    await seedDb(); // Seed database on initial startup automatically
    console.log(`Backend server running on port ${PORT}`);
});
