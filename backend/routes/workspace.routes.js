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

const router = express.Router();

router.post('/create',                         authMiddleware, createWorkspace);
router.get('/list',                            authMiddleware, listWorkspaces);
router.post('/default',                        authMiddleware, getOrCreateDefaultWorkspace);
router.put('/:id/rename',                      authMiddleware, renameWorkspace);
router.delete('/:id',                          authMiddleware, deleteWorkspace);
router.get('/:id/manage',                      authMiddleware, getWorkspaceManageData);
router.post('/:id/share',                      authMiddleware, shareWorkspace);
router.delete('/:id/members/:email',           authMiddleware, removeWorkspaceMember);
router.delete('/:id/leave',                    authMiddleware, leaveWorkspace);
router.post('/:id/add-project',                authMiddleware, addProjectToWorkspace);
router.delete('/:id/remove-project/:projectId', authMiddleware, removeProjectFromWorkspace);

export default router;
