async function addUserToBoard(redisClient, boardId, userEmail) {
  await redisClient.sAdd(`board:${boardId}:users`, userEmail);
}

async function removeUserFromBoard(redisClient, boardId, userEmail) {
  await redisClient.sRem(`board:${boardId}:users`, userEmail);

  // auto-clean if no users left
  const remaining = await redisClient.sCard(`board:${boardId}:users`);
  if (remaining === 0) {
    await redisClient.del(`board:${boardId}:users`);
  }
}

async function getUsersInBoard(redisClient, boardId) {
  return await redisClient.sMembers(`board:${boardId}:users`);
}

export { addUserToBoard, removeUserFromBoard, getUsersInBoard };
