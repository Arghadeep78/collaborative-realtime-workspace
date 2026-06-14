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
import { validate, fields, optional } from '../middleware/validate.middleware.js';

const router = express.Router();

router.post('/create',          authMiddleware, validate({ title: fields.title }), createProject);
router.get('/list',             authMiddleware, getAllUserProjects);
router.delete('/delete/:id',    authMiddleware, deleteProject);
router.put('/share/:id',        authMiddleware, validate({ email: fields.email, role: optional(fields.shareRole) }), shareProject);
router.put('/unshare/:id',      authMiddleware, validate({ email: fields.email }), unshareProject);
router.post('/share-token/:id', authMiddleware, createShareToken); // role validated inline in controller
router.put('/title/:id',        authMiddleware, validate({ title: fields.title }), updateProjectTitle);
router.put('/thumbnail/:id',    authMiddleware, updateProjectThumbnail);
router.put('/favorite/:id',     authMiddleware, toggleFavorite);
router.delete('/leave/:id',     authMiddleware, leaveProject);
router.get('/:id',              getProjectById);           // ← intentionally public (isPublic check); must be last

export default router;
