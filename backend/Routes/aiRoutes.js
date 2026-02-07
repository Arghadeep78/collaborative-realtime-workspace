import express from 'express';
import authMiddleware from '../middleware/AuthenticationMIddleware.js';
import { expandIdea, generateIdeas, summarizeBoard } from '../Controllers/AiWhiteboardControllers.js';

const router = express.Router();

router.post('/expand',         authMiddleware, express.json(), expandIdea);
router.post('/generate-ideas', authMiddleware, express.json(), generateIdeas);
router.post('/summarize',      authMiddleware, express.json(), summarizeBoard);

export default router;
