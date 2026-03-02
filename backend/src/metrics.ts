import { getDb } from './database';

interface Event {
    id: number;
    timestamp: string;
    worker_id: string;
    workstation_id: string;
    event_type: string;
    confidence: number;
    count: number;
}

const SHIFT_HOURS = 8; // assumption for metrics

export async function computeMetrics() {
    const db = await getDb();

    const workers = await db.all('SELECT * FROM workers');
    const workstations = await db.all('SELECT * FROM workstations');
    const events: Event[] = await db.all('SELECT * FROM events ORDER BY timestamp ASC');

    // Initialize stats state
    const workerStats: Record<string, any> = {};
    for (const w of workers) {
        workerStats[w.id] = { id: w.id, name: w.name, activeTimeMs: 0, idleTimeMs: 0, totalUnits: 0, lastState: 'idle', lastStateTime: null };
    }

    const stationStats: Record<string, any> = {};
    for (const s of workstations) {
        stationStats[s.id] = { id: s.id, name: s.name, occupancyTimeMs: 0, idleTimeMs: 0, totalUnits: 0, lastState: 'idle', lastStateTime: null };
    }

    // To cap ongoing states if needed, we'd use current time, but for history we evaluate up to last event
    // We'll process state changes to calculate times
    for (const ev of events) {
        const time = new Date(ev.timestamp).getTime();

        // Process Worker Stat Time
        const wStat = workerStats[ev.worker_id];
        if (wStat && wStat.lastStateTime) {
            const duration = time - wStat.lastStateTime;
            if (wStat.lastState === 'working') wStat.activeTimeMs += duration;
            else if (wStat.lastState === 'idle') wStat.idleTimeMs += duration;
        }

        // Process Station Stat Time
        const sStat = stationStats[ev.workstation_id];
        if (sStat && sStat.lastStateTime) {
            const duration = time - sStat.lastStateTime;
            if (sStat.lastState === 'working') sStat.occupancyTimeMs += duration;
            else if (sStat.lastState === 'idle') sStat.idleTimeMs += duration;
        }

        // Update States
        if (ev.event_type === 'working' || ev.event_type === 'idle' || ev.event_type === 'absent') {
            if (wStat) { wStat.lastState = ev.event_type; wStat.lastStateTime = time; }
            if (sStat) { sStat.lastState = ev.event_type; sStat.lastStateTime = time; }
        } else if (ev.event_type === 'product_count') {
            if (wStat) wStat.totalUnits += ev.count;
            if (sStat) sStat.totalUnits += ev.count;
            // Do not change state or lastStateTime for count events 
        }
    }

    // Cap the last state up to "now" if it's ongoing (simplified: add up to current time if last event was within today)
    const now = Date.now();
    for (const w of workers) {
        const wStat = workerStats[w.id];
        if (wStat.lastStateTime && now - wStat.lastStateTime < 24 * 3600 * 1000) {
            const duration = now - wStat.lastStateTime;
            if (wStat.lastState === 'working') wStat.activeTimeMs += duration;
            else if (wStat.lastState === 'idle') wStat.idleTimeMs += duration;
        }
    }

    for (const s of workstations) {
        const sStat = stationStats[s.id];
        if (sStat.lastStateTime && now - sStat.lastStateTime < 24 * 3600 * 1000) {
            const duration = now - sStat.lastStateTime;
            if (sStat.lastState === 'working') sStat.occupancyTimeMs += duration;
            else if (sStat.lastState === 'idle') sStat.idleTimeMs += duration;
        }
    }

    // Formatting values
    const workerList = Object.values(workerStats).map(w => {
        const totalRecordedTime = w.activeTimeMs + w.idleTimeMs;
        const utilization = totalRecordedTime > 0 ? (w.activeTimeMs / totalRecordedTime) * 100 : 0;
        const activeTimeHrs = w.activeTimeMs / 3600000;
        const idleTimeHrs = w.idleTimeMs / 3600000;
        const uph = activeTimeHrs > 0 ? w.totalUnits / activeTimeHrs : 0;

        return {
            id: w.id, name: w.name,
            activeTimeHrs, idleTimeHrs, utilization, totalUnits: w.totalUnits,
            uph
        };
    });

    const stationList = Object.values(stationStats).map(s => {
        const totalRecordedTime = s.occupancyTimeMs + s.idleTimeMs;
        const utilization = totalRecordedTime > 0 ? (s.occupancyTimeMs / totalRecordedTime) * 100 : 0;
        const occupancyHrs = s.occupancyTimeMs / 3600000;
        const throughputRate = occupancyHrs > 0 ? s.totalUnits / occupancyHrs : 0;

        return {
            id: s.id, name: s.name,
            occupancyHrs, utilization, totalUnits: s.totalUnits,
            throughputRate
        };
    });

    const factoryTotalActive = workerList.reduce((sum, w) => sum + w.activeTimeHrs, 0);
    const factoryTotalUnits = workerList.reduce((sum, w) => sum + w.totalUnits, 0);
    const factoryAvgUtil = workerList.length > 0 ? workerList.reduce((sum, w) => sum + w.utilization, 0) / workerList.length : 0;
    const factoryAvgUph = workerList.length > 0 ? workerList.reduce((sum, w) => sum + w.uph, 0) / workerList.length : 0;

    return {
        factory: {
            totalProductiveTimeHrs: factoryTotalActive,
            totalUnits: factoryTotalUnits,
            averageUtilization: factoryAvgUtil,
            averageProductionRate: factoryAvgUph,
        },
        workers: workerList,
        workstations: stationList
    };
}
