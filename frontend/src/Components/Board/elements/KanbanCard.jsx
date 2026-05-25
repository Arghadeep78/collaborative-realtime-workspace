import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { makeId } from '../boardConstants.js';
import { uploadImage } from '../uploadImage.js';
import { useTheme } from '../../../contexts/ThemeContext.jsx';
import { getThemeColor } from '../theme/themeUtils.js';
import {
  X, Check, Plus, Calendar, Image as ImageIcon, Tag,
  AlignLeft, Paperclip, CheckSquare, Clock, MoreHorizontal, ArrowRightLeft, Sparkles, MessageCircle, ChevronDown, MapPin, Circle
} from 'lucide-react';

// Trello-like list background colors mapping (light mode pastels → dark mode muted tones)
const LIST_COLORS = {
  '#4bce97': '#d3f1df', // pastel green
  '#f5cd47': '#fdf4c8', // pastel yellow
  '#fea362': '#fdedd8', // pastel orange
  '#f87168': '#ffdce0', // pastel red
  '#9f8fef': '#e8dffe', // pastel purple
  '#579dff': '#cce0ff', // pastel blue
};


const LABEL_COLORS = Object.keys(LIST_COLORS);

// Pastel bg → label color (for inline color picker swatches)
const BG_TO_LABEL = Object.fromEntries(Object.entries(LIST_COLORS).map(([k, v]) => [v, k]));
const PICKER_COLORS = [null, ...Object.values(LIST_COLORS)];
const AV_COLORS = ['#0b69ff', '#0a9d62', '#f5821f', '#7c4dff', '#e0457b', '#0bb4c4'];
const avatarColor = (s = '') => AV_COLORS[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % AV_COLORS.length];
const initialOf = (s = '') => (s.trim()[0] || '?').toUpperCase();
const stop = (e) => e.stopPropagation();

const Spinner = () => (
  <svg className="w-4 h-4 animate-spin text-content-subtle" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.25" />
    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

function Avatar({ name, size = 24 }) {
  if (!name) return null;
  return (
    <span
      title={name}
      className="inline-flex items-center justify-center rounded-full text-white font-bold shrink-0"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42), background: avatarColor(name) }}
    >
      {initialOf(name)}
    </span>
  );
}

