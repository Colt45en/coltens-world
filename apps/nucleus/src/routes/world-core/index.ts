/**
 * World Core Routes Index
 * All Nucleus endpoints for Mesh + Prefab + World + Physics contracts and operations
 */

import { Router } from 'express';
import { chatRouter } from "./chat";
import meshRouter from './mesh';
import physicsRouter from "./physics";
import prefabRouter from './prefab';
import worldRouter from './world';

const router = Router();

// Mount all World Core routers
router.use(meshRouter);
router.use(prefabRouter);
router.use(worldRouter);
router.use(physicsRouter);
router.use(chatRouter);

export default router;
