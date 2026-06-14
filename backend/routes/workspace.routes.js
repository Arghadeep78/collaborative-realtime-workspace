import express from 'express';
import {
  createWorkspace,
  listWorkspaces,
  renameWorkspace,
  deleteWorkspace,
  addProjectToWorkspace,
  removeProjectFromWorkspace,
  getOrCreateDefaultWorkspace,
  shareWorkspace,
  removeWorkspaceMember,
  leaveWorkspace,
  getWorkspaceManageData,
} from '../controllers/workspace.controller.js';
import authMiddleware from '../middleware/auth.middleware.js';
import { validate, fields } from '../middleware/validate.middleware.js';

const router = express.Router();

router.post('/create',                         authMiddleware, validate({ name: fields.name }), createWorkspace);
router.get('/list',                            authMiddleware, listWorkspaces);
router.post('/default',                        authMiddleware, getOrCreateDefaultWorkspace);
router.put('/:id/rename',                      authMiddleware, validate({ name: fields.name }), renameWorkspace);
router.delete('/:id',                          authMiddleware, deleteWorkspace);
router.get('/:id/manage',                      authMiddleware, getWorkspaceManageData);
router.post('/:id/share',                      authMiddleware, validate({ email: fields.email }), shareWorkspace);
router.delete('/:id/members/:email',           authMiddleware, removeWorkspaceMember);
router.delete('/:id/leave',                    authMiddleware, leaveWorkspace);
router.post('/:id/add-project',                authMiddleware, validate({ projectId: fields.projectId }), addProjectToWorkspace);
router.delete('/:id/remove-project/:projectId', authMiddleware, removeProjectFromWorkspace);

export default router;
