import { useEffect, useRef, useState } from 'react';

/**
 * Recognise the source platform from a URL and normalise it to an embeddable
 * form (e.g. a YouTube watch link → its /embed/ URL). Returns the platform
 * label plus the src to load.
 */
function resolveEmbed(raw) {
  const url = (raw || '').trim();
  if (!url) return { platform: null, src: '' };
  let host = '';
  try {
    host = new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '');
  } catch {
    return { platform: 'Web', src: '' };
  }

  // YouTube → embed
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/);
  if (yt) return { platform: 'YouTube', src: `https://www.youtube.com/embed/${yt[1]}` };

  if (host.endsWith('figma.com')) {
    return { platform: 'Figma', src: `https://www.figma.com/embed?embed_host=board&url=${encodeURIComponent(url)}` };
  }
  if (host.endsWith('docs.google.com')) return { platform: 'Docs', src: url };
  if (host.endsWith('loom.com')) return { platform: 'Loom', src: url.replace('/share/', '/embed/') };

  return { platform: 'Web', src: url.startsWith('http') ? url : `https://${url}` };
}

function PlatformIcon({ platform }) {
  const c = { className: 'w-3.5 h-3.5', fill: 'none', viewBox: '0 0 24 24', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
  switch (platform) {
    case 'YouTube':
      return <svg {...c}><path d="M22 8.5a3 3 0 0 0-2.1-2.1C18 6 12 6 12 6s-6 0-7.9.4A3 3 0 0 0 2 8.5 31 31 0 0 0 1.7 12 31 31 0 0 0 2 15.5a3 3 0 0 0 2.1 2.1C6 18 12 18 12 18s6 0 7.9-.4a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .3-3.5 31 31 0 0 0-.3-3.5z" /><path d="M10 9.5l5 2.5-5 2.5z" /></svg>;
    case 'Figma':
      return <svg {...c}><circle cx="12" cy="12" r="3" /><path d="M9 5h3v14M15 5a3 3 0 0 1 0 6H9a3 3 0 0 1 0-6" /></svg>;
    case 'Docs':
      return <svg {...c}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M8 13h8M8 17h8M8 9h2" /></svg>;
    default:
      return <svg {...c}><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20" /></svg>;
  }
}

/**
 * Bordered window for embedding external assets/research. A platform-labelled
 * header sits above a sandboxed live frame. When the URL is empty (or while
 * editing) it shows a URL input instead of the frame.
 */
export default function IframeWindow({ element, editable, editing, selected, onEditProps }) {
  const { props } = element;
  const { platform, src } = resolveEmbed(props.url);
  const [draft, setDraft] = useState(props.url || '');
  const inputRef = useRef(null);

  useEffect(() => setDraft(props.url || ''), [props.url]);
  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus(); }, [editing]);

  const showInput = editing || !src;

  return (
    <div className="w-full h-full rounded-xl bg-white dark:bg-slate-100 border border-slate-300 shadow-[0_8px_24px_rgba(15,23,42,0.14)] flex flex-col overflow-hidden">
      {/* Title bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-200 bg-slate-50">
        <span className="flex items-center gap-1.5 text-slate-500">
          <PlatformIcon platform={platform} />
        </span>
        <span className="text-xs font-semibold text-slate-700 truncate flex-1">
          {props.title || platform || 'Embed'}
        </span>
        {src && (
          <a
            href={src}
            target="_blank"
            rel="noreferrer"
            onPointerDown={(e) => e.stopPropagation()}
            className="text-slate-400 hover:text-slate-700 shrink-0"
            title="Open in new tab"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" /></svg>
          </a>
        )}
      </div>

      {/* Body */}
      {showInput ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 p-4 text-center" onPointerDown={(e) => e.stopPropagation()}>
          <svg className="w-7 h-7 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" /></svg>
          {editable ? (
            <>
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => onEditProps({ url: draft.trim() })}
                onKeyDown={(e) => e.key === 'Enter' && onEditProps({ url: draft.trim() })}
                placeholder="Paste a YouTube / Figma / Docs link…"
                className="w-full max-w-[20rem] text-sm bg-slate-100 rounded-lg px-3 py-2 outline-none text-slate-800 placeholder:text-slate-400"
              />
              <p className="text-[11px] text-slate-400">Press Enter to embed</p>
            </>
          ) : (
            <p className="text-sm text-slate-400">No embed set</p>
          )}
        </div>
      ) : (
        <div className="flex-1 relative bg-slate-100">
          <iframe
            src={src}
            title={props.title || platform || 'embed'}
            className="absolute inset-0 w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-presentation"
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            loading="lazy"
          />
        </div>
      )}
    </div>
  );
}
