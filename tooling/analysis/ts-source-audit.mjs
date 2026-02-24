import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const rootsToScan = [
  path.join(root, 'apps'),
  path.join(root, 'packages')
];

const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx']);
const tsExts = new Set(['.ts', '.tsx']);
const jsExts = new Set(['.js', '.jsx']);
const ignoreDirs = new Set(['node_modules', 'dist', 'build', '.next', '.vite', '.turbo', '.git', 'coverage']);

function toPosix(value) {
  return value.split(path.sep).join('/');
}

function rel(filePath) {
  return toPosix(path.relative(root, filePath));
}

function stemFor(filePath) {
  const extension = path.extname(filePath);
  return filePath.slice(0, -extension.length);
}

function isSourceFile(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return sourceExtensions.has(extension) && filePath.includes(`${path.sep}src${path.sep}`);
}

async function walk(directory, results) {
  let entries = [];
  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (ignoreDirs.has(entry.name)) {
      continue;
    }

    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await walk(absolutePath, results);
      continue;
    }

    if (entry.isFile() && isSourceFile(absolutePath)) {
      results.push(absolutePath);
    }
  }
}

function parseSpecifiers(content) {
  const specifiers = [];
  const patterns = [
    /import\s+[^'"`]*?from\s*["']([^"']+)["']/g,
    /import\s*["']([^"']+)["']/g,
    /export\s+[^'"`]*?from\s*["']([^"']+)["']/g,
    /require\(\s*["']([^"']+)["']\s*\)/g,
    /import\(\s*["']([^"']+)["']\s*\)/g
  ];

  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      if (match[1]) {
        specifiers.push(match[1]);
      }
    }
  }

  return specifiers;
}

function resolveRelativeSpecifier(importerPath, specifier, sourceFileSet) {
  if (!specifier.startsWith('.')) {
    return null;
  }

  const importerDir = path.dirname(importerPath);
  const rawTarget = path.resolve(importerDir, specifier);
  const ext = path.extname(rawTarget);

  if (ext) {
    if (sourceFileSet.has(rawTarget)) {
      return rawTarget;
    }

    return null;
  }

  const candidates = [
    `${rawTarget}.ts`,
    `${rawTarget}.tsx`,
    `${rawTarget}.js`,
    `${rawTarget}.jsx`,
    path.join(rawTarget, 'index.ts'),
    path.join(rawTarget, 'index.tsx'),
    path.join(rawTarget, 'index.js'),
    path.join(rawTarget, 'index.jsx')
  ];

  for (const candidate of candidates) {
    if (sourceFileSet.has(candidate)) {
      return candidate;
    }
  }

  return null;
}

function detectPackageRoot(filePath) {
  const normalized = rel(filePath);
  const segments = normalized.split('/');
  if (segments.length < 2) {
    return null;
  }

  const scope = segments[0];
  if (scope !== 'apps' && scope !== 'packages') {
    return null;
  }

  return path.join(root, segments[0], segments[1]);
}

async function getPackageInfo(packageRoot) {
  const packageJsonPath = path.join(packageRoot, 'package.json');
  try {
    const raw = await fs.readFile(packageJsonPath, 'utf8');
    const data = JSON.parse(raw);

    const references = [];

    const maybePush = (value) => {
      if (typeof value === 'string') {
        references.push(value);
      }
    };

    maybePush(data.main);
    maybePush(data.module);
    maybePush(data.types);
    maybePush(data.typings);

    const walkExports = (value) => {
      if (!value) {
        return;
      }

      if (typeof value === 'string') {
        references.push(value);
        return;
      }

      if (typeof value === 'object') {
        for (const child of Object.values(value)) {
          walkExports(child);
        }
      }
    };

    walkExports(data.exports);

    return {
      packageJsonPath,
      name: data.name || rel(packageRoot),
      references
    };
  } catch {
    return null;
  }
}

function classifyPair({ tsPath, jsPath, tsImporters, jsImporters, packageRefs }) {
  const reasons = [];
  let winner = 'mixed';
  let confidence = 0.5;

  const tsCount = tsImporters.length;
  const jsCount = jsImporters.length;

  const jsEntrypoint = packageRefs.some((ref) => ref.endsWith('.js') && (ref.endsWith(rel(jsPath)) || ref.includes(path.basename(jsPath))));
  const tsEntrypoint = packageRefs.some((ref) => (ref.endsWith('.ts') || ref.endsWith('.tsx')) && (ref.endsWith(rel(tsPath)) || ref.includes(path.basename(tsPath))));

  if (jsEntrypoint) {
    reasons.push('package entrypoint references JS file');
  }
  if (tsEntrypoint) {
    reasons.push('package entrypoint references TS file');
  }

  if (tsCount > 0 && jsCount === 0 && !jsEntrypoint) {
    winner = 'ts';
    confidence = 0.95;
    reasons.push('TS has importers and JS has none');
  } else if (jsCount > 0 && tsCount === 0 && !tsEntrypoint) {
    winner = 'js';
    confidence = 0.85;
    reasons.push('JS has importers and TS has none');
  } else if (tsCount >= jsCount && !jsEntrypoint) {
    winner = 'ts';
    confidence = tsCount === jsCount ? 0.7 : 0.8;
    reasons.push('TS importer count is dominant or equal with no JS entrypoint');
  } else if (jsCount > tsCount && !tsEntrypoint) {
    winner = 'js';
    confidence = 0.75;
    reasons.push('JS importer count is dominant');
  }

  if (jsEntrypoint && tsEntrypoint) {
    winner = 'mixed';
    confidence = 0.4;
    reasons.push('both TS and JS entrypoints are referenced');
  }

  let suggestedAction = 'keep';
  if (winner === 'ts' && jsCount === 0 && !jsEntrypoint) {
    suggestedAction = 'delete-candidate';
  } else if (winner === 'ts' && jsCount > 0) {
    suggestedAction = 'rewrite-js-imports-then-delete';
  } else if (winner === 'mixed') {
    suggestedAction = 'manual-review';
  } else if (winner === 'js') {
    suggestedAction = 'verify-ts-stale-or-migrate-entrypoints';
  }

  return { winner, confidence, reasons, suggestedAction };
}

function buildImportRewritePatch(importerPath, oldSpecifier, newSpecifier, line) {
  const relativePath = rel(importerPath);
  return [`--- a/${relativePath}`, `+++ b/${relativePath}`, '@@', `-${line}`, `+${line.replace(oldSpecifier, newSpecifier)}`, ''].join('\n');
}

function buildEntrypointPatch(packageJsonPath, oldValue, newValue, line) {
  const relativePath = rel(packageJsonPath);
  return [`--- a/${relativePath}`, `+++ b/${relativePath}`, '@@', `-${line}`, `+${line.replace(oldValue, newValue)}`, ''].join('\n');
}

function normalizeEntrypointRef(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.replace(/\\/g, '/');
  const declarationRef = normalized.endsWith('.d.ts');
  const isSrcPath = normalized.startsWith('src/') || normalized.startsWith('./src/');
  const isTsPath = normalized.endsWith('.ts') || normalized.endsWith('.tsx');
  const isJsPath = normalized.endsWith('.js') || normalized.endsWith('.jsx');

  if (declarationRef) {
    return null;
  }

  if (!isSrcPath && !isTsPath) {
    return null;
  }

  let candidate = normalized;
  if (candidate.startsWith('src/')) {
    candidate = `dist/${candidate.slice(4)}`;
  } else if (candidate.startsWith('./src/')) {
    candidate = `./dist/${candidate.slice(6)}`;
  }

  if (isTsPath) {
    if (candidate.endsWith('.tsx')) {
      candidate = candidate.slice(0, -4);
    } else if (candidate.endsWith('.ts')) {
      candidate = `${candidate.slice(0, -3)}.js`;
    }
  }

  if (!isJsPath && !candidate.endsWith('.js') && !candidate.endsWith('.mjs') && !candidate.endsWith('.cjs')) {
    return null;
  }

  return candidate;
}

async function main() {
  const sourceFiles = [];
  for (const scanRoot of rootsToScan) {
    await walk(scanRoot, sourceFiles);
  }

  const sourceFileSet = new Set(sourceFiles);

  const byStem = new Map();
  for (const filePath of sourceFiles) {
    const stem = stemFor(filePath);
    const extension = path.extname(filePath).toLowerCase();
    if (!byStem.has(stem)) {
      byStem.set(stem, { ts: [], js: [] });
    }

    const bucket = byStem.get(stem);
    if (tsExts.has(extension)) {
      bucket.ts.push(filePath);
    }
    if (jsExts.has(extension)) {
      bucket.js.push(filePath);
    }
  }

  const importersByTarget = new Map();
  const importerSpecMap = new Map();

  for (const filePath of sourceFiles) {
    const content = await fs.readFile(filePath, 'utf8');
    const specifiers = parseSpecifiers(content);
    const lines = content.split(/\r?\n/);

    for (const specifier of specifiers) {
      const target = resolveRelativeSpecifier(filePath, specifier, sourceFileSet);
      if (!target) {
        continue;
      }

      if (!importersByTarget.has(target)) {
        importersByTarget.set(target, new Set());
      }
      importersByTarget.get(target).add(filePath);

      const importerKey = `${filePath}::${specifier}`;
      if (!importerSpecMap.has(importerKey)) {
        const matchedLine = lines.find((line) => line.includes(specifier)) || '';
        importerSpecMap.set(importerKey, { filePath, specifier, line: matchedLine });
      }
    }
  }

  const packageRoots = new Set();
  for (const filePath of sourceFiles) {
    const packageRoot = detectPackageRoot(filePath);
    if (packageRoot) {
      packageRoots.add(packageRoot);
    }
  }

  const packageInfos = [];
  for (const packageRoot of packageRoots) {
    const info = await getPackageInfo(packageRoot);
    if (info) {
      packageInfos.push(info);
    }
  }

  const packageInfoByRoot = new Map();
  for (const info of packageInfos) {
    packageInfoByRoot.set(path.dirname(info.packageJsonPath), info);
  }

  const twinPairs = [];
  const importRewritePatches = [];
  const entrypointPatches = [];
  const tsconfigSuggestions = [];

  for (const [stem, files] of byStem.entries()) {
    if (files.ts.length === 0 || files.js.length === 0) {
      continue;
    }

    const tsPath = files.ts.sort()[0];
    const jsPath = files.js.sort()[0];

    const tsImporters = Array.from(importersByTarget.get(tsPath) || []).map(rel).sort();
    const jsImporters = Array.from(importersByTarget.get(jsPath) || []).map(rel).sort();

    const packageRoot = detectPackageRoot(tsPath) || detectPackageRoot(jsPath);
    const pkgInfo = packageRoot ? packageInfoByRoot.get(packageRoot) : null;
    const packageRefs = pkgInfo?.references || [];

    const { winner, confidence, reasons, suggestedAction } = classifyPair({
      tsPath,
      jsPath,
      tsImporters,
      jsImporters,
      packageRefs
    });

    twinPairs.push({
      pair: `${rel(tsPath)} <-> ${rel(jsPath)}`,
      tsPath: rel(tsPath),
      jsPath: rel(jsPath),
      winner,
      confidence: Number(confidence.toFixed(2)),
      reasons,
      importers: {
        ts: tsImporters,
        js: jsImporters
      },
      package: pkgInfo?.name || null,
      suggested_action: suggestedAction
    });

    for (const [key, value] of importerSpecMap.entries()) {
      const { filePath, specifier, line } = value;
      if (!specifier.endsWith('.js')) {
        continue;
      }

      const resolved = resolveRelativeSpecifier(filePath, specifier, sourceFileSet);
      if (!resolved || resolved !== jsPath) {
        continue;
      }

      const extensionless = specifier.slice(0, -3);
      importRewritePatches.push(buildImportRewritePatch(filePath, specifier, extensionless, line));
    }

    if (pkgInfo) {
      const packageJsonRaw = await fs.readFile(pkgInfo.packageJsonPath, 'utf8');
      const packageJsonLines = packageJsonRaw.split(/\r?\n/);
      for (const ref of packageRefs) {
        const normalizedRef = normalizeEntrypointRef(ref);
        if (!normalizedRef || normalizedRef === ref) {
          continue;
        }

        if (!packageJsonRaw.includes(ref)) {
          continue;
        }

        const matchingLine = packageJsonLines.find((line) => line.includes(ref));
        if (!matchingLine) {
          continue;
        }

        entrypointPatches.push(buildEntrypointPatch(pkgInfo.packageJsonPath, ref, normalizedRef, matchingLine));
      }
    }
  }

  const tsconfigFiles = [
    path.join(root, 'tsconfig.json'),
    path.join(root, 'tsconfig.base.json')
  ];

  for (const tsconfigPath of tsconfigFiles) {
    try {
      const raw = await fs.readFile(tsconfigPath, 'utf8');
      const data = JSON.parse(raw);
      const compilerOptions = data.compilerOptions || {};
      const suggestions = [];

      if (compilerOptions.allowJs !== false) {
        suggestions.push('set compilerOptions.allowJs = false');
      }
      if (compilerOptions.checkJs === true) {
        suggestions.push('set compilerOptions.checkJs = false');
      }
      if (!compilerOptions.outDir) {
        suggestions.push('set compilerOptions.outDir per package/app for TS->dist build clarity');
      }
      if (compilerOptions.declaration !== true) {
        suggestions.push('enable compilerOptions.declaration for publishable packages');
      }

      if (suggestions.length > 0) {
        tsconfigSuggestions.push({
          file: rel(tsconfigPath),
          suggestions
        });
      }
    } catch {
      // ignore malformed or absent files
    }
  }

  twinPairs.sort((a, b) => {
    if (b.confidence !== a.confidence) {
      return b.confidence - a.confidence;
    }
    return a.pair.localeCompare(b.pair);
  });

  const winnerCounts = twinPairs.reduce((acc, pair) => {
    acc[pair.winner] = (acc[pair.winner] || 0) + 1;
    return acc;
  }, {});

  const deleteCandidates = twinPairs
    .filter((pair) => pair.suggested_action === 'delete-candidate')
    .map((pair) => `${pair.jsPath} | winner=ts | confidence=${pair.confidence}`)
    .sort();

  const reportDir = path.join(root, 'reports', 'ts-source-audit');
  const patchDir = path.join(root, 'patches');

  await fs.mkdir(reportDir, { recursive: true });
  await fs.mkdir(patchDir, { recursive: true });

  const jsonReport = {
    generatedAt: new Date().toISOString(),
    totalPairs: twinPairs.length,
    winnerCounts,
    pairs: twinPairs
  };

  await fs.writeFile(path.join(reportDir, 'twin_report.json'), JSON.stringify(jsonReport, null, 2));

  const mdLines = [
    '# TS-as-Source Twin Report',
    '',
    `- Total twin pairs: ${twinPairs.length}`,
    `- Winner counts: ${Object.entries(winnerCounts).map(([k, v]) => `${k}=${v}`).join(', ') || 'none'}`,
    '',
    '## Ranked Pairs',
    ''
  ];

  for (const pair of twinPairs) {
    mdLines.push(`- **${pair.pair}**`);
    mdLines.push(`  - winner: ${pair.winner}`);
    mdLines.push(`  - confidence: ${pair.confidence}`);
    mdLines.push(`  - suggested_action: ${pair.suggested_action}`);
    mdLines.push(`  - reasons: ${pair.reasons.join('; ') || 'none'}`);
    mdLines.push(`  - js importers: ${pair.importers.js.length}`);
    mdLines.push(`  - ts importers: ${pair.importers.ts.length}`);
  }

  await fs.writeFile(path.join(reportDir, 'twin_report.md'), `${mdLines.join('\n')}\n`);

  await fs.writeFile(path.join(patchDir, 'import-rewrites.diff'), `${Array.from(new Set(importRewritePatches)).join('\n')}\n`);
  await fs.writeFile(path.join(patchDir, 'entrypoints.diff'), `${Array.from(new Set(entrypointPatches)).join('\n')}\n`);

  const tsconfigDiffContent = [
    '# TSConfig suggestions (manual patch list)',
    '',
    ...tsconfigSuggestions.flatMap((item) => [
      `## ${item.file}`,
      ...item.suggestions.map((suggestion) => `- ${suggestion}`),
      ''
    ])
  ].join('\n');

  await fs.writeFile(path.join(patchDir, 'tsconfig.diff'), `${tsconfigDiffContent}\n`);
  await fs.writeFile(path.join(patchDir, 'delete_candidates.txt'), `${deleteCandidates.join('\n')}\n`);

  console.log(`Generated ${path.join('reports', 'ts-source-audit', 'twin_report.json')}`);
  console.log(`Generated ${path.join('reports', 'ts-source-audit', 'twin_report.md')}`);
  console.log(`Generated ${path.join('patches', 'import-rewrites.diff')}`);
  console.log(`Generated ${path.join('patches', 'entrypoints.diff')}`);
  console.log(`Generated ${path.join('patches', 'tsconfig.diff')}`);
  console.log(`Generated ${path.join('patches', 'delete_candidates.txt')}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
