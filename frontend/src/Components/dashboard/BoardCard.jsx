import { timeAgo } from '../../utils/timeAgo.js';
import RoleBadge from './RoleBadge.jsx';
import {
  LayoutIcon, StarIcon, MoreIcon, EditIcon, ImageIcon,
  MoveIcon, TrashIcon, LogOutIcon,
} from '../common/icons.jsx';

export default function BoardCard({ board, onNavigate, onRename, onDelete, onChangeThumbnail, onToggleFavorite, onMoveToWorkspace, onLeaveBoard, canMove, openMenu, setOpenMenu, renamingId, renameVal, setRenameVal, saveRename, setRenamingId }) {
  const isGradient = (v) => v && v.startsWith('linear-gradient');
  const isOwner = board.myRole === 'owner'; // rename, change cover, delete are owner-only
  const canDelete = board.myRole === 'owner';
  const canLeave = board.myRole && board.myRole !== 'owner';
  const hasMenu = isOwner || canDelete || canMove || canLeave;

  return (
    <div
      className="group relative bg-surface border border-edge hover:shadow-lg hover:border-edge-strong rounded-xl cursor-pointer transition-all duration-200 flex flex-col"
      onClick={() => onNavigate(board.id)}
    >
      <div className="h-40 relative overflow-hidden flex items-center justify-center bg-muted rounded-t-[11px]">
        {board.thumbnail ? (
          isGradient(board.thumbnail) ? (
            <div className="absolute inset-0" style={{ background: board.thumbnail }} />
          ) : (
            <img src={board.thumbnail} alt="" className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
          )
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-content-subtle/40 group-hover:text-content-subtle transition-colors duration-300">
            <LayoutIcon />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
      </div>

      <div className="px-4 py-3.5 flex items-start justify-between gap-3 bg-surface rounded-b-[11px]">
        <div className="flex-1 min-w-0">
          {renamingId === board.id && isOwner ? (
            <input autoFocus value={renameVal} onClick={e => e.stopPropagation()}
              onChange={e => setRenameVal(e.target.value)}
              onBlur={() => saveRename(board.id)}
              onKeyDown={e => { if (e.key === 'Enter') saveRename(board.id); if (e.key === 'Escape') setRenamingId(null); }}
              className="w-full bg-muted text-content text-sm px-2 py-1 rounded border border-edge-strong outline-none focus:border-indigo-500"
            />
          ) : (
            <p className="text-content text-sm font-medium truncate">{board.title}</p>
          )}
          <p className="text-content-subtle text-xs mt-1 flex items-center gap-1.5">
            {timeAgo(board.updatedAt || board.createdAt)}
            {board.myRole && (
              <><span className="w-0.5 h-0.5 rounded-full bg-edge-strong inline-block" /><RoleBadge role={board.myRole} /></>
            )}
          </p>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => onToggleFavorite(board.id)}
            className={`opacity-0 group-hover:opacity-100 p-1.5 rounded-md transition-all ${board.isFavorited ? 'opacity-100 text-yellow-500 dark:text-yellow-400' : 'text-content-subtle hover:text-yellow-500 dark:hover:text-yellow-400'}`}
            title={board.isFavorited ? 'Remove from favorites' : 'Add to favorites'}
          >
            <StarIcon filled={board.isFavorited} />
          </button>
          {hasMenu && (
            <div className="relative">
              <button
                onClick={() => setOpenMenu(openMenu === board.id ? null : board.id)}
                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md text-content-subtle hover:text-content hover:bg-hover transition-all"
              >
                <MoreIcon />
              </button>
              {openMenu === board.id && (
                <div className="absolute right-0 top-8 w-44 bg-surface border border-edge rounded-xl shadow-xl overflow-hidden z-20 rb-anim-pop py-1">
                  {isOwner && (
                    <button onClick={() => onRename(board)} className="w-full text-left px-3 py-2 text-sm text-content-muted hover:bg-hover hover:text-content transition-colors flex items-center gap-2.5"><EditIcon /> Rename</button>
                  )}
                  {isOwner && (
                    <button onClick={() => { onChangeThumbnail(board); setOpenMenu(null); }} className="w-full text-left px-3 py-2 text-sm text-content-muted hover:bg-hover hover:text-content transition-colors flex items-center gap-2.5"><ImageIcon /> Change cover</button>
                  )}
                  {canMove && (
                    <button onClick={() => { onMoveToWorkspace(board); setOpenMenu(null); }} className="w-full text-left px-3 py-2 text-sm text-content-muted hover:bg-hover hover:text-content transition-colors flex items-center gap-2.5"><MoveIcon /> Move to workspace</button>
                  )}
                  {canDelete && (
                    <>
                      <div className="h-px bg-edge-subtle my-1" />
                      <button onClick={() => { onDelete(board.id); setOpenMenu(null); }} className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400/80 dark:hover:bg-red-500/10 dark:hover:text-red-400 transition-colors flex items-center gap-2.5"><TrashIcon /> Delete</button>
                    </>
                  )}
                  {canLeave && (
                    <>
                      <div className="h-px bg-edge-subtle my-1" />
                      <button onClick={() => { onLeaveBoard(board.id); setOpenMenu(null); }} className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400/80 dark:hover:bg-red-500/10 dark:hover:text-red-400 transition-colors flex items-center gap-2.5"><LogOutIcon /> Leave project</button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
