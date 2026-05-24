import express from 'express';
import {
  createWorkspace,
  listWorkspaces,
  renameWorkspace,
  deleteWorkspace,
  addBoardToWorkspace,
  removeBoardFromWorkspace,
  getOrCreateDefaultWorkspace,
} from '../Controllers/WorkspaceController.js';
import authMiddleware from '../middleware/AuthenticationMIddleware.js';

const router = express.Router();

router.post('/create',                         authMiddleware, createWorkspace);
router.get('/list',                            authMiddleware, listWorkspaces);
router.post('/default',                        authMiddleware, getOrCreateDefaultWorkspace);
router.put('/:id/rename',                      authMiddleware, renameWorkspace);
router.delete('/:id',                          authMiddleware, deleteWorkspace);
router.post('/:id/add-board',                  authMiddleware, addBoardToWorkspace);
router.delete('/:id/remove-board/:boardId',    authMiddleware, removeBoardFromWorkspace);

export default router;
