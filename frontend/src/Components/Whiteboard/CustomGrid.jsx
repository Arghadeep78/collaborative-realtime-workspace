import { track, useEditor } from '@tldraw/tldraw';

const CustomGrid = track(() => {
  const editor = useEditor();
  const cam = editor.getCamera();

  const gridSize = 40 * cam.z;
  const offsetX = cam.x * cam.z;
  const offsetY = cam.y * cam.z;

  return (
    <svg className="tl-grid" version="1.1" xmlns="http://www.w3.org/2000/svg" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
      <defs>
        <pattern id="grid-pattern" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse" patternTransform={`translate(${offsetX}, ${offsetY})`}>
          <path d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`} fill="none" stroke="rgba(0,0,0,0.12)" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid-pattern)" />
    </svg>
  );
});

export default CustomGrid;
