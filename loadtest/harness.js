/**
 * Yjs realtime load-test harness — headless virtual clients.
 *
 * No browser. Each virtual user is a real CRDT peer: a Y.Doc synced to the
 * production WSServer.js over the raw y-protocols binary handshake (the same
 * protocol y-websocket speaks), authenticated with a real JWT.
 *
 * Measures round-trip *sync latency*: client A stamps a mutation with a
 * monotonic timestamp; the observer firing on client B records now - stamp.
 * All clients share one process clock, so the delta is honest.
 *
 * Usage:
 *   node ../loadtest/harness.js --scenario single   --peers 50  --rate 5 --duration 20
 *   node ../loadtest/harness.js --scenario many      --boards 200 --peersPerBoard 3 --rate 1 --duration 20
 *   node ../loadtest/harness.js --scenario crossinst --peers 20  --urls ws://localhost:3030,ws://localhost:3031
 *
 * Requires: backend running, Mongo + Redis reachable (it seeds boards directly).
 */
import dotenv from 'dotenv';
dotenv.config();
import jwt from 'jsonwebtoken';
import WebSocket from 'ws';
import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import mongoose from 'mongoose';
import { connectToDatabase } from '../backend/db.js';
import Whiteboard from '../backend/models/whiteboardModel.js';

const MSG_SYNC = 0;
const MSG_AWARENESS = 1;

// ── args ──────────────────────────────────────────────────────────────────
function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
}
const SCENARIO       = arg('scenario', 'single');
const PEERS          = parseInt(arg('peers', '50'), 10);
const BOARDS         = parseInt(arg('boards', '1'), 10);
const PEERS_PER_BOARD= parseInt(arg('peersPerBoard', String(PEERS)), 10);
const RATE           = parseFloat(arg('rate', '5'));      // mutations/sec per peer
const DURATION       = parseInt(arg('duration', '20'), 10); // seconds of steady load
const URLS           = arg('urls', 'ws://localhost:3030').split(',').map(s => s.trim());
const JWT_SECRET     = process.env.JWT_SECRET;

if (!JWT_SECRET) { console.error('JWT_SECRET missing'); process.exit(1); }

const OWNER_EMAIL = 'loadtest-owner@example.test';
const token = jwt.sign({ email: OWNER_EMAIL }, JWT_SECRET, { expiresIn: '1h' });

// ── latency stats ───────────────────────────────────────────────────────────
const latencies = []; // ms, round-trip A.write → B.observe
let appliedUpdates = 0, sentMutations = 0;

// Sort once; index percentiles off the sorted copy. Avoid spread (`...arr`)
// and `Math.max(...arr)` — they overflow the call stack past ~100k samples.
function pctFrom(sorted, p) {
  if (!sorted.length) return NaN;
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}
function summary() {
  const sorted = latencies.slice().sort((a, b) => a - b);
  let sum = 0, mx = 0;
  for (let i = 0; i < latencies.length; i++) { sum += latencies[i]; if (latencies[i] > mx) mx = latencies[i]; }
  return {
    samples: latencies.length,
    sentMutations,
    appliedUpdates,
    p50: +pctFrom(sorted, 50).toFixed(1),
    p95: +pctFrom(sorted, 95).toFixed(1),
    p99: +pctFrom(sorted, 99).toFixed(1),
    max: +mx.toFixed(1),
    mean: +(sum / (latencies.length || 1)).toFixed(1),
  };
}

// ── a single virtual client ───────────────────────────────────────────────
class VClient {
  constructor(boardId, idx, url) {
    this.boardId = boardId;
    this.idx = idx;
    this.url = url;
    this.doc = new Y.Doc();
    this.elements = this.doc.getMap('elements');
    this.myKey = `lt-${boardId}-${idx}`;
    this.synced = false;
    this.connected = false;

    // Observe remote changes → measure latency from embedded _ts stamp.
    this.elements.observe((event) => {
      event.changes.keys.forEach((_change, key) => {
        const v = this.elements.get(key);
        // Only count updates authored by *other* clients carrying a stamp.
        if (v && v._ts && v._by !== this.myKey) {
          latencies.push(performance.now() - v._ts);
          appliedUpdates++;
        }
      });
    });
  }

