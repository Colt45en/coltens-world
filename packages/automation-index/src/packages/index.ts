/**
 * World Engine Packages Index
 *
 * Organized exports for all core packages in the monorepo.
 * Provides a clean API for package integration and discovery.
 */

// Package metadata
export const PACKAGES = {
  protocol: "@world-engine/protocol",
  bus: "@world-engine/bus",
  util: "@world-engine/util",
  math: "@world-engine/math",
  assets: "@world-engine/assets",
  contracts: "@world-engine/contracts",
  nucleusContracts: "@world-engine/nucleus-contracts",
  nexusContracts: "@world-engine/nexus-contracts",
  ledgerContracts: "@world-engine/ledger-contracts",
  avatarCompiler: "@world-engine/avatar-compiler",
} as const;

export type PackageName = keyof typeof PACKAGES;
