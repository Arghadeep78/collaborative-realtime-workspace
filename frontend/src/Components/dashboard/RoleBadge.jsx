import { ROLE_BADGE } from '../../pages/dashboard/dashboardConstants.js';

export default function RoleBadge({ role }) {
  if (!role) return null;
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded capitalize ${ROLE_BADGE[role] ?? ROLE_BADGE.viewer}`}>
      {role}
    </span>
  );
}
