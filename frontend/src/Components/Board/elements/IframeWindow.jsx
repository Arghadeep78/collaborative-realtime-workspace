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

  // Automatically attempt to fetch the actual video/page title via noembed
  useEffect(() => {
    if (src && !props.title && editable && (platform === 'YouTube' || platform === 'Web')) {
      fetch(`https://noembed.com/embed?url=${encodeURIComponent(props.url)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.title && !data.error) {
            onEditProps({ title: data.title });
          }
        })
        .catch(() => {});
    }
  }, [src, props.url, props.title, editable, platform, onEditProps]);

  const showInput = editing || !src;

  return (
    <div className="w-full h-full rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200/50 dark:border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.12)] flex flex-col overflow-hidden transition-all group">
      {/* Title bar (macOS style) */}
      <div className="relative flex items-center px-3 py-2 bg-gradient-to-b from-white/60 to-white/30 dark:from-slate-800/60 dark:to-slate-800/30 border-b border-black/5 dark:border-white/5">
        {/* Title */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-1.5 opacity-70 group-hover:justify-start group-hover:opacity-100 transition-all duration-200 px-3 min-w-0">
          <PlatformIcon platform={platform} />
          <span className="text-xs sm:text-sm font-bold tracking-wider uppercase text-slate-600 dark:text-slate-300 truncate max-w-[calc(100%-7rem)]">
            {props.title || platform || 'Web Frame'}
          </span>
        </div>

        {/* Action (Open in new tab) */}
        {src && (
          <a
            href={src}
            target="_blank"
            rel="noreferrer"
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute right-2 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 dark:bg-slate-700/50 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-all shrink-0 flex items-center gap-1.5"
            title="Open in new tab"
          >
            Open <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
          </a>
        )}
      </div>

      {/* Body */}
      {showInput ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-800/30 dark:to-slate-900/50" onPointerDown={(e) => e.stopPropagation()}>
          <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-center text-blue-500 mb-1">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
          </div>
          {editable ? (
            <>
              <input
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => onEditProps({ url: draft.trim() })}
                onKeyDown={(e) => e.key === 'Enter' && onEditProps({ url: draft.trim() })}
                placeholder="Paste YouTube, Figma, or Web link..."
                className="w-full max-w-[20rem] text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-inner rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 transition-all"
              />
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">Press Enter to embed</p>
            </>
          ) : (
            <p className="text-sm font-medium text-slate-400">No embed set</p>
          )}
        </div>
      ) : (
        <div className="flex-1 relative bg-slate-100 dark:bg-slate-900">
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
