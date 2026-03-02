import { useState, useEffect } from 'react';
import { Users, Activity, RotateCcw, Monitor, Filter, Clock, Cpu, Zap, Box, WifiOff } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, AnimatePresence } from 'framer-motion';
import { io } from 'socket.io-client';
const API_URL = import.meta.env.VITE_API_URL;

const socket = io(API_URL);

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

// Components
const Card = ({ className, children, ...props }: any) => (
    <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className={cn("glass-card rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1", className)}
        {...props}
    >
        {children}
    </motion.div>
);

const StatCard = ({ title, value, icon, subtitle, trend }: { title: string; value: string | number; icon: React.ReactNode; subtitle?: string; trend?: 'up' | 'down' | 'neutral' }) => (
    <Card className="p-6 flex flex-col justify-between relative overflow-hidden group">
        <div className="absolute -right-6 -top-6 text-primary/5 transition-transform duration-500 group-hover:scale-110 group-hover:rotate-12">
            <div className="w-32 h-32">{icon}</div>
        </div>

        <div className="relative z-10 flex items-center justify-between mb-6">
            <h3 className="text-sm font-semibold tracking-wider uppercase text-gray-500 dark:text-gray-400/80">{title}</h3>
            <div className="text-primary p-2.5 bg-primary/10 rounded-xl ring-1 ring-primary/20 backdrop-blur-md">
                {icon}
            </div>
        </div>
        <div className="relative z-10">
            <div className="flex items-baseline gap-2">
                <p className="text-4xl font-black tracking-tight text-gray-900 dark:text-white">{value}</p>
                {trend && (
                    <span className={cn("text-sm font-bold", trend === 'up' ? 'text-success' : 'text-warning')}>
                        {trend === 'up' ? '↑' : '↓'}
                    </span>
                )}
            </div>
            {subtitle && <p className="text-sm font-medium text-gray-500 mt-2 dark:text-gray-400">{subtitle}</p>}
        </div>
    </Card>
);

