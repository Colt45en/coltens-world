/**
 * Routes Registration
 *
 * Note: wsBus.ts and busReplay.ts integrate with the raw HTTP/WS server in index.ts,
 * not Fastify. They export handler functions for use in request handlers.
 *
 * See: apps/nucleus/src/index.ts for integration
 */
import { handleBusReplayRequest } from "./busReplay";
import { setupBusHttpUpgradeHandler } from "./wsBus";
export { handleBusReplayRequest, setupBusHttpUpgradeHandler };
