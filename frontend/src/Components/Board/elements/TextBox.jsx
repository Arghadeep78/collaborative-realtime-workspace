import { useEffect, useRef } from 'react';
import { TextFormatToolbar } from './SharedUI';

export default function TextBox({ element, editable, editing, selected, onEditProps, getScale }) {
  const { props } = element;
  const fontSize = props.fontSize || props.size || 34;
  const bold = !!props.bold;
  const italic = !!props.italic;
  const textColor = props.textColor || '#1e293b';
  const textAlign = props.textAlign || 'left';
  const taRef = useRef(null);

  useEffect(() => {
    if (editing && taRef.current) {
      taRef.current.focus();
      const len = taRef.current.value.length;
      taRef.current.setSelectionRange(len, len);
    }
  }, [editing]);

  const scale = getScale?.() || 1;

  const textStyle = {
    fontSize,
    color: textColor,
    fontWeight: bold ? 700 : 600,
    fontStyle: italic ? 'italic' : 'normal',
    textAlign,
  };

  return (
    <div className="relative w-full h-full">
      {/* Text format toolbar — shows while editing or selected */}
      {(editing || selected) && editable && (
        <TextFormatToolbar
          onEditProps={onEditProps}
          fontSize={fontSize}
          bold={bold}
          italic={italic}
          textAlign={textAlign}
          textColor={textColor}
          scale={scale}
        />
      )}

      {editing ? (
        <textarea
          ref={taRef}
          value={props.text}
          onChange={(e) => onEditProps({ text: e.target.value })}
          onPointerDown={(e) => e.stopPropagation()}
          className="w-full h-full bg-transparent resize-none outline-none placeholder:text-slate-400 leading-tight"
          style={textStyle}
          placeholder="Add text…"
        />
      ) : (
        <div
          className="w-full h-full whitespace-pre-wrap break-words leading-tight overflow-hidden"
          style={textStyle}
        >
          {props.text || <span className="text-slate-400 font-normal" style={{ fontSize, fontStyle: 'normal' }}>Text</span>}
        </div>
      )}
    </div>
  );
}
