import * as Y from 'yjs';
import * as awarenessProtocol from 'y-protocols/awareness.js';

const INSTANCE_ID = 'inst-1';
const doc = new Y.Doc();
const aw = new awarenessProtocol.Awareness(doc);
aw.setLocalStateField('user', { email: 'a@b.com', name: 'A' });
const bytes = awarenessProtocol.encodeAwarenessUpdate(aw, [doc.clientID]);

// publish format
const msg = `${INSTANCE_ID}|${Buffer.from(bytes).toString('base64')}`;

// receiver parse
const sep = msg.indexOf('|');
const sender = msg.slice(0, sep);
console.log('sender parsed:', sender, '=> skip own?', sender === INSTANCE_ID);

// apply on a remote instance awareness
const doc2 = new Y.Doc();
const aw2 = new awarenessProtocol.Awareness(doc2);
let changed = null;
aw2.on('change', (c) => { changed = c; });
const recovered = new Uint8Array(Buffer.from(msg.slice(sep + 1), 'base64'));
awarenessProtocol.applyAwarenessUpdate(aw2, recovered, 'redis-awareness');
console.log('remote awareness now has states:', aw2.getStates().size);
const got = [...aw2.getStates().values()][0];
console.log('recovered user email:', got?.user?.email, '| change fired added:', JSON.stringify(changed?.added));
