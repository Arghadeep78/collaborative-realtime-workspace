/** Shapes a workspace document into the standard API response object. */
export function wsView(ws, email) {
  const obj = ws.toObject ? ws.toObject() : ws;
  return {
    id:        obj.id,
    name:      obj.name,
    owner:     obj.owner,
    isOwner:   email != null ? obj.owner === email : undefined,
    members:   obj.members,
    boardIds:  obj.boardIds,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
  };
}
