/**
 * SG Datalytics — Admin Routes
 * Protected by ADMIN_KEY header. Runs background jobs on the Railway server
 * so enrichment doesn't depend on a stable local internet connection.
 *
 * Endpoints:
 *   POST /admin/enrich-backfill          start backfill (idempotent — won't double-start)
 *   GET  /admin/enrich-backfill/status   check if running + tail of last 50 log lines
 *   POST /admin/enrich-backfill/stop     kill the running job
 */

const express  = require('express');
const { spawn } = require('child_process');
const path     = require('path');
const fs       = require('fs');
const router   = express.Router();

const ADMIN_KEY     = process.env.ADMIN_KEY || '';
const LOG_FILE      = path.join(__dirname, '..', 'enrich-backfill.log');
const SCRIPT_PATH   = path.join(__dirname, '..', 'collectors', 'enrich-backfill.js');

// In-memory job state
let jobProcess  = null;
let jobStarted  = null;
let jobFinished = null;
let jobExitCode = null;

// ── Auth middleware ───────────────────────────────────────────
function requireAdmin(req, res, next) {
  const key = req.headers['x-admin-key'] || req.query.key;
  if (!ADMIN_KEY || key !== ADMIN_KEY) {
    return res.status(401).json({ error: 'Unauthorised — provide x-admin-key header' });
  }
  next();
}

// ── POST /admin/enrich-backfill ───────────────────────────────
router.post('/enrich-backfill', requireAdmin, (req, res) => {
  if (jobProcess && jobProcess.exitCode === null) {
    return res.json({
      status:   'already_running',
      pid:      jobProcess.pid,
      started:  jobStarted,
      message:  'Backfill is already running. GET /admin/enrich-backfill/status to monitor.',
    });
  }

  // Clear old log
  fs.writeFileSync(LOG_FILE, `[${new Date().toISOString()}] Backfill started by admin request\n`);

  const logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });

  jobProcess  = spawn('node', [SCRIPT_PATH], {
    env:   { ...process.env },
    cwd:   path.join(__dirname, '..'),
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  jobStarted  = new Date().toISOString();
  jobFinished = null;
  jobExitCode = null;

  jobProcess.stdout.pipe(logStream);
  jobProcess.stderr.pipe(logStream);

  jobProcess.on('close', code => {
    jobFinished = new Date().toISOString();
    jobExitCode = code;
    logStream.end(`\n[${jobFinished}] Process exited with code ${code}\n`);
  });

  res.json({
    status:  'started',
    pid:     jobProcess.pid,
    started: jobStarted,
    message: 'Backfill running in background. GET /admin/enrich-backfill/status to monitor.',
  });
});

// ── GET /admin/enrich-backfill/status ────────────────────────
router.get('/enrich-backfill/status', requireAdmin, (req, res) => {
  const running = jobProcess && jobProcess.exitCode === null;

  // Read last 50 lines of log
  let logTail = '';
  try {
    const lines = fs.readFileSync(LOG_FILE, 'utf8').split('\n');
    logTail = lines.slice(-50).join('\n');
  } catch (_) {
    logTail = '(no log yet)';
  }

  res.json({
    status:    running ? 'running' : (jobProcess ? 'finished' : 'idle'),
    pid:       jobProcess ? jobProcess.pid : null,
    started:   jobStarted,
    finished:  jobFinished,
    exit_code: jobExitCode,
    log_tail:  logTail,
  });
});

// ── POST /admin/enrich-backfill/stop ─────────────────────────
router.post('/enrich-backfill/stop', requireAdmin, (req, res) => {
  if (!jobProcess || jobProcess.exitCode !== null) {
    return res.json({ status: 'not_running', message: 'No backfill job is currently running.' });
  }
  jobProcess.kill('SIGTERM');
  res.json({ status: 'stopped', pid: jobProcess.pid, message: 'SIGTERM sent to backfill process.' });
});

module.exports = router;
