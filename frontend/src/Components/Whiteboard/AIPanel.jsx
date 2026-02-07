import { useState, useRef } from 'react';
import { BACKEND_URL } from '../../constants/apiConfig.js';

/**
 * @param {{ editor: import('@tldraw/tldraw').Editor|null, boardId: string, onClose: () => void }} props
 */
export default function AIPanel({ editor, boardId, onClose }) {
  const [topic, setTopic]     = useState('');
  const [count, setCount]     = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [ideas, setIdeas]     = useState([]);
  const inputRef              = useRef(null);

  const getToken = () => localStorage.getItem('token');

  const insertStickyNotes = (ideas) => {
    if (!editor || !Array.isArray(ideas)) return;
    // Place new sticky notes in a cluster near the current viewport center
    const center = editor.getViewportPageCenter();
    ideas.forEach((text, i) => {
      editor.createShape({
        type: 'note',
        x: center.x + (i % 3) * 220 - 220,
        y: center.y + Math.floor(i / 3) * 220,
        props: { text, color: ['yellow', 'blue', 'green', 'pink', 'orange'][i % 5] },
      });
    });
  };

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    setLoading(true); setError('');
    try {
      const res = await fetch(`${BACKEND_URL}/ai/generate-ideas`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, count }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setIdeas(data.ideas);
      setTopic('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExpandSelected = async () => {
    if (!editor) return;
    const selected = editor.getSelectedShapes().filter(s => s.type === 'note');
    if (!selected.length) { setError('Select a sticky note first'); return; }
    const text = selected[0].props?.text || '';
    setLoading(true); setError('');
    try {
      const res = await fetch(`${BACKEND_URL}/ai/expand`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${getToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setIdeas(data.ideas);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const surfaceClass = "bg-white/90 border border-slate-200/80 shadow-[0_16px_40px_rgba(12,18,36,0.12)] backdrop-blur-xl";
  const inputClass = "w-full bg-slate-50/90 border border-slate-900/10 rounded-xl px-3 py-2 text-slate-900 text-sm placeholder-gray-400 focus:outline-none focus:border-blue-500/70 focus:ring-4 focus:ring-blue-500/15 transition";
  const inputCompactClass = "w-16 bg-slate-50/90 border border-slate-900/10 rounded-lg px-2 py-1.5 text-sm text-slate-900 focus:outline-none focus:border-blue-500/70 focus:ring-4 focus:ring-blue-500/15 transition";
  const primaryBtnClass = "w-full py-2.5 bg-gradient-to-br from-[#4262ff] to-[#2f49e7] text-white border border-blue-400/40 shadow-[0_12px_28px_rgba(66,98,255,0.28)] hover:brightness-95 hover:-translate-y-0.5 transition disabled:opacity-60 disabled:cursor-not-allowed text-sm font-medium rounded-xl";
  const secondaryBtnClass = "w-full py-2.5 bg-white text-slate-900 border border-slate-900/10 shadow-[0_10px_20px_rgba(12,18,36,0.08)] hover:bg-slate-50 hover:-translate-y-0.5 transition disabled:opacity-60 disabled:cursor-not-allowed text-sm font-medium rounded-xl";

  return (
    <div className={`absolute top-16 right-0 sm:right-6 z-20 w-full sm:w-80 rounded-3xl p-5 flex flex-col gap-4 ${surfaceClass}`}>
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-emerald-500">✨ AI Assistant</h3>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-lg leading-none">×</button>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-gray-600 text-xs font-medium">Topic or idea</label>
        <input
          ref={inputRef}
          value={topic}
          onChange={e => setTopic(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleGenerate()}
          placeholder="e.g. Remote team onboarding..."
          className={inputClass}
        />
        <div className="flex items-center gap-2 mt-1">
          <label className="text-gray-600 text-xs font-medium">Count:</label>
          <input
            type="number" min={1} max={10} value={count}
            onChange={e => setCount(Number(e.target.value))}
            className={inputCompactClass}
          />
        </div>
      </div>

      <button
        onClick={handleGenerate}
        disabled={loading || !topic.trim()}
        className={primaryBtnClass}
      >
        {loading ? 'Generating…' : 'Generate Ideas'}
      </button>

      <button
        onClick={handleExpandSelected}
        disabled={loading}
        className={secondaryBtnClass}
      >
        Expand Selected Note
      </button>

      {ideas.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t border-gray-200 pt-3">
          <div className="flex items-center justify-between">
            <p className="text-gray-600 text-xs font-medium">Generated ideas</p>
            <button
              onClick={() => { insertStickyNotes(ideas); setIdeas([]); }}
              className="text-blue-600 hover:text-blue-700 text-xs font-medium transition-colors"
            >
              Add all to board →
            </button>
          </div>
          {ideas.map((idea, i) => (
            <div
              key={i}
              className="bg-white/90 rounded-xl p-2 text-gray-800 text-sm leading-relaxed border border-gray-200/80 shadow-sm hover:border-blue-400/70 cursor-pointer transition-colors"
              onClick={() => { insertStickyNotes([idea]); setIdeas(ideas.filter((_, j) => j !== i)); }}
            >
              {idea}
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-red-400 text-xs">{error}</p>}

      <p className="text-gray-500 text-xs">Ideas are inserted as sticky notes at the viewport center.</p>
    </div>
  );
}
