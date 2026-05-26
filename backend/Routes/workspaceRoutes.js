import express from 'express';
import {
  createWorkspace,
  listWorkspaces,
  renameWorkspace,
  deleteWorkspace,
  addBoardToWorkspace,
  removeBoardFromWorkspace,
  getOrCreateDefaultWorkspace,
  shareWorkspace,
  removeWorkspaceMember,
  leaveWorkspace,
  getWorkspaceManageData,
} from '../Controllers/WorkspaceController.js';
import authMiddleware from '../middleware/AuthenticationMIddleware.js';

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
router.post('/:id/add-board',                  authMiddleware, addBoardToWorkspace);
router.delete('/:id/remove-board/:boardId',    authMiddleware, removeBoardFromWorkspace);

export default router;
