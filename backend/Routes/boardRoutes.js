import express from 'express';
import {
  createBoard,
  getAllUserBoards,
  getBoardById,
  deleteBoard,
  shareBoard,
  unshareBoard,
  updateBoardTitle,
} from '../Controllers/BoardController.js';
import authMiddleware from '../middleware/AuthenticationMIddleware.js';

const router = express.Router();

router.post('/create',          authMiddleware, createBoard);
router.get('/list',             authMiddleware, getAllUserBoards);
router.get('/:id',              getBoardById);           // ← intentionally public (isPublic check)
router.delete('/delete/:id',    authMiddleware, deleteBoard);
router.put('/share/:id',        authMiddleware, shareBoard);
router.put('/unshare/:id',      authMiddleware, unshareBoard);
router.put('/title/:id',        authMiddleware, updateBoardTitle);

export default router;
