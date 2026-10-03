import { Router } from 'express';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { config } from '../config.js';
import { hashPin, verifyPin } from '../services/integrity.service.js';
export const SESSION_COOKIE = 'protokol_session';
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h
const MAX_PIN_ATTEMPTS = 5;
const PIN_LOCK_MS = 15 * 60 * 1000; // 15 min
// ---------------------------------------------------------------------------
// Session primitives
// ---------------------------------------------------------------------------
export function createSession(db, project_id, device_token) {
    const id = 'sess_' + crypto.randomBytes(16).toString('hex');
    const expires_at = new Date(Date.now() + SESSION_TTL_MS).toISOString();
    db.prepare(`INSERT INTO sessions (id, project_id, device_token, expires_at) VALUES (?, ?, ?, ?)`).run(id, project_id, device_token, expires_at);
    // Opportunistic cleanup of expired sessions (cheap, runs on login only)
    db.prepare(`DELETE FROM sessions WHERE expires_at < datetime('now')`).run();
    return id;
}
export function getSession(db, token) {
    if (typeof token !== 'string' || !token.startsWith('sess_'))
        return null;
    const s = db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(token);
    if (!s)
        return null;
    if (new Date(s.expires_at).getTime() < Date.now()) {
        db.prepare(`DELETE FROM sessions WHERE id = ?`).run(token);
        return null;
    }
    return s;
}
export function setSessionCookie(res, sessionId) {
    res.cookie(SESSION_COOKIE, sessionId, {
        httpOnly: true, // not readable by JS: XSS can't steal it
        sameSite: 'strict', // same-origin PWA: no CSRF surface
        secure: config.env === 'production', // HTTPS only in prod (Render); plain HTTP on localhost dev
        maxAge: SESSION_TTL_MS,
        path: '/',
    });
}
// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
/** Attaches req.session or rejects with 401. */
export function requireAuth(db) {
    return (req, res, next) => {
        const s = getSession(db, req.cookies?.[SESSION_COOKIE]);
        if (!s) {
            return res.status(401).json({ error: 'UNAUTHENTICATED', message: 'Sesión requerida. Verifique el PIN del proyecto.' });
        }
        req.session = s;
        next();
    };
}
/**
 * Ensures the session belongs to the project targeted by the route.
 * Use inside handlers: `if (!assertProjectAccess(db, req, res, projectId)) return;`
 */
