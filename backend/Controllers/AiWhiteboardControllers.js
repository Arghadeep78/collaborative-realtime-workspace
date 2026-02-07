import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import Whiteboard from '../models/whiteboardModel.js';

dotenv.config();
const ai = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

const generateAIContent = async (prompt) => {
  let raw = '';
  try {
    const resp = await ai.models.generateContent({ model: 'gemini-2.0-flash', contents: prompt });
    raw = resp.text.trim();
    if (raw.startsWith('```')) raw = raw.replace(/^```(?:json)?\s*|```$/g, '').trim();
    return JSON.parse(raw);
  } catch (e) {
    console.error('Gemini parse error:', e, '\nRaw:', raw);
    throw new Error('AI returned invalid JSON');
  }
};

// POST /ai/expand  — Body: { text: string }  — Response: { ideas: [string, string, string] }
export const expandIdea = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'No text provided' });
    const result = await generateAIContent(
      `You are a brainstorming assistant. A sticky note says: "${text}".
       Generate exactly 3 concise related ideas (1-2 sentences each) expanding on this.
       Return ONLY minified JSON: {"ideas":["<idea1>","<idea2>","<idea3>"]}`
    );
    return res.status(200).json({ ideas: result.ideas ?? [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to expand idea' });
  }
};

// POST /ai/generate-ideas  — Body: { topic: string, count: number }  — Response: { ideas: string[] }
export const generateIdeas = async (req, res) => {
  try {
    const { topic, count = 5 } = req.body;
    if (!topic) return res.status(400).json({ error: 'No topic provided' });
    const n = Math.min(Math.max(parseInt(count) || 5, 1), 10);
    const result = await generateAIContent(
      `Generate exactly ${n} diverse brainstorming ideas on: "${topic}".
       Each idea: 1-2 sentences, suitable for a whiteboard sticky note.
       Return ONLY minified JSON: {"ideas":["<idea1>",...]}`
    );
    return res.status(200).json({ ideas: result.ideas ?? [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate ideas' });
  }
};

// POST /ai/summarize  — Body: { boardId: string, notes: string[] }  — Response: { themes: string[], summary: string }
export const summarizeBoard = async (req, res) => {
  try {
    const { boardId, notes } = req.body;
    if (!boardId) return res.status(400).json({ error: 'No boardId provided' });
    const board = await Whiteboard.findOne({ id: boardId }).select('title').lean();
    if (!board) return res.status(404).json({ error: 'Board not found' });
    const notesText = Array.isArray(notes) && notes.length ? notes.join('\n- ') : '(no notes)';
    const result = await generateAIContent(
      `Whiteboard titled "${board.title}" contains:\n- ${notesText}
       Identify 3-5 key themes and write a 2-3 sentence summary.
       Return ONLY minified JSON: {"themes":["<t1>",...],\"summary\":\"<text>\"}`
    );
    return res.status(200).json({ themes: result.themes ?? [], summary: result.summary ?? '' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to summarize board' });
  }
};
