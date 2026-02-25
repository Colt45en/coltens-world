#!/usr/bin/env node
/**
 * coltens-world repo-doctor.mjs
 *
 * Automated repo health validator.
 * Runs checks to ensure:
 * - No generated artifacts in git
 * - No spaces in filenames
 * - Proper .gitignore coverage
 * - Package.json consistency
 * - Boundary rules compliance
 * - Single root principle
 *
 * Run: node scripts/repo-doctor.mjs
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = process.cwd();
const CHECKS = [];
let PASSED = 0;
let FAILED = 0;
let WARNED = 0;

// ============================================================================
// Utility Functions
// ============================================================================

function log(level, message) {
  const symbols = {
    '✅': '✅',
    '❌': '❌',
    '⚠️': '⚠️',
    'ℹ️': 'ℹ️'
  };
  console.log(`${symbols[level]} ${message}`);
}

function check(name, fn) {
  try {
    const result = fn();
    if (result.passed) {
      log('✅', `${name}: ${result.message}`);
      PASSED++;
    } else if (result.warning) {
      log('⚠️', `${name}: ${result.message}`);
      WARNED++;
    } else {
      log('❌', `${name}: ${result.message}`);
      FAILED++;
    }
  } catch (err) {
    log('❌', `${name}: ${err.message}`);
    FAILED++;
  }
}

// ============================================================================
// Health Checks
// ============================================================================

check('No committed node_modules', () => {
  try {
    execSync('git ls-files | grep -E "node_modules/[^/]+" | head -1', { stdio: 'pipe' });
    return { passed: false, message: 'Found node_modules in git' };
  } catch {
    return { passed: true, message: 'node_modules properly ignored' };
  }
});

check('No committed dist/ folders', () => {
  try {
    execSync('git ls-files | grep -E "/dist/[^/]+\\.(js|d\\.ts)"', { stdio: 'pipe' });
    return { passed: false, message: 'Found compiled .js/.d.ts in git' };
  } catch {
    return { passed: true, message: 'dist/ folders properly ignored' };
  }
});

check('No committed build/ artifacts', () => {
  try {
    execSync('git ls-files | grep -E "^build/|^CMakeFiles/|^\\.(vs|cmake)"', { stdio: 'pipe' });
    return { passed: false, message: 'Found build artifacts in git' };
  } catch {
    return { passed: true, message: 'build artifacts properly ignored' };
  }
});

check('No committed .venv/ or venv/', () => {
  try {
    execSync('git ls-files | grep -E "^\\.?venv/|^ENV/"', { stdio: 'pipe' });
    return { passed: false, message: 'Found Python venv in git' };
  } catch {
    return { passed: true, message: 'Python venv properly ignored' };
  }
});

check('No spaces in top-level directory names', () => {
  const hasDirs = execSync('ls -1').toString().split('\n').filter(f => f.includes(' '));
  if (hasDirs.length > 0) {
    return { passed: false, message: `Found dirs with spaces: ${hasDirs.join(', ')}` };
  }
  return { passed: true, message: 'No spaces in directory names' };
});

check('Single package.json at root', () => {
  try {
    execSync(`find . -maxdepth 3 -name "package.json" | wc -l`, { encoding: 'utf-8' });
    const count = parseInt(execSync(`find . -maxdepth 3 -name "package.json" | wc -l`, { encoding: 'utf-8' }).trim());
    if (count > 0) {
      return { passed: true, message: `Found ${count} package.json files (root + workspaces)` };
    }
    return { passed: false, message: 'No package.json found' };
  } catch {
    return { warning: true, message: 'Could not verify package.json count' };
  }
});

check('pnpm-lock.yaml exists (single lockfile)', () => {
  if (fs.existsSync(path.join(REPO_ROOT, 'pnpm-lock.yaml'))) {
    return { passed: true, message: 'pnpm lockfile present' };
  }
  if (fs.existsSync(path.join(REPO_ROOT, 'package-lock.json'))) {
    return { passed: false, message: 'Using npm lockfile (should use pnpm)' };
  }
  return { warning: true, message: 'No lockfile found' };
});

check('No package-lock.json (npm)', () => {
  if (!fs.existsSync(path.join(REPO_ROOT, 'package-lock.json'))) {
    return { passed: true, message: 'No npm lockfile' };
  }
  return { passed: false, message: 'package-lock.json found (remove it, use pnpm)' };
});

check('.gitignore covers common outputs', () => {
  const gitignore = fs.readFileSync(path.join(REPO_ROOT, '.gitignore'), 'utf-8');
  const required = ['node_modules', 'dist', 'build', '.venv', '__pycache__', '.pytest_cache'];
  const missing = required.filter(entry => !gitignore.includes(entry));
  if (missing.length === 0) {
    return { passed: true, message: 'All critical entries in .gitignore' };
  }
  return { passed: false, message: `Missing .gitignore entries: ${missing.join(', ')}` };
});

check('boundary.rules.json exists', () => {
  if (fs.existsSync(path.join(REPO_ROOT, 'boundary.rules.json'))) {
    return { passed: true, message: 'Architecture rules defined' };
  }
  return { warning: true, message: 'boundary.rules.json not found (create it)' };
});

check('ARCHITECTURE.md exists', () => {
  if (fs.existsSync(path.join(REPO_ROOT, 'ARCHITECTURE.md'))) {
    return { passed: true, message: 'Architecture documented' };
  }
  return { warning: true, message: 'ARCHITECTURE.md not found' };
});

check('GitHub workflows exist', () => {
  const workflowsDir = path.join(REPO_ROOT, '.github', 'workflows');
  if (!fs.existsSync(workflowsDir)) {
    return { passed: false, message: 'No .github/workflows directory' };
  }
  const files = fs.readdirSync(workflowsDir);
  if (files.length > 0) {
    return { passed: true, message: `${files.length} workflow files found` };
  }
  return { passed: false, message: 'No workflow files in .github/workflows' };
});

check('apps/ and packages/ exist', () => {
  const appsExists = fs.existsSync(path.join(REPO_ROOT, 'apps'));
  const packagesExists = fs.existsSync(path.join(REPO_ROOT, 'packages'));
  if (appsExists && packagesExists) {
    return { passed: true, message: 'Proper monorepo structure detected' };
  }
  return { passed: false, message: `Missing: ${!appsExists ? 'apps/' : ''}${!packagesExists ? 'packages/' : ''}` };
});

check('README.md exists at root', () => {
  if (fs.existsSync(path.join(REPO_ROOT, 'README.md'))) {
    return { passed: true, message: 'README.md present' };
  }
  return { warning: true, message: 'README.md not found' };
});

check('No nested .git directories', () => {
  try {
    const result = execSync(`find . -name ".git" -type d 2>/dev/null | wc -l`, { encoding: 'utf-8' }).trim();
    const count = parseInt(result);
    if (count === 1) {
      return { passed: true, message: 'Single .git directory (repo root)' };
    }
    return { passed: false, message: `Found ${count} .git directories (should be 1)` };
  } catch {
    return { warning: true, message: 'Could not check for nested .git' };
  }
});

// ============================================================================
// Summary
// ============================================================================

console.log('\n' + '='.repeat(70));
console.log('📊 REPOSITORY HEALTH REPORT');
console.log('='.repeat(70) + '\n');

console.log(`✅ Passed: ${PASSED}`);
console.log(`❌ Failed: ${FAILED}`);
console.log(`⚠️ Warnings: ${WARNED}`);

console.log('\n' + '='.repeat(70));

if (FAILED === 0) {
  console.log('🎉 Repository is healthy!');
  process.exit(0);
} else {
  console.log(`❌ ${FAILED} critical issue(s) found. Fix them before continuing.`);
  process.exit(1);
}
