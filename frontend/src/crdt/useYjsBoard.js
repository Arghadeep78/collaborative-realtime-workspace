import { useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { BACKEND_URL } from '../constants/apiConfig.js';

/**
 * Initialises a Y.Doc and connects it to the existing Yjs WebSocket server
 * at ws://<BACKEND_URL>/yjs/<boardId>?token=<jwt>
 *
 * @param {string} boardId
 * @returns {{ ydoc: Y.Doc|null, provider: WebsocketProvider|null, synced: boolean }}
 */
export function useYjsBoard(boardId) {
  const [synced, setSynced]     = useState(false);
  const ydocRef                 = useRef(null);
  const providerRef             = useRef(null);

  useEffect(() => {
    if (!boardId) return;

    const token = localStorage.getItem('token');
    const wsUrl = BACKEND_URL.replace(/^http/, 'ws'); // http→ws, https→wss

    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    // Connect to our custom WSServer.js at /yjs/<boardId>
    const provider = new WebsocketProvider(
      `${wsUrl}/yjs`,  // base URL
      boardId,          // room name (appended as path segment by y-websocket)
      ydoc,
      {
        params: token ? { token } : {},  // JWT passed as query param
        connect: true,
      }
    );
    providerRef.current = provider;

    const onSync = (isSynced) => setSynced(isSynced);
    provider.on('sync', onSync);

    return () => {
      provider.off('sync', onSync);
      provider.destroy();
      ydoc.destroy();
      ydocRef.current   = null;
      providerRef.current = null;
      setSynced(false);
    };
  }, [boardId]);

  return {
    ydoc:     ydocRef.current,
    provider: providerRef.current,
    synced,
  };
}