function dueMeta(due) {
  if (!due) return null;
  const d = new Date(`${due}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((d - today) / 86400000);
  const label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  
  // List inline badge styling
  let badgeCls = 'bg-muted text-content-muted';
  if (days < 0) badgeCls = 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400';
  else if (days <= 1) badgeCls = 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400';
  
  return { label, badgeCls };
}

// ── Card Detail Modal ──────────────────────────────────────────────────────
function CardModal({ card, listTitle, onClose, onUpdate, members }) {
  const [desc, setDesc] = useState(card.description || '');
  const [uploading, setUploading] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showMemberPicker, setShowMemberPicker] = useState(false);
  const [showCoverPicker, setShowCoverPicker] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  
  const handleSaveDesc = () => { onUpdate({ description: desc }); };

  const handleUpload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(file);
      onUpdate({ images: [...(card.images || []), url] });
    } catch { /* ignore */ } finally { setUploading(false); }
  };

  const cLabels = card.labels || [];
  const cMembers = card.members || [];
  const cChecklist = card.checklist || [];
  const doneCount = cChecklist.filter(c => c.done).length;

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onPointerDown={stop}>
      <div className="bg-white dark:bg-[#22272b] w-full max-w-2xl max-h-full overflow-y-auto rounded-xl shadow-2xl flex flex-col relative" onClick={stop}>
        
        {card.coverColor && (
          <div className="w-full h-24 shrink-0 rounded-t-xl" style={{ backgroundColor: getThemeColor(card.coverColor, isDark) }} />
        )}

        <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-content-muted bg-black/5 dark:bg-white/5 transition z-10">
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="p-6 pb-2">
          <div className="flex items-center gap-1.5 px-2 py-1 bg-[#d3f1df] dark:bg-[#d3f1df]/10 text-teal-800 dark:text-teal-400 rounded w-max text-[18px] font-semibold mb-6">
            <span>{listTitle}</span>
            <ChevronDown className="w-4 h-4" />
          </div>
          
          <div className="flex items-start gap-3">
            <Circle className="w-6 h-6 mt-1 text-content-subtle shrink-0" />
            <input
              value={card.title}
              onChange={e => onUpdate({ title: e.target.value })}
              className="flex-1 bg-transparent text-[30px] font-bold text-[#172b4d] dark:text-[#b6c2cf] outline-none placeholder:text-content-subtle"
              placeholder="Card title..."
              data-gramm="false"
              data-gramm_editor="false"
              data-enable-grammarly="false"
              spellCheck={false}
            />
          </div>
        </div>

        {/* Action Buttons Row */}
        <div className="px-14 flex flex-wrap gap-2 mt-4">
          <div className="relative flex items-center justify-center">
             <div className="absolute left-3 pointer-events-none text-[#172b4d] dark:text-[#b6c2cf]">
               <Clock className="w-4 h-4" />
             </div>
             <input type="date" value={card.due || ''} onClick={e => { try { e.target.showPicker() } catch {} }} onChange={e => onUpdate({ due: e.target.value })} className="pl-9 pr-3 py-1.5 border border-edge hover:bg-hover rounded-lg text-[17px] font-semibold text-[#172b4d] dark:text-[#b6c2cf] transition outline-none bg-transparent" />
          </div>
          
          <button onClick={() => onUpdate({ checklist: [...cChecklist, { id: makeId('chk'), text: '', done: false }] })} className="flex items-center gap-1.5 border border-edge hover:bg-hover px-3 py-1.5 rounded-lg text-[17px] font-semibold text-[#172b4d] dark:text-[#b6c2cf] transition">
            <CheckSquare className="w-4 h-4" /> Checklist
          </button>
          
          <div className="relative">
            <button onClick={() => setShowMemberPicker(!showMemberPicker)} className="flex items-center gap-1.5 border border-edge hover:bg-hover px-3 py-1.5 rounded-lg text-[17px] font-semibold text-[#172b4d] dark:text-[#b6c2cf] transition">
              <Plus className="w-4 h-4" /> Members
            </button>
            {showMemberPicker && (
              <div className="absolute top-full left-0 mt-1 w-48 bg-surface border border-edge shadow-xl rounded-lg p-2 z-10 flex flex-col gap-2">
                {members.map(m => (
                  <button key={m.email} onClick={() => onUpdate({ members: cMembers.includes(m.email) ? cMembers.filter(x => x !== m.email) : [...cMembers, m.email] })} className="flex items-center gap-2 p-1 hover:bg-hover rounded text-left">
                     <Avatar name={m.name || m.email} size={20} />
                     <span className="text-[14px] truncate">{m.name || m.email}</span>
                     {cMembers.includes(m.email) && <Check className="w-3 h-3 ml-auto" />}
                  </button>
                ))}
                <input value={newMemberName} onChange={e => setNewMemberName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && newMemberName) { onUpdate({ members: [...cMembers, newMemberName] }); setNewMemberName(''); } }} placeholder="Add name..." className="text-[14px] p-1.5 border rounded outline-none w-full" data-gramm="false" data-gramm_editor="false" data-enable-grammarly="false" spellCheck={false} />
              </div>
            )}
          </div>
          
          <div className="relative">
            <button onClick={() => setShowCoverPicker(!showCoverPicker)} className="flex items-center gap-1.5 border border-edge hover:bg-hover px-3 py-1.5 rounded-lg text-[17px] font-semibold text-[#172b4d] dark:text-[#b6c2cf] transition">
              <ImageIcon className="w-4 h-4" /> Cover
            </button>
            {showCoverPicker && (
               <div className="absolute top-full left-0 mt-1 bg-surface border border-edge shadow-xl p-3 rounded-lg flex flex-col gap-2 z-10 w-52">
                 <div className="text-[12px] font-bold text-content-muted mb-1">Color</div>
                 <div className="grid grid-cols-4 gap-1.5">
                   {LABEL_COLORS.map(c => (
                     <button key={c} onClick={() => { onUpdate({ coverColor: c }); setShowCoverPicker(false); }} className={`w-full aspect-[4/3] rounded ${card.coverColor === c ? 'ring-2 ring-blue-500 ring-offset-1 dark:ring-offset-[#282e33]' : ''}`} style={{ backgroundColor: getThemeColor(c, isDark) }} />
                   ))}
                 </div>
                 {card.coverColor && (
                   <button onClick={() => { onUpdate({ coverColor: null }); setShowCoverPicker(false); }} className="mt-2 w-full bg-muted hover:bg-hover text-content-muted text-[13px] font-semibold py-1.5 rounded transition">Remove Cover</button>
                 )}
               </div>
            )}
          </div>
          
          <div className="relative">
            <button onClick={() => setShowLocationPicker(!showLocationPicker)} className="flex items-center gap-1.5 border border-edge hover:bg-hover px-3 py-1.5 rounded-lg text-[17px] font-semibold text-[#172b4d] dark:text-[#b6c2cf] transition">
              <MapPin className="w-4 h-4" /> Location
            </button>
            {showLocationPicker && (
               <div className="absolute top-full left-0 mt-1 w-56 bg-surface border border-edge shadow-xl rounded-lg p-2 z-10 flex flex-col gap-2">
                 <input autoFocus value={card.location || ''} onChange={e => onUpdate({ location: e.target.value })} placeholder="Enter location..." className="text-[14px] p-1.5 border rounded outline-none w-full bg-transparent text-[#172b4d] dark:text-[#b6c2cf]" data-gramm="false" data-gramm_editor="false" data-enable-grammarly="false" spellCheck={false} />
               </div>
            )}
          </div>
          
          <label className="flex items-center gap-1.5 border border-edge hover:bg-hover px-3 py-1.5 rounded-lg text-[17px] font-semibold text-[#172b4d] dark:text-[#b6c2cf] cursor-pointer transition">
            {uploading ? <Spinner /> : <ImageIcon className="w-4 h-4" />} Image
            <input type="file" accept="image/*" className="hidden" onChange={e => handleUpload(e.target.files?.[0])} />
          </label>
        </div>

        {/* Labels Block */}
        <div className="px-14 mt-6">
          <div className="text-[17px] font-bold text-[#172b4d] dark:text-[#b6c2cf] mb-2">Labels</div>
          <div className="flex flex-wrap items-center gap-2 relative">
            {cLabels.map(color => (
              <button key={color} onClick={() => onUpdate({ labels: cLabels.filter(c => c !== color) })} className="w-12 h-8 rounded text-transparent hover:text-black/50 flex items-center justify-center transition" style={{ backgroundColor: getThemeColor(color, isDark) }}>
                <X className="w-4 h-4" />
              </button>
            ))}
            <button onClick={() => setShowColorPicker(!showColorPicker)} className="w-12 h-8 rounded border border-edge-strong flex items-center justify-center hover:bg-hover text-content-muted transition">
              <Plus className="w-4 h-4" />
            </button>
            
            {showColorPicker && (
               <div className="absolute top-10 left-0 bg-surface border border-edge shadow-xl p-2 rounded-lg grid grid-cols-3 gap-2 z-10">
                 {LABEL_COLORS.map(c => (
                   <button key={c} onClick={() => { if(!cLabels.includes(c)) onUpdate({ labels: [...cLabels, c] }); setShowColorPicker(false); }} className="w-10 h-8 rounded" style={{ backgroundColor: getThemeColor(c, isDark) }} />
                 ))}
               </div>
            )}
          </div>
        </div>

        {/* Description Block */}
        <div className="px-14 mt-8 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlignLeft className="w-6 h-6 text-content -ml-8" />
              <div className="text-[22px] font-bold text-[#172b4d] dark:text-[#b6c2cf]">Description</div>
            </div>
            {desc !== (card.description || '') && (
              <span className="text-[11px] font-bold border border-amber-400 text-amber-700 dark:text-amber-500 px-2 py-0.5 rounded">UNSAVED CHANGES</span>
            )}
          </div>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            onBlur={handleSaveDesc}
            placeholder="Add a more detailed description..."
            className="w-full min-h-[100px] border border-edge rounded-lg p-3 text-[18px] text-[#172b4d] dark:text-[#b6c2cf] outline-none focus:ring-2 focus:ring-blue-500 resize-y bg-transparent"
            data-gramm="false"
            data-gramm_editor="false"
            data-enable-grammarly="false"
            spellCheck={false}
          />
        </div>
        
        {/* Checklist Block */}
        {cChecklist.length > 0 && (
          <div className="px-14 mt-8 flex flex-col gap-4">
             <div className="flex items-center gap-3">
                <CheckSquare className="w-6 h-6 text-content -ml-8" />
                <div className="text-[22px] font-bold text-[#172b4d] dark:text-[#b6c2cf]">Checklist</div>
             </div>
             <div className="flex items-center gap-3">
                <span className="text-[14px] text-content-muted w-8">{Math.round((doneCount / cChecklist.length) * 100)}%</span>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                   <div className="h-full bg-teal-500 transition-all duration-300" style={{ width: `${(doneCount / cChecklist.length) * 100}%` }} />
                </div>
             </div>
             <div className="flex flex-col gap-2">
                {cChecklist.map(chk => (
                  <div key={chk.id} className="flex items-center gap-3 group/chk">
                     <button onClick={() => onUpdate({ checklist: cChecklist.map(c => c.id === chk.id ? { ...c, done: !c.done } : c) })} className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${chk.done ? 'bg-teal-500 border-teal-500 text-white' : 'border-edge-strong bg-surface'}`}>
                       {chk.done && <Check className="w-3.5 h-3.5" />}
                     </button>
                     <input value={chk.text} onChange={e => onUpdate({ checklist: cChecklist.map(c => c.id === chk.id ? { ...c, text: e.target.value } : c) })} className={`flex-1 text-[18px] bg-transparent outline-none ${chk.done ? 'line-through text-content-subtle' : 'text-[#172b4d] dark:text-[#b6c2cf]'}`} placeholder="Item..." data-gramm="false" data-gramm_editor="false" data-enable-grammarly="false" spellCheck={false} />
                     <button onClick={() => onUpdate({ checklist: cChecklist.filter(c => c.id !== chk.id) })} className="opacity-0 group-hover/chk:opacity-100 text-content-subtle hover:text-red-500 p-1"><X className="w-4 h-4" /></button>
                  </div>
                ))}
             </div>
             <button onClick={() => onUpdate({ checklist: [...cChecklist, { id: makeId('chk'), text: '', done: false }] })} className="self-start text-[16px] bg-muted hover:bg-hover px-3 py-1.5 rounded font-semibold text-[#172b4d] dark:text-[#b6c2cf] transition">Add an item</button>
          </div>
        )}
        
        {/* Attachments Display */}
        {(card.images && card.images.length > 0) && (
          <div className="px-14 mt-8 flex flex-col gap-3 pb-8">
             <div className="flex items-center gap-3">
                <ImageIcon className="w-6 h-6 text-content -ml-8" />
                <div className="text-[22px] font-bold text-[#172b4d] dark:text-[#b6c2cf]">Images</div>
             </div>
             <div className="grid grid-cols-2 gap-4">
                {card.images.map((img, i) => (
                  <div key={i} className="relative group/att rounded-lg overflow-hidden border border-edge bg-muted">
                     <img src={img} className="w-full h-32 object-cover" alt="" />
                     <button onClick={() => onUpdate({ images: card.images.filter((_, idx) => idx !== i) })} className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white p-1 rounded opacity-0 group-hover/att:opacity-100 transition"><X className="w-4 h-4" /></button>
                  </div>
                ))}
             </div>
          </div>
        )}
        
        <div className="h-48 shrink-0" />
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

