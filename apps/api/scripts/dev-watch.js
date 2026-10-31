/**
 * Dev runner: `tsc --watch` (which emits decorator metadata) + `node` restarts.
 *
 * Why not `tsx watch`: tsx's esbuild transform strips
 * `emitDecoratorMetadata`, so Nest injects `undefined` for every constructor
 * dependency and the API boots but 500s/503s on every injected route. Plain
 * `tsc` output carries `design:paramtypes`, so we compile the same way we ship.
 */
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const entry = path.join(root, 'dist', 'main.js');
const bin = (name) =>
  path.join(
    root,
    '..',
    '..',
    'node_modules',
    '.bin',
    process.platform === 'win32' ? `${name}.cmd` : name,
  );

let child = null;
let restarting = false;

function start() {
  if (child) return;
  child = spawn(process.execPath, [entry], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  });
  child.on('exit', (code) => {
    child = null;
    if (!restarting && code !== 0) {
      console.error(`[dev] API exited with code ${code}. Waiting for changes...`);
    }
    restarting = false;
  });
}

function restart() {
  if (!child) {
    start();
    return;
  }
  restarting = true;
  child.once('exit', start);
  child.kill('SIGTERM');
}

/**
 * Watch `dist/` and restart the API when compiled output changes.
 *
 * `fs.watch` is unreliable across Docker bind mounts (events from the host are
 * frequently dropped), so this polls mtimes instead. Polling is cheap here —
 * only the compiled .js files are stat-ed, once per interval.
 */
function watchCompiled() {
  const dir = path.join(root, 'dist');
  const seen = new Map();

  const snapshot = () => {
    const stamp = [];
    const walk = (current) => {
      let entries;
      try {
        entries = fs.readdirSync(current, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        const full = path.join(current, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (entry.name.endsWith('.js')) {
          try {
            stamp.push(`${full}:${fs.statSync(full).mtimeMs}`);
          } catch {
            // File vanished mid-walk; ignore.
          }
        }
      }
    };
    walk(dir);
    return stamp.join('|');
  };

  seen.current = snapshot();
  setInterval(() => {
    const next = snapshot();
    if (next !== seen.current) {
      seen.current = next;
      console.log('[dev] change detected — restarting API');
      restart();
    }
  }, Number(process.env.DEV_POLL_MS ?? 1000)).unref();
}

// tsc in watch mode emits "Found N errors. Watching for file changes." to
// stdout when a compile round ends. Pipe it through so we can see that line and
// decide whether the output is trustworthy; the text is forwarded unchanged.
const tsc = spawn(bin('tsc'), ['-p', 'tsconfig.json', '--watch', '--preserveWatchOutput'], {
  cwd: root,
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: process.platform === 'win32',
});

tsc.on('exit', (code) => {
  console.error(`[dev] tsc --watch exited with code ${code}`);
  process.exit(code ?? 1);
});

// Start the app only after the FIRST compile succeeded.
//
// The entrypoint existing is not proof of a good build: `dist/` lives in a
// named volume and survives restarts, so a stale main.js from an earlier run
// would be executed against source that no longer compiles — the API then boots
// fine but serves old code, hiding real type errors.
let started = false;

function onTscOutput(chunk) {
  const text = String(chunk);
  process.stdout.write(text);
  if (started) return;
  if (/Found [1-9]\d* error/.test(text)) {
    console.error('[dev] compile failed — API not started; fix the errors above');
    return;
  }
  if (!/Watching for file changes|Found 0 error/.test(text)) return;
  if (/Found [1-9]\d* error/.test(text)) return; // same chunk ends with the watch line
  started = true;
  watchCompiled();
  start();
}

tsc.stdout.on('data', onTscOutput);
tsc.stderr.on('data', onTscOutput);

const shutdown = () => {
  if (child) child.kill('SIGTERM');
  tsc.kill('SIGTERM');
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