  connect() {
    return new Promise((resolve) => {
      const ws = new WebSocket(`${this.url}/yjs/${this.boardId}?token=${token}`);
      ws.binaryType = 'arraybuffer';
      this.ws = ws;

      ws.on('open', () => {
        this.connected = true;
        // SyncStep1: send our state vector to start the handshake.
        const enc = encoding.createEncoder();
        encoding.writeVarUint(enc, MSG_SYNC);
        syncProtocol.writeSyncStep1(enc, this.doc);
        ws.send(encoding.toUint8Array(enc));
      });

      ws.on('message', (data) => {
        const buf = new Uint8Array(data);
        const dec = decoding.createDecoder(buf);
        const enc = encoding.createEncoder();
        const type = decoding.readVarUint(dec);
        if (type === MSG_SYNC) {
          encoding.writeVarUint(enc, MSG_SYNC);
          // readSyncMessage applies steps and may produce a reply (SyncStep2).
          const syncType = syncProtocol.readSyncMessage(dec, enc, this.doc, this);
          if (encoding.length(enc) > 1) ws.send(encoding.toUint8Array(enc));
          // After first SyncStep2 from server, we're synced.
          if (syncType === syncProtocol.messageYjsSyncStep2 && !this.synced) {
            this.synced = true;
            resolve();
          }
        } else if (type === MSG_AWARENESS) {
          // ignore awareness frames for this test
        }
      });

      ws.on('close', () => { this.connected = false; });
      ws.on('error', () => { this.connected = false; resolve(); });

      // Propagate local doc updates to the server (write path).
      this.doc.on('update', (update, origin) => {
        if (origin === this) return; // don't echo server-applied updates back
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          const e = encoding.createEncoder();
          encoding.writeVarUint(e, MSG_SYNC);
          syncProtocol.writeUpdate(e, update);
          this.ws.send(encoding.toUint8Array(e));
        }
      });

      // Safety: resolve after 5s even if no SyncStep2 (so the run doesn't hang).
      setTimeout(() => resolve(), 5000);
    });
  }

  mutate() {
    if (!this.connected) return;
    this.doc.transact(() => {
      this.elements.set(this.myKey, {
        id: this.myKey,
        type: 'sticky',
        pageId: 'p1',
        x: Math.round(Math.random() * 1920),
        y: Math.round(Math.random() * 1080),
        w: 160, h: 160, z: 1,
        _ts: performance.now(), // round-trip stamp
        _by: this.myKey,
      });
    }, 'board-local');
    sentMutations++;
  }

  close() { try { this.ws?.close(); } catch { /* */ } this.doc.destroy(); }
}

// ── seed boards owned by the test user (owner ⇒ editor role) ────────────────
async function seedBoards(n) {
  const ids = [];
  for (let i = 0; i < n; i++) {
    const doc = await Whiteboard.findOneAndUpdate(
      { title: `__loadtest_${i}`, owner: OWNER_EMAIL },
      { $setOnInsert: { title: `__loadtest_${i}`, owner: OWNER_EMAIL } },
      { upsert: true, new: true },
    ).lean();
    ids.push(doc.id);
  }
  return ids;
}
async function cleanupBoards() {
  await Whiteboard.deleteMany({ owner: OWNER_EMAIL });
}

// ── run ─────────────────────────────────────────────────────────────────────
async function run() {
  await connectToDatabase();

  const boardCount = SCENARIO === 'many' ? BOARDS : 1;
  const perBoard   = SCENARIO === 'many' ? PEERS_PER_BOARD : PEERS;
  const boardIds = await seedBoards(boardCount);

  const config = { SCENARIO, boardCount, perBoard, RATE, DURATION, URLS, totalPeers: boardCount * perBoard };
  console.log('▶ config', config);

  // Build clients. For crossinst, round-robin peers across the provided URLs.
  const clients = [];
  for (const boardId of boardIds) {
    for (let p = 0; p < perBoard; p++) {
      const url = URLS[p % URLS.length];
      clients.push(new VClient(boardId, p, url));
    }
  }

  console.log(`⏳ connecting ${clients.length} virtual clients…`);
  const connectStart = performance.now();
  // Connect in waves of 50 to avoid a local socket-open thundering herd.
  for (let i = 0; i < clients.length; i += 50) {
    await Promise.all(clients.slice(i, i + 50).map(c => c.connect()));
  }
  const connectMs = performance.now() - connectStart;
  const connected = clients.filter(c => c.connected).length;
  console.log(`✓ ${connected}/${clients.length} connected in ${connectMs.toFixed(0)}ms`);

  // Steady-state load: each client mutates at RATE/sec for DURATION sec.
  console.log(`🔥 driving load: ${RATE} mut/s/peer for ${DURATION}s …`);
  const intervalMs = 1000 / RATE;
  const timers = clients.map((c, i) =>
    setInterval(() => c.mutate(), intervalMs + (i % 17)) // tiny jitter to avoid lockstep
  );
  // Discard warm-up samples (first 2s) so connect-burst noise doesn't skew p99.
  await new Promise(r => setTimeout(r, 2000));
  latencies.length = 0; appliedUpdates = 0; sentMutations = 0;
  const memBefore = process.memoryUsage().rss;

  await new Promise(r => setTimeout(r, DURATION * 1000));
  timers.forEach(clearInterval);
  // Let the last in-flight updates land.
  await new Promise(r => setTimeout(r, 1500));

  const stats = summary();
  const result = { config, connected, connectMs: +connectMs.toFixed(0),
    harnessRssMB: +(process.memoryUsage().rss / 1e6).toFixed(0), ...stats };
  console.log('📊 RESULT', JSON.stringify(result, null, 2));

  // Probe server readiness/backlog right after the burst.
  try {
    const r = await fetch(`${URLS[0].replace('ws', 'http')}/ready`);
    result.ready = { status: r.status, body: await r.json().catch(() => ({})) };
    console.log('🩺 /ready', result.ready.status, JSON.stringify(result.ready.body));
  } catch (e) { result.ready = { error: e.message }; }

  clients.forEach(c => c.close());
  await cleanupBoards();
  await mongoose.disconnect();
  return result;
}

run().then(res => {
  // Emit a machine-readable line the runner script can capture.
  console.log('::RESULT_JSON::' + JSON.stringify(res));
  process.exit(0);
}).catch(err => { console.error('harness error:', err); process.exit(1); });
