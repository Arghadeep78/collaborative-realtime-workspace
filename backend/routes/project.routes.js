import express from 'express';
import {
  createProject,
  getAllUserProjects,
  getProjectById,
  deleteProject,
  shareProject,
  unshareProject,
  createShareToken,
  updateProjectTitle,
  updateProjectThumbnail,
  toggleFavorite,
  leaveProject,
} from '../controllers/project.controller.js';
import authMiddleware from '../middleware/auth.middleware.js';

const router = express.Router();

router.post('/create',          authMiddleware, createProject);
router.get('/list',             authMiddleware, getAllUserProjects);
router.delete('/delete/:id',    authMiddleware, deleteProject);
router.put('/share/:id',        authMiddleware, shareProject);
router.put('/unshare/:id',      authMiddleware, unshareProject);
router.post('/share-token/:id', authMiddleware, createShareToken);
router.put('/title/:id',        authMiddleware, updateProjectTitle);
router.put('/thumbnail/:id',    authMiddleware, updateProjectThumbnail);
router.put('/favorite/:id',     authMiddleware, toggleFavorite);
router.delete('/leave/:id',     authMiddleware, leaveProject);
router.get('/:id',              getProjectById);           // ← intentionally public (isPublic check); must be last

export default router;