export default function App() {
    const [factory, setFactory] = useState<any>(null);
    const [workers, setWorkers] = useState<any[]>([]);
    const [workstations, setWorkstations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'workers' | 'workstations'>('workers');
    const [filterStr, setFilterStr] = useState('');
    const [socketConnected, setSocketConnected] = useState(socket.connected);

    const loadData = () => {
        setLoading(true);
        Promise.all([
            fetch(`${API_URL}/api/metrics/factory`).then(r => r.json()),
            fetch(`${API_URL}/api/metrics/workers`).then(r => r.json()),
            fetch(`${API_URL}/api/metrics/workstations`).then(r => r.json()),
        ]).then(([fData, wData, sData]) => {
            setFactory(fData);
            setWorkers(wData);
            setWorkstations(sData);
            setLoading(false);
        });
    };

    useEffect(() => {
        loadData();

        function onConnect() {
            setSocketConnected(true);
        }

        function onDisconnect() {
            setSocketConnected(false);
        }

        function onNewEvent(value: any) {
            console.log("New event received via Socket.IO:", value);
            loadData();
        }

        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);
        socket.on('new_event', onNewEvent);

        return () => {
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
            socket.off('new_event', onNewEvent);
        };
    }, []);

    const handleSeed = () => {
        setLoading(true);
        fetch(`${API_URL}/api/seed`, { method: 'POST' })
            .then(() => loadData());
    };

    const filteredWorkers = workers.filter(w => w.name.toLowerCase().includes(filterStr.toLowerCase()) || w.id.includes(filterStr));
    const filteredWorkstations = workstations.filter(s => s.name.toLowerCase().includes(filterStr.toLowerCase()) || s.id.includes(filterStr));

    return (
        <div className="min-h-screen text-gray-900 dark:text-gray-100 p-4 sm:p-8 overflow-hidden">
            <div className="max-w-7xl mx-auto space-y-10 relative z-10">

                {/* Header */}
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 glass-card p-6 md:px-8 md:py-6 rounded-3xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-accent/20 to-transparent blur-3xl rounded-full" />
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="p-3 bg-gradient-to-br from-primary via-info to-accent rounded-2xl text-white shadow-xl shadow-primary/30">
                            <Cpu size={28} />
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-black tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary via-accent to-success">
                                Nexus Factory
                            </h1>
                            <div className="flex items-center gap-3 mt-1">
                                {socketConnected ? (
                                    <p className="text-sm font-medium text-success flex items-center gap-2">
                                        <span className="relative flex h-2.5 w-2.5">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success shadow-[0_0_10px_rgba(var(--success),0.8)]"></span>
                                        </span>
                                        Live AI Connection Active
                                    </p>
                                ) : (
                                    <p className="text-sm font-medium text-warning flex items-center gap-2">
                                        <WifiOff size={14} />
                                        <span>Connecting to AI Feed...</span>
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={handleSeed}
                        className="group flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r hover:from-primary/10 hover:to-accent/10 glass-card !rounded-xl text-sm font-bold overflow-hidden relative transition-all duration-300 ring-1 ring-primary/20 hover:ring-primary/50"
                    >
                        <div className="absolute inset-0 w-0 bg-gradient-to-r from-primary/20 to-accent/20 transition-all duration-500 ease-out group-hover:w-full"></div>
                        <RotateCcw size={16} className="text-primary group-hover:text-accent group-hover:-rotate-180 transition-all duration-500 drop-shadow-sm" />
                        <span className="relative z-10 bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-700 dark:from-white dark:to-gray-200">Reset Demo Data</span>
                    </button>
                </header>

                {loading && !factory ? (
                    <div className="animate-pulse space-y-8">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            {[1, 2, 3, 4].map(i => <div key={i} className="h-40 glass-card bg-gradient-to-br from-gray-200/50 to-gray-300/50 dark:from-gray-800/50 dark:to-gray-700/50 rounded-2xl" />)}
                        </div>
                    </div>
                ) : (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="space-y-10"
                    >
                        {/* Factory Summary Section */}
                        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                            <StatCard
                                title="Total Prod. Time"
                                value={`${factory?.totalProductiveTimeHrs?.toFixed(1) || 0}h`}
                                icon={<Clock size={24} />}
                                trend="up"
                            />
                            <StatCard
                                title="Avg Utilization"
                                value={`${factory?.averageUtilization?.toFixed(1) || 0}%`}
                                icon={<Zap size={24} />}
                                subtitle="Across active units"
                            />
                            <StatCard
                                title="Total Yield"
                                value={factory?.totalUnits || 0}
                                icon={<Box size={24} className="text-accent" />}
                                trend="up"
                            />
                            <StatCard
                                title="Avg Prod. Rate"
                                value={`${factory?.averageProductionRate?.toFixed(1) || 0}/h`}
                                icon={<Activity size={24} className="text-info" />}
                            />
                        </section>

                        {/* Main Content Area */}
                        <main className="space-y-6">
                            <div className="flex flex-col sm:flex-row justify-between gap-4 items-center">
                                <div className="flex glass-card p-1.5 rounded-2xl w-full sm:w-auto shadow-sm ring-1 ring-gray-200/50 dark:ring-white/10">
                                    <button
                                        onClick={() => setActiveTab('workers')}
                                        className={cn(
                                            "flex-1 sm:flex-none flex justify-center items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300",
                                            activeTab === 'workers'
                                                ? 'bg-gradient-to-br from-primary to-info text-white shadow-lg shadow-primary/30'
                                                : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
                                        )}
                                    >
                                        <Users size={18} /> Workers
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('workstations')}
                                        className={cn(
                                            "flex-1 sm:flex-none flex justify-center items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300",
                                            activeTab === 'workstations'
                                                ? 'bg-gradient-to-br from-accent to-primary text-white shadow-lg shadow-accent/30'
                                                : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
                                        )}
                                    >
                                        <Monitor size={18} /> Stations
                                    </button>
                                </div>

                                <div className="relative group w-full sm:w-auto">
                                    <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-primary transition-colors duration-300" size={18} />
                                    <input
                                        type="text"
                                        placeholder={`Search ${activeTab}...`}
                                        value={filterStr}
                                        onChange={(e) => setFilterStr(e.target.value)}
                                        className="pl-12 pr-6 py-3 w-full sm:w-72 glass-card !rounded-2xl font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-gray-400 shadow-inner"
                                    />
                                </div>
                            </div>

                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={activeTab}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                    transition={{ duration: 0.3 }}
                                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                                >
                                    {activeTab === 'workers' ? (
                                        filteredWorkers.map((w, i) => (
                                            <Card key={w.id} className="p-6 transition-colors" transition={{ delay: i * 0.05 }}>
                                                <div className="flex justify-between items-start mb-6">
                                                    <div className="flex gap-4 items-center">
                                                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-transparent flex items-center justify-center text-primary font-black text-xl border border-primary/20">
                                                            {w.name.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <h3 className="font-bold text-lg leading-tight">{w.name}</h3>
                                                            <span className="text-xs font-mono font-medium text-gray-500">{w.id}</span>
                                                        </div>
                                                    </div>
                                                    <div className={cn("px-3 py-1.5 rounded-xl text-xs font-bold", w.utilization > 70 ? 'bg-success/20 text-success' : 'bg-warning/20 text-warning')}>
                                                        {w.utilization.toFixed(0)}% Util
                                                    </div>
                                                </div>
                                                <div className="space-y-4">
                                                    <div className="w-full bg-gray-200/50 dark:bg-gray-800 rounded-full h-2.5 overflow-hidden ring-1 ring-inset ring-black/5 dark:ring-white/5">
                                                        <motion.div
                                                            initial={{ width: 0 }}
                                                            animate={{ width: `${w.utilization}%` }}
                                                            transition={{ duration: 1, ease: "easeOut" }}
                                                            className={cn("h-full rounded-full", w.utilization > 70 ? 'bg-success' : 'bg-warning')}
                                                        />
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="glass-card !bg-black/5 dark:!bg-white/5 p-3 rounded-xl border-none shadow-none">
                                                            <p className="text-[10px] uppercase font-bold tracking-wider text-gray-500 mb-1">Active / Idle</p>
                                                            <p className="font-semibold text-sm">
                                                                <span className="text-success">{w.activeTimeHrs.toFixed(1)}h</span>
                                                                <span className="text-gray-400 mx-1">/</span>
                                                                <span className="text-warning">{w.idleTimeHrs.toFixed(1)}h</span>
                                                            </p>
                                                        </div>
                                                        <div className="glass-card !bg-black/5 dark:!bg-white/5 p-3 rounded-xl border-none shadow-none">
                                                            <p className="text-[10px] uppercase font-bold tracking-wider text-gray-500 mb-1">Yield / UPH</p>
                                                            <p className="font-semibold text-sm">
                                                                <span>{w.totalUnits}</span>
                                                                <span className="text-gray-400 mx-1">/</span>
                                                                <span className="text-primary">{w.uph.toFixed(1)}</span>
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </Card>
                                        ))
                                    ) : (
                                        filteredWorkstations.map((s, i) => (
                                            <Card key={s.id} className="p-6 transition-colors" transition={{ delay: i * 0.05 }}>
                                                <div className="flex justify-between items-start mb-6">
                                                    <div className="flex gap-4 items-center">
                                                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent/20 to-transparent flex items-center justify-center text-accent font-black border border-accent/20">
                                                            <Monitor size={20} />
                                                        </div>
                                                        <div>
                                                            <h3 className="font-bold text-lg leading-tight">{s.name}</h3>
                                                            <span className="text-xs font-mono font-medium text-gray-500">{s.id}</span>
                                                        </div>
                                                    </div>
                                                    <div className={cn("px-3 py-1.5 rounded-xl text-xs font-bold", s.utilization > 70 ? 'bg-accent/20 text-accent' : 'bg-warning/20 text-warning')}>
                                                        {s.utilization.toFixed(0)}% Occupied
                                                    </div>
                                                </div>
                                                <div className="space-y-4">
                                                    <div className="w-full bg-gray-200/50 dark:bg-gray-800 rounded-full h-2.5 overflow-hidden ring-1 ring-inset ring-black/5 dark:ring-white/5">
                                                        <motion.div
                                                            initial={{ width: 0 }}
                                                            animate={{ width: `${s.utilization}%` }}
                                                            transition={{ duration: 1, ease: "easeOut" }}
                                                            className={cn("h-full rounded-full", s.utilization > 70 ? 'bg-accent' : 'bg-warning')}
                                                        />
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="glass-card !bg-black/5 dark:!bg-white/5 p-3 rounded-xl border-none shadow-none">
                                                            <p className="text-[10px] uppercase font-bold tracking-wider text-gray-500 mb-1">Occupancy</p>
                                                            <p className="font-semibold">
                                                                <span className="text-accent">{s.occupancyHrs.toFixed(1)}h</span>
                                                            </p>
                                                        </div>
                                                        <div className="glass-card !bg-black/5 dark:!bg-white/5 p-3 rounded-xl border-none shadow-none">
                                                            <p className="text-[10px] uppercase font-bold tracking-wider text-gray-500 mb-1">Throughput</p>
                                                            <p className="font-semibold">
                                                                <span>{s.throughputRate.toFixed(1)}</span>
                                                                <span className="text-gray-400 text-xs ml-1">avg/h</span>
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </Card>
                                        ))
                                    )}
                                </motion.div>
                            </AnimatePresence>
                        </main>
                    </motion.div>
                )}
            </div>
        </div>
    );
}
