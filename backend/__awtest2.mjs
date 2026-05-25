import * as Y from 'yjs';
import * as awarenessProtocol from 'y-protocols/awareness.js';

const doc = new Y.Doc();
const aw = new awarenessProtocol.Awareness(doc);
aw.setLocalStateField('user', { email: 'a@b.com', name: 'A' });
const bytes = awarenessProtocol.encodeAwarenessUpdate(aw, [doc.clientID]);
const msg = `inst-1|${Buffer.from(bytes).toString('base64')}`;
const sep = msg.indexOf('|');

const doc2 = new Y.Doc();
const aw2 = new awarenessProtocol.Awareness(doc2);
aw2.setLocalState(null); // server never sets local state; clear it
const recovered = new Uint8Array(Buffer.from(msg.slice(sep + 1), 'base64'));
awarenessProtocol.applyAwarenessUpdate(aw2, recovered, 'redis-awareness');
console.log('state for remote clientID', doc.clientID, '=>', JSON.stringify(aw2.getStates().get(doc.clientID)));
