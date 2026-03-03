import sqlite3 from 'sqlite3'
import { open, Database } from 'sqlite'

let db: Database | null = null

export async function getDb(): Promise<Database> {
    if (db) return db

    const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV;
    const dbPath = isVercel ? '/tmp/factory.db' : './factory.db';

    db = await open({
        filename: dbPath,
        driver: sqlite3.Database
    })

    await initDb(db)

    // Auto-seed if database is completely empty (Crucial for Vercel Serverless /tmp)
    const workerCount = await db.get('SELECT COUNT(*) as count FROM workers');
    if (workerCount.count === 0) {
        console.log("Database is empty. Auto-seeding...");
        await seedData(db);
    }

    return db
}

async function initDb(db: Database) {
    await db.exec(`
    CREATE TABLE IF NOT EXISTS workers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workstations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      worker_id TEXT NOT NULL,
      workstation_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      confidence REAL NOT NULL,
      count INTEGER DEFAULT 0,
      FOREIGN KEY(worker_id) REFERENCES workers(id),
      FOREIGN KEY(workstation_id) REFERENCES workstations(id)
    );
  `)
}

export async function seedDb() {
    const db = await getDb();
    await seedData(db);
}

async function seedData(db: Database) {
    // Clear existing data
    await db.exec(`
    DELETE FROM events;
    DELETE FROM workers;
    DELETE FROM workstations;
  `)

    // Insert Mock Workers
    const workers = [
        { id: 'W1', name: 'Rahul Sharma' },
        { id: 'W2', name: 'Priya Patel' },
        { id: 'W3', name: 'Amit Kumar' },
        { id: 'W4', name: 'Deepa Gupta' },
        { id: 'W5', name: 'Suresh Singh' },
        { id: 'W6', name: 'Neha Verma' },
    ]

    for (const w of workers) {
        await db.run('INSERT INTO workers (id, name) VALUES (?, ?)', [w.id, w.name])
    }

    // Insert Mock Workstations
    const workstations = [
        { id: 'S1', name: 'Assembly Line A' },
        { id: 'S2', name: 'Assembly Line B' },
        { id: 'S3', name: 'Quality Control' },
        { id: 'S4', name: 'Packaging' },
        { id: 'S5', name: 'Painting' },
        { id: 'S6', name: 'Testing' },
    ]

    for (const ws of workstations) {
        await db.run('INSERT INTO workstations (id, name) VALUES (?, ?)', [ws.id, ws.name])
    }

    // Helper for random counts and times
    const getRandomCount = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
    const getRandomOffset = (minMins: number, maxMins: number) => Math.floor(Math.random() * (maxMins - minMins + 1) + minMins) * 60000;

    const events: any[] = [];
    const baseTime = Date.now();

    for (let i = 0; i < workers.length; i++) {
        const wId = workers[i].id;
        const sId = workstations[i].id;

        // Start shift
        let currentTime = baseTime - (8 * 3600000); // 8 hours ago
        events.push({ timestamp: new Date(currentTime).toISOString(), worker_id: wId, workstation_id: sId, event_type: 'working', confidence: 0.98, count: 0 });

        // Add 3-5 random active/idle cycles
        const cycles = getRandomCount(3, 5);
        for (let c = 0; c < cycles; c++) {
            // Work for 30-120 mins
            currentTime += getRandomOffset(30, 120);
            events.push({ timestamp: new Date(currentTime).toISOString(), worker_id: wId, workstation_id: sId, event_type: 'product_count', confidence: 0.99, count: getRandomCount(15, 60) });

            // Go idle
            events.push({ timestamp: new Date(currentTime + 1000).toISOString(), worker_id: wId, workstation_id: sId, event_type: 'idle', confidence: 0.90, count: 0 });

            // Stay idle for 5-30 mins
            currentTime += getRandomOffset(5, 30);

            // Back to work
            events.push({ timestamp: new Date(currentTime).toISOString(), worker_id: wId, workstation_id: sId, event_type: 'working', confidence: 0.95, count: 0 });
        }
    }

    for (const ev of events) {
        await db.run(
            'INSERT INTO events (timestamp, worker_id, workstation_id, event_type, confidence, count) VALUES (?, ?, ?, ?, ?, ?)',
            [ev.timestamp, ev.worker_id, ev.workstation_id, ev.event_type, ev.confidence, ev.count]
        )
    }
}