const KANBAN_BASE_W = 380;

// ── Main Kanban List Component ─────────────────────────────────────────────
export default function KanbanCard({ element, editable, editing, onEditProps, onUpdateElement, members = [] }) {
  const { props } = element;
  const { isDark } = useTheme();

  // Scale text proportionally with element width, clamped for readability.
  const textScale = Math.min(1.6, Math.max(0.7, element.w / KANBAN_BASE_W));
  const fs = (base) => Math.round(base * textScale);
  const listLabels = (props.labels || []).map(l => (typeof l === 'string' ? { color: l, text: '' } : l));
  const subcards = props.subcards || [];

  const titleRef = useRef(null);
  const listRef = useRef(null);

  // Stable refs so the auto-resize effect doesn't re-run on every render.
  // onUpdateElement is a new arrow function each render; element.h changes after each call —
  // putting either in the dep array causes an infinite setState loop.
  const onUpdateElementRef = useRef(onUpdateElement);
  onUpdateElementRef.current = onUpdateElement;
  const elementHRef = useRef(element.h);
  elementHRef.current = element.h;

  // Auto-resize vertically when cards are added / removed.
  useEffect(() => {
    if (!listRef.current || props.collapsed || !onUpdateElementRef.current) return;
    const { scrollHeight, clientHeight } = listRef.current;
    if (scrollHeight > clientHeight) {
      const neededHeight = elementHRef.current + (scrollHeight - clientHeight);
      if (neededHeight > elementHRef.current && neededHeight <= 1200) {
        // Defer the Yjs write out of React's passive-effect commit phase to avoid
        // the synchronous observer→setElements chain that causes "maximum update depth exceeded".
        const fn = onUpdateElementRef.current;
        const h = neededHeight;
        requestAnimationFrame(() => { if (h > elementHRef.current) fn({ h }); });
      }
    }
  }, [subcards.length, props.collapsed]);
  
  // Local state for active editing (inline & modal)
  const [activeCardId, setActiveCardId] = useState(null);
  const [modalCardId, setModalCardId] = useState(null);
  const [openChecklistId, setOpenChecklistId] = useState(null);
  const [showListColorPicker, setShowListColorPicker] = useState(false);
  const colorPickerRef = useRef(null);
  const activeCardRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target)) {
        setShowListColorPicker(false);
      }
    };
    if (showListColorPicker) {
      document.addEventListener('pointerdown', handleClickOutside);
    }
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, [showListColorPicker]);

  // Click-outside closes inline edit (auto-save — data is already patched on each keystroke)
  useEffect(() => {
    if (!activeCardId) return;
    const handleOutside = (e) => {
      if (activeCardRef.current && !activeCardRef.current.contains(e.target)) {
        setActiveCardId(null);
      }
    };
    document.addEventListener('pointerdown', handleOutside, { capture: true });
    return () => document.removeEventListener('pointerdown', handleOutside, { capture: true });
  }, [activeCardId]);

  useEffect(() => {
    if (editing && titleRef.current) {
      titleRef.current.focus({ preventScroll: true });
    }
  }, [editing]);

  // Hide Grammarly overlays injected by browser extensions near this component.
  // This is a targeted, removable workaround to avoid extension UI blocking our header.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (document.getElementById('copilot-hide-grammarly')) return;
    const style = document.createElement('style');
    style.id = 'copilot-hide-grammarly';
    style.innerHTML = `
      [class*="gr-"], [class*="gr_"], [class*="grammarly"], [id^="grammarly"], .gr__tooltip, .gr-tooltip, .gr-floating-panel, .gr-floating-bubble, .gr-ghost { display: none !important; }
    `;
    document.head.appendChild(style);
    return () => { style.remove(); };
  }, []);

  // ── mutations ────────────────────────────────────────────────────────────
  const setListColor = (color) => onEditProps({ labels: color ? [{ color, text: '' }] : [] });
  
  const addSubcard = () => {
    const newId = makeId('sub');
    onEditProps({ subcards: [...subcards, { id: newId, title: '', done: false, labels: [], members: [], checklist: [], images: [], description: '', due: '' }] });
    setActiveCardId(newId);
  };
  
  const patchSubcard = (id, patch) =>
    onEditProps({ subcards: subcards.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
    
  const removeSubcard = (id) => onEditProps({ subcards: subcards.filter((s) => s.id !== id) });

  // Determine list container background (theme-aware)
  const labelColor = listLabels.length > 0 ? listLabels[0].color : null;
  const listPastel = labelColor ? LIST_COLORS[labelColor] : null;
  const bgColor = listPastel 
    ? getThemeColor(listPastel, isDark) 
    : getThemeColor('#f1f2f4', isDark);

  if (props.collapsed) {
    return (
      <div className="w-full h-full flex flex-col items-center rounded-2xl shadow-sm transition-all py-4 border border-black/5" style={{ backgroundColor: bgColor }} onPointerDown={editing ? stop : undefined}>
         <button onClick={() => { onEditProps({ collapsed: false }); onUpdateElement?.({ w: 380, h: Math.max(element.h, 340) }); }} onPointerDown={stop} className="p-3 bg-transparent border-[3px] border-blue-600 text-[#172b4d] dark:text-[#b6c2cf] rounded-[20px] shadow-sm hover:opacity-80 transition flex items-center justify-center shrink-0">
           <ArrowRightLeft className="w-6 h-6" strokeWidth={3} />
         </button>
         <div className="mt-8 flex-1 flex items-start justify-center">
            <span className="font-bold text-[#172b4d] dark:text-[#b6c2cf] tracking-widest uppercase" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: fs(24) }}>
              {props.title || 'Untitled'}
            </span>
         </div>
      </div>
    );
  }

  return (
    <>
      <div
        className="w-full h-full flex flex-col rounded-2xl overflow-hidden shadow-sm transition-all"
        style={{ backgroundColor: bgColor, padding: '12px 10px 10px 10px' }}
        onPointerDown={editing ? stop : undefined}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-2 mb-3 px-1 shrink-0 min-w-0">
          {editing ? (
            <input
              ref={titleRef}
              value={props.title}
              onChange={(e) => onEditProps({ title: e.target.value })}
              onPointerDown={stop}
              placeholder="List title..."
              className="flex-1 min-w-0 bg-surface/90 px-3 py-1.5 rounded-lg outline-none font-bold text-[#172b4d] dark:text-[#b6c2cf] placeholder:text-[#172b4d]/50 transition-colors"
              style={{ fontSize: fs(28) }}
              data-gramm="false"
              data-gramm_editor="false"
              data-enable-grammarly="false"
              spellCheck={false}
            />
          ) : (
            <div className="font-bold text-[#172b4d] dark:text-[#b6c2cf] min-w-0 flex-1" style={{ fontSize: fs(28) }}>
              <span className="block bg-surface/90 px-3 py-1.5 rounded-lg shadow-sm min-w-0 max-w-full whitespace-normal wrap-break-word leading-tight">
                {props.title || 'Untitled'}
              </span>
            </div>
          )}
          
          <div className="flex items-center gap-1 text-content-muted shrink-0 ml-2 relative">
            <button onPointerDown={stop} onClick={() => { 
              onEditProps({ collapsed: true }); 
              const textLen = (props.title || 'Untitled').length;
              onUpdateElement?.({ w: 64, h: Math.max(200, textLen * 18 + 120) }); 
            }} className="p-1.5 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg transition-colors">
              <ArrowRightLeft className="w-4 h-4 text-[#172b4d] dark:text-[#b6c2cf]" />
            </button>
            {/* removed redundant three-dot menu (MoreHorizontal) per UX request */}
          </div>
        </div>

        {/* ── Body (Cards) ────────────────────────────────────────────────── */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto min-h-0 flex flex-col gap-2 px-1 pb-1"
          style={{ scrollbarWidth: 'thin', scrollbarColor: isDark ? 'rgba(255,255,255,0.15) transparent' : 'rgba(0,0,0,0.18) transparent' }}
          onWheel={(e) => e.stopPropagation()}
        >
          {subcards.map(s => {
            const isActive = activeCardId === s.id;
            const hasChecklist = s.checklist && s.checklist.length > 0;
            const doneCount = hasChecklist ? s.checklist.filter(c => c.done).length : 0;
            const due = dueMeta(s.due);
            const coverImage = s.images?.[0];

            if (isActive) {
              // Inline Edit Mode
              return (
                <div key={s.id} ref={activeCardRef} className="bg-white dark:bg-[#22272b] rounded-xl shadow-md border-2 border-blue-500 flex flex-col shrink-0" onPointerDown={stop}>
                  {coverImage && <div className="overflow-hidden rounded-t-xl"><img src={coverImage} className="w-full h-24 object-cover" alt="" /></div>}
                  {!coverImage && s.coverColor && <div className="w-full h-10 rounded-t-xl shrink-0" style={{ backgroundColor: s.coverColor }} />}

                  <div className="p-3 pb-3 flex flex-col gap-2">
                    {/* Header: EDITING label + sparkles cover picker */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold text-content-subtle uppercase tracking-widest">Editing</span>
                      <div className="relative" ref={colorPickerRef}>
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowListColorPicker(!showListColorPicker); }}
                          onPointerDown={stop}
                          title="Cover color"
                          className="p-1 hover:bg-hover rounded transition"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                        </button>
                        {showListColorPicker && (
                          <div className="absolute top-full left-0 mt-1 bg-surface border border-edge shadow-xl p-2 rounded-lg flex flex-col gap-2 z-20 w-44" onClick={stop} onPointerDown={stop}>
                            <div className="text-[11px] font-bold text-content-muted px-1 pt-0.5">Cover Color</div>
                            <div className="grid grid-cols-4 gap-1.5 px-1 pb-1">
                              {LABEL_COLORS.map(c => (
                                <button key={c} onClick={() => { patchSubcard(s.id, { coverColor: c }); setShowListColorPicker(false); }} className={`w-full aspect-4/3 rounded ${s.coverColor === c ? 'ring-2 ring-blue-500' : ''}`} style={{ backgroundColor: getThemeColor(c, isDark) }} />
                              ))}
                            </div>
                            {s.coverColor && (
                              <button onClick={() => { patchSubcard(s.id, { coverColor: null }); setShowListColorPicker(false); }} className="mx-1 mb-1 text-[11px] font-semibold bg-muted hover:bg-hover text-content-muted py-1 px-2 rounded transition">Remove</button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Label dashes */}
                    {(s.labels && s.labels.length > 0) && (
                      <div className="flex flex-wrap gap-1">
                        {s.labels.map(c => <div key={c} className="h-1.5 w-8 rounded-full" style={{ backgroundColor: getThemeColor(c, isDark) }} />)}
                      </div>
                    )}

                    <textarea
                      autoFocus
                      value={s.title}
                      onChange={(e) => patchSubcard(s.id, { title: e.target.value })}
                      placeholder="Card title..."
                      rows={1}
                      className="w-full bg-transparent outline-none resize-none font-medium text-[#172b4d] dark:text-[#b6c2cf] leading-snug"
                      style={{ fontSize: fs(20) }}
                      onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                      data-gramm="false"
                      data-gramm_editor="false"
                      data-enable-grammarly="false"
                      spellCheck={false}
                    />

                    {/* Badges + action row */}
                    <div className="flex items-center justify-between mt-1 pt-2 border-t border-edge-subtle">
                      <div className="flex items-center gap-2 flex-wrap">
                        {due && (
                          <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded font-semibold ${due.badgeCls}`} style={{ fontSize: fs(14) }}>
                            <Clock className="w-3.5 h-3.5" /> {due.label}
                          </div>
                        )}
                        {hasChecklist && (
                          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded font-semibold bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" style={{ fontSize: fs(14) }}>
                            <CheckSquare className="w-3.5 h-3.5" /> {doneCount}/{s.checklist.length}
                          </div>
                        )}
                        {(s.members && s.members.length > 0) && (
                          <div className="flex items-center -space-x-1">
                            {s.members.slice(0,3).map(m => <Avatar key={m} name={m} size={20} />)}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 ml-2">
                        <button onClick={() => setModalCardId(s.id)} className="font-semibold bg-muted hover:bg-hover text-[#172b4d] dark:text-[#b6c2cf] px-3 py-1.5 rounded-lg transition" style={{ fontSize: fs(13) }}>Details</button>
                        <button onClick={() => { setActiveCardId(null); removeSubcard(s.id); }} className="px-2 py-1.5 hover:bg-red-50 dark:hover:bg-red-900/30 text-content-subtle hover:text-red-500 rounded-lg transition font-semibold" style={{ fontSize: fs(13) }} title="Delete card">
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            }

            // Standard View Mode
            return (
              <div
                key={s.id}
                onClick={() => { if(editable) setActiveCardId(s.id); }}
                className="bg-white dark:bg-[#22272b] rounded-lg shadow-sm flex flex-col group/card shrink-0 cursor-pointer hover:ring-1 hover:ring-blue-400 transition-all border border-transparent dark:border-edge"
              >
                {coverImage && <div className="overflow-hidden rounded-t-lg"><img src={coverImage} className="w-full h-24 object-cover" alt="" /></div>}
                {!coverImage && s.coverColor && <div className="w-full h-8 rounded-t-lg shrink-0" style={{ backgroundColor: s.coverColor }} />}
                <div className="px-3 py-2.5 flex flex-col gap-1.5">
                  <div className={`font-medium leading-snug break-words ${s.done ? 'line-through text-content-subtle' : 'text-[#172b4d] dark:text-[#b6c2cf]'}`} style={{ fontSize: fs(20) }}>
                    {s.title ? s.title : <span className="text-content-subtle italic">Untitled card</span>}
                  </div>

                  {/* Badges */}
                  {(due || hasChecklist || s.members?.length > 0 || s.description || s.images?.length > 0 || s.location) && (
                    <div className="flex flex-col gap-1 mt-0.5">
                      <div className="flex items-center gap-2 text-content-muted flex-wrap">
                        {due && (
                          <div className={`flex items-center gap-1 px-1 rounded font-semibold ${due.badgeCls}`} style={{ fontSize: fs(14) }}>
                            <Clock className="w-3.5 h-3.5" /> {due.label}
                          </div>
                        )}
                        {s.description && <AlignLeft className="w-4 h-4" title="Has description" />}
                        {hasChecklist && (
                          <button
                            onPointerDown={stop}
                            onClick={(e) => { e.stopPropagation(); setOpenChecklistId(openChecklistId === s.id ? null : s.id); }}
                            className="flex items-center gap-1 font-medium hover:opacity-80 transition"
                            style={{ fontSize: fs(14) }}
                          >
                            <CheckSquare className="w-3.5 h-3.5" /> {doneCount}/{s.checklist.length}
                          </button>
                        )}
                        {s.location && (
                          <div className="flex items-center gap-1 font-medium max-w-[120px] truncate" style={{ fontSize: fs(14) }} title={s.location}>
                            <MapPin className="w-3.5 h-3.5" /> {s.location}
                          </div>
                        )}
                        {(s.images && s.images.length > 0) && (
                          <div className="flex items-center gap-1 font-medium" style={{ fontSize: fs(14) }}>
                            <ImageIcon className="w-3.5 h-3.5" /> {s.images.length}
                          </div>
                        )}
                        {(s.members && s.members.length > 0) && (
                          <div className="flex items-center -space-x-1 ml-auto">
                            {s.members.slice(0,3).map(m => <Avatar key={m} name={m} size={18} />)}
                          </div>
                        )}
                      </div>

                      {/* Inline checklist expansion — avoids overflow-hidden clipping */}
                      {openChecklistId === s.id && hasChecklist && (
                        <div onClick={stop} onPointerDown={stop} className="flex flex-col gap-1 mt-0.5 pt-1.5 border-t border-edge-subtle">
                          {s.checklist.map(chk => (
                            <label key={chk.id} className="flex items-center gap-2 cursor-pointer py-0.5 px-1 hover:bg-hover rounded transition">
                              <input
                                type="checkbox"
                                checked={chk.done}
                                onChange={() => patchSubcard(s.id, { checklist: s.checklist.map(c => c.id === chk.id ? { ...c, done: !c.done } : c) })}
                                className="mt-0.5 shrink-0"
                              />
                              <span className={`text-[14px] flex-1 leading-snug ${chk.done ? 'line-through text-content-subtle' : 'text-[#172b4d] dark:text-[#b6c2cf]'}`}>{chk.text || <span className="italic text-content-subtle">Empty item</span>}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div className="mt-1 px-1 shrink-0">
          {editing && (
            <div className="flex items-center gap-2 px-2 py-2 border-t border-black/10 dark:border-white/10" onPointerDown={stop}>
              <span className="font-medium text-[#172b4d]/60 dark:text-[#b6c2cf]/60 mr-1" style={{ fontSize: fs(15) }}>Color:</span>
              {PICKER_COLORS.map((pastel) => (
                <button
                  key={pastel || 'default'}
                  onClick={() => setListColor(pastel ? BG_TO_LABEL[pastel] : null)}
                  onPointerDown={stop}
                  className={`w-6 h-6 rounded-full border transition-all ${(pastel ? BG_TO_LABEL[pastel] === labelColor : labelColor === null) ? 'ring-2 ring-blue-500 ring-offset-2 border-transparent' : 'border-edge-strong hover:scale-110'}`}
                  style={{ backgroundColor: pastel || 'transparent' }}
                  title={pastel ? 'Color' : 'Default'}
                >
                  {!pastel && <div className="w-full h-full rounded-full bg-[#f1f2f4] dark:bg-[#22272b] border border-edge-strong" />}
                </button>
              ))}
            </div>
          )}
          <button
            onPointerDown={stop}
            onClick={addSubcard}
            className="w-full flex items-center justify-start gap-2 px-2 py-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg text-[#172b4d] dark:text-[#b6c2cf] transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span className="font-medium" style={{ fontSize: fs(19) }}>Add a card</span>
          </button>
        </div>
      </div>

      {/* Render Modal if a card is open */}
      {modalCardId && (() => {
        const modalCard = subcards.find(s => s.id === modalCardId);
        return modalCard ? (
          <CardModal
            card={modalCard}
            listTitle={props.title || 'Untitled'}
            onClose={() => setModalCardId(null)}
            onUpdate={(patch) => patchSubcard(modalCardId, patch)}
            members={members}
          />
        ) : null;
      })()}
    </>
  );
}
