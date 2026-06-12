import { useState, useEffect, useRef } from 'react';
import { XIcon, CheckIcon, ImageIcon } from '../common/icons.jsx';
import { CUTE_THUMBNAILS } from '../../pages/dashboard/dashboardConstants.js';

export default function ThumbnailPicker({ currentThumbnail, onSelect, onClose }) {
  const [draftThumbnail, setDraftThumbnail] = useState(currentThumbnail || null);
  const [customUrl, setCustomUrl] = useState('');
  const fileRef = useRef(null);

  useEffect(() => {
    setDraftThumbnail(currentThumbnail || null);
    setCustomUrl('');
  }, [currentThumbnail]);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setDraftThumbnail(ev.target.result);
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative bg-surface border border-edge rounded-2xl shadow-2xl w-full max-w-md p-6 rb-anim-pop" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-content font-semibold text-base">Change cover</h2>
          <button onClick={onClose} className="p-1.5 rounded-md text-content-muted hover:text-content hover:bg-hover transition-colors"><XIcon /></button>
        </div>
        <div className="grid grid-cols-4 gap-2 mb-5">
          {CUTE_THUMBNAILS.map((url, i) => {
            const active = draftThumbnail === url;
            return (
              <button key={i} onClick={() => setDraftThumbnail(url)}
                className="relative h-14 rounded-lg overflow-hidden ring-2 transition-all hover:ring-edge-strong focus:outline-none"
                style={{ outline: active ? '2px solid #6366f1' : '2px solid transparent', outlineOffset: '2px' }}>
                <img src={url} alt="" className="w-full h-full object-cover" />
                {active && <div className="absolute inset-0 flex items-center justify-center bg-black/20 text-white"><CheckIcon /></div>}
              </button>
            );
          })}
        </div>
        {draftThumbnail && (
          <button onClick={() => setDraftThumbnail(null)}
            className="w-full mb-4 py-2 text-sm text-content-muted hover:text-content border border-edge hover:border-edge-strong rounded-lg transition-colors">
            Remove cover
          </button>
        )}
        <p className="text-content-subtle text-xs font-medium uppercase tracking-widest mb-3">Custom image</p>
        <div className="flex gap-2 mb-3">
          <input value={customUrl} onChange={e => setCustomUrl(e.target.value)} placeholder="Paste image URL..."
            className="flex-1 bg-muted text-content text-sm px-3 py-2 rounded-lg border border-edge outline-none focus:border-indigo-500 placeholder:text-content-subtle transition-colors" />
          <button onClick={() => { if (customUrl.trim()) { setDraftThumbnail(customUrl.trim()); setCustomUrl(''); } }}
            disabled={!customUrl.trim()}
            className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg disabled:opacity-30 hover:bg-indigo-700 transition-colors">
            Apply
          </button>
        </div>
        <button onClick={() => fileRef.current?.click()}
          className="w-full py-2.5 flex items-center justify-center gap-2 text-sm text-content-muted hover:text-content border border-dashed border-edge-strong hover:border-edge-strong rounded-lg transition-colors">
          <ImageIcon /> Upload from device
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        <div className="mt-5 flex items-center gap-2">
          <button onClick={onClose}
            className="flex-1 py-2.5 text-sm font-medium text-content-muted hover:text-content border border-edge hover:border-edge-strong rounded-lg transition-colors">
            Cancel
          </button>
          <button onClick={() => onSelect(draftThumbnail)} disabled={draftThumbnail === currentThumbnail}
            className="flex-1 py-2.5 text-sm font-medium bg-indigo-600 text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-indigo-700 transition-colors">
            Apply cover
          </button>
        </div>
      </div>
    </div>
  );
}
