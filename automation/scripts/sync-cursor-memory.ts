// Rebuilds .cursor/claude-memory/ from Claude's memory folder, so Cursor follows the same rules.
// It copies only `feedback` and `reference` files (standing rules). It skips `project` files,
// because they hold status that goes stale, and the progress files already hold that state.
//   npm run sync:cursor-memory                 # rebuild
//   MEMORY_DIR=/path/to/memory npm run sync:cursor-memory   # use another memory folder
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const repo = path.resolve(import.meta.dirname, '../..');
const memoryDir =
  process.env.MEMORY_DIR ?? path.join(os.homedir(), '.claude', 'projects', repo.replace(/[^A-Za-z0-9]/g, '-'), 'memory');
const outDir = path.join(repo, '.cursor', 'claude-memory');

if (!fs.existsSync(path.join(memoryDir, 'MEMORY.md'))) {
  console.error(`No MEMORY.md in ${memoryDir}. Set MEMORY_DIR and run again.`);
  process.exit(1);
}

const keep = new Set<string>();
for (const file of fs.readdirSync(memoryDir)) {
  if (!file.endsWith('.md') || file === 'MEMORY.md') continue;
  const text = fs.readFileSync(path.join(memoryDir, file), 'utf8');
  const type = text.match(/^\s*type:\s*(\w+)\s*$/m)?.[1];
  if (type === 'feedback' || type === 'reference') keep.add(file);
}

const index = fs
  .readFileSync(path.join(memoryDir, 'MEMORY.md'), 'utf8')
  .split('\n')
  .filter((line) => {
    const target = line.match(/\]\(([^)]+\.md)\)/)?.[1];
    return target !== undefined && keep.has(target);
  });

fs.mkdirSync(outDir, { recursive: true });
for (const old of fs.readdirSync(outDir)) {
  if (old.endsWith('.md')) fs.rmSync(path.join(outDir, old));
}
for (const file of keep) fs.copyFileSync(path.join(memoryDir, file), path.join(outDir, file));
fs.writeFileSync(path.join(outDir, 'MEMORY.md'), index.join('\n') + '\n');

console.log(`Copied ${keep.size} rule files and ${index.length} index lines to .cursor/claude-memory/.`);
