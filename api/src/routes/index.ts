import { Router } from 'express';
import userRoutes from './users';
import serverRoutes from './servers';
import channelRoutes from './channels';

const router = Router();

router.use('/users', userRoutes);
router.use('/servers', serverRoutes);
router.use('/channels', channelRoutes);

export default router;
