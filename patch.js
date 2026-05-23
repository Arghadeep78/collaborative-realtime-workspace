const fs = require('fs');
const file = '/Users/arghadeep/Desktop/distributed-vector-workspace/frontend/src/Components/Whiteboard/WhiteboardRoom.jsx';
let content = fs.readFileSync(file, 'utf8');

// Inside WhiteboardRoom, add a presenceTick effect that updates votes
content = content.replace(
  "const interval = setInterval(() => setPresenceTick(Date.now()), 1000);",
  "const interval = setInterval(() => { setPresenceTick(Date.now()); if (ydoc) { setVotes(ydoc.getMap('votes').toJSON()); setComments(ydoc.getArray('comments').toArray()); } }, 1000);"
);

fs.writeFileSync(file, content);
