/**
 * World Core Routes Index
 * All Nucleus endpoints for Mesh + Prefab + World contracts and operations
 */

import { Router } from 'express';
import meshRouter from './mesh';
import prefabRouter from './prefab';
import worldRouter from './world';

const router = Router();

// Mount all World Core routers
router.use(meshRouter);
router.use(prefabRouter);
router.use(worldRouter);

export default router;
