import express from 'express';
import {
  createBoard,
  getAllUserBoards,
  getBoardById,
  deleteBoard,
  shareBoard,
  unshareBoard,
  createShareToken,
  updateBoardTitle,
  updateBoardThumbnail,
  toggleFavorite,
} from '../Controllers/BoardController.js';
import authMiddleware from '../middleware/AuthenticationMIddleware.js';

const router = express.Router();

router.post('/create',          authMiddleware, createBoard);
router.get('/list',             authMiddleware, getAllUserBoards);
router.get('/:id',              getBoardById);           // ← intentionally public (isPublic check)
router.delete('/delete/:id',    authMiddleware, deleteBoard);
router.put('/share/:id',        authMiddleware, shareBoard);
router.put('/unshare/:id',      authMiddleware, unshareBoard);
router.post('/share-token/:id', authMiddleware, createShareToken);
router.put('/title/:id',        authMiddleware, updateBoardTitle);
router.put('/thumbnail/:id',    authMiddleware, updateBoardThumbnail);
router.put('/favorite/:id',     authMiddleware, toggleFavorite);

export default router;
