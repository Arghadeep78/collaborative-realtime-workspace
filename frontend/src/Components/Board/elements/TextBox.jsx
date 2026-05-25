import { useEffect, useRef } from 'react';
import { TextFormatToolbar } from './SharedUI';
import { useTheme } from '../../../contexts/ThemeContext.jsx';
import { getThemeColor } from '../theme/themeUtils.js';

export default function TextBox({ element, editable, editing, selected, onEditProps, getScale }) {
  const { props } = element;
  const { isDark } = useTheme();
  const fontSize = props.fontSize || props.size || 34;
  const bold = !!props.bold;
  const italic = !!props.italic;
  const rawTextColor = props.textColor || '#1e293b';
  const textColor = getThemeColor(rawTextColor, isDark);
  const textAlign = props.textAlign || 'left';
  const taRef = useRef(null);
  const rootRef = useRef(null);

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
    <div ref={rootRef} className="relative w-full h-full">
      {/* Text format toolbar — rendered via portal to escape element stacking context */}
      {(editing || selected) && editable && (
        <TextFormatToolbar
          onEditProps={onEditProps}
          fontSize={fontSize}
          bold={bold}
          italic={italic}
          textAlign={textAlign}
          textColor={rawTextColor}
          scale={scale}
          elementY={element.y}
          anchorRef={rootRef}
        />
      )}

      {editing ? (
        <textarea
          ref={taRef}
          value={props.text}
          onChange={(e) => onEditProps({ text: e.target.value })}
          onPointerDown={(e) => e.stopPropagation()}
          className="w-full h-full bg-transparent resize-none outline-none placeholder:text-content-subtle leading-tight"
          style={textStyle}
          placeholder="Add text…"
        />
      ) : (
        <div
          className="w-full h-full whitespace-pre-wrap break-words leading-tight overflow-hidden text-content-container"
          style={textStyle}
        >
          {props.text || <span className="text-content-subtle font-normal" style={{ fontSize, fontStyle: 'normal' }}>Text</span>}
        </div>
      )}
    </div>
  );
}
