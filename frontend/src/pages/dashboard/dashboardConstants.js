// ── Dashboard constants ─────────────────────────────────────────────────────

// Default board cover thumbnails (DiceBear avatars used as playful covers).
export const CUTE_THUMBNAILS = [
  'https://api.dicebear.com/8.x/fun-emoji/svg?seed=Felix&backgroundColor=ffdfbf',
  'https://api.dicebear.com/8.x/fun-emoji/svg?seed=Aneka&backgroundColor=c0aede',
  'https://api.dicebear.com/8.x/fun-emoji/svg?seed=Oliver&backgroundColor=d1d4f9',
  'https://api.dicebear.com/8.x/bottts/svg?seed=Sam&backgroundColor=b6e3f4',
  'https://api.dicebear.com/8.x/bottts/svg?seed=Mia&backgroundColor=ffd5dc',
  'https://api.dicebear.com/8.x/bottts/svg?seed=Buster&backgroundColor=c2e8c2',
  'https://api.dicebear.com/8.x/fun-emoji/svg?seed=Bella&backgroundColor=e6e6fa',
  'https://api.dicebear.com/8.x/lorelei/svg?seed=Lily&backgroundColor=c0aede',
  'https://api.dicebear.com/8.x/lorelei/svg?seed=Oscar&backgroundColor=ffd5dc',
  'https://api.dicebear.com/8.x/lorelei/svg?seed=George&backgroundColor=e6e6fa',
  'https://api.dicebear.com/8.x/micah/svg?seed=Leo&backgroundColor=ffeeb5',
  'https://api.dicebear.com/8.x/micah/svg?seed=Max&backgroundColor=b6e3f4',
  'https://api.dicebear.com/8.x/micah/svg?seed=Charlie&backgroundColor=d1d4f9',
  'https://api.dicebear.com/8.x/fun-emoji/svg?seed=Jack&backgroundColor=c2e8c2',
  'https://api.dicebear.com/8.x/fun-emoji/svg?seed=Nala&backgroundColor=ffeeb5',
  'https://api.dicebear.com/8.x/bottts/svg?seed=Milo&backgroundColor=ffdfbf',
];

// Tailwind classes per board/workspace role badge.
export const ROLE_BADGE = {
  owner:     'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300',
  editor:    'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
  commenter: 'bg-amber-500/10 text-amber-600 dark:text-amber-300',
  viewer:    'bg-edge text-content-subtle',
};
