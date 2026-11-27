import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { timingSafeEqual } from 'node:crypto';
import { connectDB } from './db.js';
import Telemetry from './model.js';
const app = express();
app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
const defaultOrigins = ['http://localhost:5173', 'https://drone-frontend-gamma.vercel.app'];
const envOrigins = (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim().replace(/\/+$/, '')).filter(Boolean);
const origins = new Set([...defaultOrigins, ...envOrigins]);
const corsOptions = { origin: (origin, cb) => cb(null, !origin || origins.has('*') || origins.has(origin.replace(/\/+$/, ''))), methods: ['GET', 'POST', 'OPTIONS'], allowedHeaders: ['Content-Type', 'x-device-token'] };
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '12kb' }));
app.use('/api', rateLimit({ windowMs: 60_000, limit: 180, standardHeaders: 'draft-7', legacyHeaders: false }));
app.get('/', (req, res) => res.json({ name: 'RESCUE-X API', status: 'online', simulation: true }));
app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));
function authorized(value) {
    const secret = process.env.DEVICE_API_TOKEN;
    if (!secret || !value) return false;
    const a = Buffer.from(secret), b = Buffer.from(value);
    return a.length === b.length && timingSafeEqual(a, b);
}
const modes = new Set(['IDLE', 'TAKEOFF', 'SEARCHING', 'OBSTACLE_HOLD', 'RETURNING', 'LANDING', 'EMERGENCY', 'COMPLETE']);
const number = (v, min, max) => v === null || v === undefined || (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max);
app.post('/api/telemetry', async (req, res) => {
    try {
        if (!authorized(req.get('x-device-token'))) return res.status(401).json({ error: 'Unauthorized device' });
        const t = req.body;
        if (!t || typeof t.deviceId !== 'string' || !/^[-A-Za-z0-9_]{1,64}$/.test(t.deviceId) || !modes.has(t.mode) || t.simulation !== true)
            return res.status(400).json({ error: 'Invalid deviceId, mode, or simulation flag' });
        const limits = { latitude: [-90, 90], longitude: [-180, 180], altitudeM: [0, 10000], batteryPct: [0, 100], waypoint: [0, 10000], obstacleCm: [0, 500], temperatureC: [-100, 150], humidityPct: [0, 100], thermalSimC: [-100, 150], syntheticDetections: [0, 10000], lastConfidenceSim: [0, 1] };
        if (Object.entries(limits).some(([k, [lo, hi]]) => !number(t[k], lo, hi))) return res.status(400).json({ error: 'Invalid numeric field' });
        if (!Array.isArray(t.motorPWM) || t.motorPWM.length !== 4 || t.motorPWM.some(x => !number(x, 0, 255) || x == null) || !Array.isArray(t.motorRPMEstimated) || t.motorRPMEstimated.length !== 4 || t.motorRPMEstimated.some(x => !number(x, 0, 50000) || x == null)) return res.status(400).json({ error: 'Invalid motors' });
        await connectDB();
        const allowed = ['deviceId', 'simulation', 'mode', ...Object.keys(limits), 'motorPWM', 'motorRPMEstimated'];
        const record = Object.fromEntries(allowed.filter(k => Object.hasOwn(t, k)).map(k => [k, t[k]]));
        const saved = await Telemetry.create(record);
        return res.status(201).json({ ok: true, id: saved.id });
    } catch (e) { console.error('POST telemetry:', e.message); return res.status(503).json({ error: 'Database unavailable' }); }
});
app.get('/api/telemetry/latest', async (req, res) => {
    try { await connectDB(); const item = await Telemetry.findOne({ deviceId: String(req.query.deviceId || 'RESCUE-X-ESP32') }).sort({ receivedAt: -1 }).lean(); return res.json({ item }); }
    catch (e) { console.error(e.message); return res.status(503).json({ error: 'Database unavailable' }); }
});
app.get('/api/telemetry/history', async (req, res) => {
    try { await connectDB(); const limit = Math.min(250, Math.max(1, parseInt(req.query.limit) || 100)); const items = await Telemetry.find({ deviceId: String(req.query.deviceId || 'RESCUE-X-ESP32') }).sort({ receivedAt: -1 }).limit(limit).lean(); return res.json({ items: items.reverse() }); }
    catch (e) { console.error(e.message); return res.status(503).json({ error: 'Database unavailable' }); }
});
export default app;
