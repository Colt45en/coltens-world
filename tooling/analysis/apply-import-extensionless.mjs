import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const targetArg = process.argv[2];

if (!targetArg) {
  console.error('Usage: node tooling/analysis/apply-import-extensionless.mjs <target-dir>');
  process.exit(1);
}

const targetDir = path.resolve(root, targetArg);
const exts = new Set(['.ts', '.tsx']);
const ignoreDirs = new Set(['node_modules', 'dist', 'build', '.git', '.next', '.vite', '.turbo']);

function toPosix(value) {
  return value.split(path.sep).join('/');
}

function rel(filePath) {
  return toPosix(path.relative(root, filePath));
}

async function walk(dir, acc) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (ignoreDirs.has(entry.name)) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(abs, acc);
      continue;
    }
    if (entry.isFile() && exts.has(path.extname(entry.name))) {
      acc.push(abs);
    }
  }
}

function rewrite(content) {
  let output = content;

  output = output.replace(/(from\s+['"])(\.{1,2}\/[^'"]+)\.js(['"])/g, '$1$2$3');
  output = output.replace(/(export\s+[^'"\n]*?from\s+['"])(\.{1,2}\/[^'"]+)\.js(['"])/g, '$1$2$3');
  output = output.replace(/(require\(\s*['"])(\.{1,2}\/[^'"]+)\.js(['"]\s*\))/g, '$1$2$3');
  output = output.replace(/(import\(\s*['"])(\.{1,2}\/[^'"]+)\.js(['"]\s*\))/g, '$1$2$3');

  return output;
}

async function main() {
  const files = [];
  await walk(targetDir, files);

  const changed = [];
  for (const filePath of files) {
    const before = await fs.readFile(filePath, 'utf8');
    const after = rewrite(before);
    if (after !== before) {
      await fs.writeFile(filePath, after);
      changed.push(rel(filePath));
    }
  }

  console.log(`Changed files: ${changed.length}`);
  for (const file of changed) {
    console.log(file);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