export function assertProjectAccess(db, req, res, projectId) {
    const s = req.session;
    if (!s || s.project_id !== projectId) {
        res.status(403).json({ error: 'FORBIDDEN', message: 'Su sesión no tiene acceso a este proyecto.' });
        return false;
    }
    return true;
}
// ---------------------------------------------------------------------------
// Rate limiters (S-3). Requires app.set('trust proxy', 1) behind Render.
// ---------------------------------------------------------------------------
const isTestEnv = () => process.env.NODE_ENV === 'test' || !!process.env.VITEST;
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20, // 20 PIN attempts / 15 min / IP — brute force on a 4+ char PIN is infeasible
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    // The test suite logs in dozens of times from one IP; never throttle tests.
    skip: isTestEnv,
    message: { error: 'RATE_LIMITED', message: 'Demasiados intentos. Espere 15 minutos.' },
});
export const writeLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: isTestEnv,
    message: { error: 'RATE_LIMITED', message: 'Demasiadas solicitudes. Intente más tarde.' },
});
// ---------------------------------------------------------------------------
// Auth routes (mounted under /api)
// ---------------------------------------------------------------------------
export function createAuthRouter(db) {
    const router = Router();
    /**
     * Verify the centralized PROJECT PIN (two-tier auth, tier 1 = crew access).
     * Legacy: projects created before project PINs (access_pin_hash IS NULL)
     * accept any technician PIN of the project — backward compatible with pilot data.
     */
    router.post('/projects/:id/verify-access', authLimiter, (req, res) => {
        try {
            const projectId = req.params.id;
            const { pin, device_token } = req.body || {};
            if (!pin) {
                return res.status(400).json({ error: 'MISSING_PIN', message: 'PIN requerido.' });
            }
            const project = db.prepare(`SELECT * FROM projects WHERE id = ?`).get(projectId);
            if (!project) {
                return res.status(404).json({ error: 'PROJECT_NOT_FOUND' });
            }
            if (project.pin_locked_until && new Date(project.pin_locked_until).getTime() > Date.now()) {
                const retryMs = new Date(project.pin_locked_until).getTime() - Date.now();
                return res.status(423).json({
                    error: 'PIN_LOCKED',
                    message: 'PIN bloqueado por intentos fallidos. Intente más tarde.',
                    retry_after_seconds: Math.ceil(retryMs / 1000),
                });
            }
            let ok = false;
            if (project.access_pin_hash) {
                ok = verifyPin(String(pin), project.access_pin_hash);
            }
            else {
                // Legacy pilot projects: fall back to any technician PIN (C-01 era data)
                const techs = db.prepare(`SELECT pin_hash FROM technicians WHERE project_id = ?`).all(projectId);
                ok = techs.some(t => {
                    try {
                        return verifyPin(String(pin), t.pin_hash);
                    }
                    catch {
                        return false;
                    }
                });
            }
            if (!ok) {
                const attempts = (project.pin_attempts || 0) + 1;
                const locked_until = attempts >= MAX_PIN_ATTEMPTS
                    ? new Date(Date.now() + PIN_LOCK_MS).toISOString()
                    : null;
                db.prepare(`UPDATE projects SET pin_attempts = ?, pin_locked_until = ? WHERE id = ?`)
                    .run(attempts, locked_until, projectId);
                return res.status(401).json({
                    error: 'INVALID_PIN',
                    message: 'PIN incorrecto.',
                    attempts_remaining: Math.max(0, MAX_PIN_ATTEMPTS - attempts),
                });
            }
            db.prepare(`UPDATE projects SET pin_attempts = 0, pin_locked_until = NULL WHERE id = ?`).run(projectId);
            const token = typeof device_token === 'string' && device_token ? device_token : 'unknown';
            const sessionId = createSession(db, projectId, token);
            db.prepare(`INSERT OR IGNORE INTO project_members (project_id, device_token) VALUES (?, ?)`).run(projectId, token);
            setSessionCookie(res, sessionId);
            return res.status(200).json({ ok: true, project_id: projectId, legacy_mode: !project.access_pin_hash });
        }
        catch (err) {
            return res.status(500).json({ error: 'AUTH_ERROR', message: err.message });
        }
    });
    /**
     * Set (or rotate) the centralized project PIN. Requires the CURRENT PIN
     * (project PIN, or legacy technician PIN) — this is how existing pilot
     * projects migrate to the centralized model. No "change" UI for employees:
     * whoever holds the current PIN is the company admin by definition.
     */
    router.post('/projects/:id/access-pin', authLimiter, (req, res) => {
        try {
            const projectId = req.params.id;
            const { current_pin, new_pin } = req.body || {};
            if (!current_pin || !new_pin || String(new_pin).length < 4) {
                return res.status(400).json({ error: 'INVALID_PIN', message: 'PIN actual y PIN nuevo (mín. 4 caracteres) requeridos.' });
            }
            const project = db.prepare(`SELECT * FROM projects WHERE id = ?`).get(projectId);
            if (!project)
                return res.status(404).json({ error: 'PROJECT_NOT_FOUND' });
            let ok = false;
            if (project.access_pin_hash) {
                ok = verifyPin(String(current_pin), project.access_pin_hash);
            }
            else {
                const techs = db.prepare(`SELECT pin_hash FROM technicians WHERE project_id = ?`).all(projectId);
                ok = techs.some(t => { try {
                    return verifyPin(String(current_pin), t.pin_hash);
                }
                catch {
                    return false;
                } });
            }
            if (!ok)
                return res.status(401).json({ error: 'INVALID_PIN', message: 'PIN actual incorrecto.' });
            db.prepare(`UPDATE projects SET access_pin_hash = ?, pin_attempts = 0, pin_locked_until = NULL WHERE id = ?`)
                .run(hashPin(String(new_pin)), projectId);
            // Invalidate all existing sessions: a PIN rotation must log everyone out.
            db.prepare(`DELETE FROM sessions WHERE project_id = ?`).run(projectId);
            return res.status(200).json({ ok: true });
        }
        catch (err) {
            return res.status(500).json({ error: 'AUTH_ERROR', message: err.message });
        }
    });
    /** Destroy the current session. */
    router.post('/auth/logout', (req, res) => {
        const token = req.cookies?.[SESSION_COOKIE];
        if (typeof token === 'string') {
            db.prepare(`DELETE FROM sessions WHERE id = ?`).run(token);
        }
        res.clearCookie(SESSION_COOKIE, { path: '/' });
        return res.status(200).json({ ok: true });
    });
    return router;
}
