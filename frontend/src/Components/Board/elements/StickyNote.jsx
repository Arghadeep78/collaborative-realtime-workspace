import { useEffect, useRef } from 'react';
import { STICKY_COLORS } from '../boardConstants.js';
import { TextFormatToolbar } from './SharedUI.jsx';

export default function StickyNote({ element, editable, editing, selected, onEditProps, getScale }) {
  const { props } = element;
  const color = props.color || STICKY_COLORS[0];
  const bold = !!props.bold;
  const italic = !!props.italic;
  const textColor = props.textColor || '#1e293b';
  const autoSize = Math.max(20, Math.min(46, Math.round(element.w / 9)));
  const fontSize = props.fontSize || autoSize;

  const taRef = useRef(null);
  useEffect(() => {
    if (editing && taRef.current) {
      taRef.current.focus();
      const len = taRef.current.value.length;
      taRef.current.setSelectionRange(len, len);
    }
  }, [editing]);

  const scale = getScale?.() || 1;

  return (
    <div className="relative w-full h-full">
      {/* Text format toolbar — outside overflow-hidden so it's not clipped */}
      {(editing || selected) && editable && (
        <TextFormatToolbar
          onEditProps={onEditProps}
          fontSize={fontSize}
          bold={bold}
          italic={italic}
          textColor={textColor}
          scale={scale}
          elementY={element.y}
        />
      )}

      <div
        className={`w-full h-full rounded-xl flex flex-col p-5 relative transition-all duration-200 border overflow-hidden group ${
          selected && editable
            ? 'ring-2 ring-blue-400/40 shadow-[0_12px_40px_rgba(59,130,246,0.15)]'
            : 'border-black/5 dark:border-white/5 shadow-[0_8px_24px_rgba(0,0,0,0.12)]'
        }`}
        style={{ backgroundColor: color }}
      >
        {/* Paper texture overlay */}
        <div
          className="absolute inset-0 opacity-30 pointer-events-none rounded-xl"
          style={{
            backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22%3E%3Cfilter id=%22noise%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.9%22 numOctaves=%221%22 /%3E%3C/filter%3E%3Crect width=%22100%22 height=%22100%22 filter=%22url(%23noise)%22 opacity=%220.1%22/%3E%3C/svg%3E")',
            backgroundSize: '100px 100px',
          }}
        />

        {/* Tape Decoration removed */}

        {/* Main content */}
        {editing ? (
          <textarea
            ref={taRef}
            value={props.text}
            onChange={(e) => onEditProps({ text: e.target.value })}
            onPointerDown={(e) => e.stopPropagation()}
            className="flex-1 w-full bg-transparent resize-none outline-none placeholder:text-black/25 dark:placeholder:text-white/30 leading-snug z-10 pt-5 font-medium"
            style={{
              fontSize,
              color: textColor,
              fontWeight: bold ? 700 : 600,
              fontStyle: italic ? 'italic' : 'normal',
            }}
            placeholder="Type an idea…"
          />
        ) : (
          <div
            className={`flex-1 w-full whitespace-pre-wrap wrap-break-word leading-snug overflow-hidden z-10 font-medium transition-opacity ${!props.text ? 'opacity-40' : ''}`}
            style={{
              fontSize,
              color: textColor,
              fontWeight: bold ? 700 : 600,
              fontStyle: italic ? 'italic' : 'normal',
            }}
          >
            {props.text || 'Empty note'}
          </div>
        )}

        {/* Color picker - shown when editing */}
        {editing && editable && (
          <div
            className="mt-3 flex items-center gap-1.5 pt-2.5 border-t border-black/10 dark:border-white/10 z-20"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <span className="text-[10px] font-semibold text-black/50 dark:text-white/50 uppercase tracking-wide px-1">Color</span>
            {STICKY_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => onEditProps({ color: c })}
                className={`w-6 h-6 rounded-full border-2 transition-all shrink-0 hover:scale-110 active:scale-95 ${
                  c === color
                    ? 'ring-2 ring-black/40 dark:ring-white/60 ring-offset-1 scale-110 border-white/60 dark:border-white/40 shadow-md'
                    : 'border-white/30 dark:border-white/20 hover:border-white/50'
                }`}
                style={{ background: c }}
                title={`Color: ${c}`}
              />
            ))}
          </div>
        )}

        {/* Bottom right fold corner */}
        <div className="absolute bottom-0 right-0 w-7 h-7 pointer-events-none overflow-hidden rounded-tl-lg">
          <div className="absolute bottom-0 right-0 w-full h-full bg-linear-to-tl from-black/15 to-transparent" />
          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-white/20 rounded-full blur-sm" />
        </div>
      </div>
    </div>
  );
}
