import { useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { BACKEND_URL } from '../constants/apiConfig.js';

/**
 * Initialises a Y.Doc and connects it to the existing Yjs WebSocket server
 * at ws://<BACKEND_URL>/yjs/<boardId>?token=<jwt>
 *
 * Returns stable ydoc/provider references via state (not refs) so that
 * consumers re-render when they become available.
 *
 * The `synced` flag tracks whether the provider has completed its initial
 * sync.  It intentionally does NOT flip to `false` on transient disconnects
 * so that the board canvas stays mounted during brief network blips.
 *
 * @param {string} boardId
 * @returns {{ ydoc: Y.Doc|null, provider: WebsocketProvider|null, synced: boolean }}
 */
export function useYjsBoard(boardId) {
  const [synced, setSynced]       = useState(false);
  const [ydoc, setYdoc]           = useState(null);
  const [provider, setProvider]   = useState(null);

  // Track whether we've ever completed a sync for this connection.
  // Once true, we keep the canvas mounted even during brief disconnects
  // so the board canvas isn't unmounted/remounted (which causes the
  // blank board issue).
  const hasSyncedOnceRef = useRef(false);

  useEffect(() => {
    if (!boardId) return;

    const token = localStorage.getItem('token');
    const wsUrl = BACKEND_URL.replace(/^http/, 'ws'); // http→ws, https→wss

    const doc = new Y.Doc();

    // Connect to our custom WSServer.js at /yjs/<boardId>
    const prov = new WebsocketProvider(
      `${wsUrl}/yjs`,  // base URL
      boardId,          // room name (appended as path segment by y-websocket)
      doc,
      {
        params: token ? { token } : {},  // JWT passed as query param
        connect: true,
      }
    );

    hasSyncedOnceRef.current = false;

    const onSync = (isSynced) => {
      if (isSynced) {
        hasSyncedOnceRef.current = true;
        setSynced(true);
      }
      // Don't set synced=false on disconnect — the canvas should stay mounted
      // so the board canvas isn't destroyed and rebuilt.
    };

    // Handle status changes (connection/disconnection)
    const onStatus = ({ status }) => {
      if (status === 'disconnected' && !hasSyncedOnceRef.current) {
        // Only show loading if we've never synced at all (first connection attempt)
        setSynced(false);
      }
      // If we've synced before, keep synced=true so the canvas stays mounted
    };

    prov.on('sync', onSync);
    prov.on('status', onStatus);

    // Set state so consumers re-render with the new ydoc/provider
    setYdoc(doc);
    setProvider(prov);

    return () => {
      prov.off('sync', onSync);
      prov.off('status', onStatus);
      prov.destroy();
      doc.destroy();
      setYdoc(null);
      setProvider(null);
      setSynced(false);
      hasSyncedOnceRef.current = false;
    };
  }, [boardId]);

  return { ydoc, provider, synced };
}
