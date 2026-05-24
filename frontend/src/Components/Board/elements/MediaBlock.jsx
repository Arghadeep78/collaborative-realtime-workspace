import { useRef, useState } from 'react';
import { uploadMedia } from '../uploadMedia.js';

const ACCEPT = 'image/*,video/*,audio/*';

function UploadZone({ onFile, uploading }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onFile(file);
  };

  return (
    <div
      className={`flex flex-col items-center justify-center h-full w-full gap-4 rounded-2xl border-2 border-dashed transition-colors cursor-pointer select-none px-6 py-6
        ${dragging ? 'border-blue-400 bg-blue-50/60 dark:bg-blue-950/30' : 'border-slate-200 dark:border-slate-600 bg-slate-50/60 dark:bg-slate-800/60 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50/40 dark:hover:bg-blue-950/20'}`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }}
      />
      {uploading ? (
        <>
          <div className="w-10 h-10 rounded-full border-2.5 border-blue-400 border-t-transparent animate-spin" />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Uploading…</p>
        </>
      ) : (
        <>
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-100 to-blue-100 dark:from-violet-900/40 dark:to-blue-900/40 flex items-center justify-center shadow-md">
            <svg className="w-10 h-10 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <div className="text-center px-4">
            <p className="text-2xl font-semibold text-slate-800 dark:text-slate-100">Drop media here</p>
            <p className="text-base text-slate-500 dark:text-slate-400 mt-1">Image · Video · Audio</p>
          </div>
          <div className="flex items-center gap-3">
            {['IMG', 'VID', 'AUD'].map((tag) => (
              <span key={tag} className="text-sm font-semibold tracking-widest px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 uppercase">{tag}</span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function MediaDisplay({ url, mediaType, caption, editable, onCaption, onReplace, onShare }) {
  return (
    <div className="flex flex-col h-full w-full gap-0 overflow-hidden rounded-2xl relative border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0f1112] shadow-sm">
      <div className="absolute top-3 right-3 z-30 flex items-center gap-2">
        {onShare && (
          <button
            onClick={(e) => { e.stopPropagation(); onShare(); }}
            title="Share"
            className="w-8 h-8 rounded-md bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
          </button>
        )}
        {onReplace && (
          <button
            onClick={(e) => { e.stopPropagation(); onReplace(); }}
            title="Remove media"
            className="w-8 h-8 rounded-full bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center shadow-lg transition"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0 relative bg-black/5 dark:bg-white/5 overflow-hidden rounded-t-2xl">
        {mediaType === 'image' && (
          <img
            src={url}
            alt={caption || ''}
            className="w-full h-full object-contain"
            draggable={false}
          />
        )}
        {mediaType === 'video' && (
          <video
            src={url}
            controls
            className="w-full h-full object-contain"
            preload="metadata"
          />
        )}
        {mediaType === 'audio' && (
          <div className="flex flex-col items-center justify-center h-full gap-4 px-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-400 to-blue-500 flex items-center justify-center shadow-lg">
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 3v10.55A4 4 0 1014 17V7h4V3h-6z" />
              </svg>
            </div>
            <audio src={url} controls className="w-full max-w-xs" preload="metadata" />
          </div>
        )}
      </div>
      {/* Caption bar */}
      <div className="shrink-0 px-3 py-2 bg-white/90 dark:bg-slate-800/90 border-t border-slate-100 dark:border-slate-700 rounded-b-lg">
        {editable ? (
          <input
            value={caption || ''}
            onChange={(e) => onCaption(e.target.value)}
            placeholder="Add a caption…"
            onPointerDown={(e) => e.stopPropagation()}
            className="w-full text-lg font-bold text-slate-900 dark:text-slate-100 bg-transparent focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-500 leading-tight text-center"
          />
        ) : (
          caption ? (
            <p className="text-lg font-bold text-slate-900 dark:text-slate-100 truncate leading-tight text-center">{caption}</p>
          ) : (
            <p className="text-lg font-bold text-slate-400 leading-tight text-center">YOUR NAME</p>
          )
        )}
      </div>
    </div>
  );
}

export default function MediaBlock({ element, editable, onEditProps }) {
  const { url = '', mediaType = 'image', caption = '' } = element.props || {};
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file) => {
    if (!editable) return;
    setUploading(true);
    try {
      const result = await uploadMedia(file);
      if (result) onEditProps({ url: result.url, mediaType: result.mediaType, caption });
    } finally {
      setUploading(false);
    }
  };

  const handleCaption = (val) => onEditProps({ url, mediaType, caption: val });

  const handleReplace = () => {
    if (!editable) return;
    onEditProps({ url: '', mediaType: 'image', caption: '' });
  };

  if (!url) {
    return (
      <div className="w-full h-full p-2">
        <UploadZone onFile={handleFile} uploading={uploading} />
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <MediaDisplay url={url} mediaType={mediaType} caption={caption} editable={editable} onCaption={handleCaption} onReplace={editable ? handleReplace : undefined} onShare={async () => { try { await navigator.clipboard.writeText(url); alert('Media link copied to clipboard'); } catch { alert('Could not copy link'); } }} />
    </div>
  );
}
