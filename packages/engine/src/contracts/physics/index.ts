// TODO: Physics contract package not yet created.
// Once coltens world/packages/physics-contract is set up with proper exports,
// update this import to reference the correct package path.
// // TODO: Import from @world-engine/physics-contract when available
// export * from "@world-engine/physics-contract";

// Placeholder physics contract types
export type PhysicsBody = any;
export type PhysicsWorld = any;
export interface PhysicsContract {
  world: PhysicsWorld;
  bodies: Map<string, PhysicsBody>;
}
