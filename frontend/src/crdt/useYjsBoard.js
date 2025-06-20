import { useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import * as decoding from 'lib0/decoding';
import { BACKEND_URL } from '../constants/apiConfig.js';

// Mirror of the server's custom control frame (see WSServer.js MSG_ACCESS).
// y-websocket reserves message types 0–3; 100 carries a live role change.
const MSG_ACCESS = 100;
// WS close code the server uses when a user's access is revoked mid-session.
// Distinct from transient network closes so we suppress y-websocket's auto
// reconnect (which would otherwise loop: reconnect → server re-denies → close).
const CLOSE_ACCESS_REVOKED = 4403;

/**
 * Initialises a Y.Doc and connects it to the existing Yjs WebSocket server
 * at wss://<BACKEND_URL>/yjs/<boardId>?ticket=<one-time-ticket>
 *
 * Before opening the WebSocket the hook exchanges the current Bearer JWT for a
 * single-use ticket (POST /users/ws-ticket). The ticket is stored in Redis with
 * a 30-second TTL and consumed on first use by the server's upgrade gate, so the
 * JWT never appears in a WebSocket URL, server log, or proxy access log.
 *
 * Returns stable ydoc/provider references via state (not refs) so that
 * consumers re-render when they become available.
 *
 * The `synced` flag tracks whether the provider has completed its initial
 * sync.  It intentionally does NOT flip to `false` on transient disconnects
 * so that the board canvas stays mounted during brief network blips.
 *
 * `liveRole` reflects a mid-session role change pushed by the server (e.g. an
 * editor demoted to viewer): null until the server sends one, then the new
 * role string. `accessRevoked` flips true when the server closes the socket
 * because the user lost all access, so the consumer can route them away.
 *
 * @param {string} boardId
 * @returns {{ ydoc: Y.Doc|null, provider: WebsocketProvider|null, synced: boolean, liveRole: string|null, accessRevoked: boolean }}
 */
export function useYjsBoard(boardId) {
  const [synced, setSynced]       = useState(false);
  const [ydoc, setYdoc]           = useState(null);
  const [provider, setProvider]   = useState(null);
  const [liveRole, setLiveRole]   = useState(null);
  const [accessRevoked, setAccessRevoked] = useState(false);

  // Track whether we've ever completed a sync for this connection.
  // Once true, we keep the canvas mounted even during brief disconnects
  // so the board canvas isn't unmounted/remounted (which causes the
  // blank board issue).
  const hasSyncedOnceRef = useRef(false);

  useEffect(() => {
    if (!boardId) return;

    // Signed share token from the URL (`?st=`) — lets a link visitor connect at
    // the role the link grants (editor/commenter) instead of the viewer baseline.
    const shareToken = new URLSearchParams(window.location.search).get('st');
    const wsUrl = BACKEND_URL.replace(/^http/, 'ws'); // http→ws, https→wss

    // Async-init guard: set to true in the cleanup function so that if the
    // ticket fetch completes after the effect was torn down we bail out and
    // don't create a dangling provider. Also used in onStatus to skip stale
    // prov.params writes after unmount.
    let cancelled = false;

    // Mutable refs so the cleanup return function can always reach the live
    // provider and doc regardless of when the async init resolves.
    let doc  = null;
    let prov = null;
    // Stored so cleanup can call prov.off() with the exact same function refs.
    let registeredHandlers = null;

    /**
     * Exchange the current Bearer access token for a single-use WS ticket.
     * Returns null when the user is logged out or the request fails — callers
     * treat null as "connect without a ticket" (share-link anonymous path).
     */
    const fetchWsTicket = async () => {
      const token = localStorage.getItem('token');
      if (!token) return null;
      try {
        const res = await fetch(`${BACKEND_URL}/users/ws-ticket`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return null;
        const { data } = await res.json();
        return data?.ticket ?? null;
      } catch {
        return null;
      }
    };

    const init = async () => {
      const ticket = await fetchWsTicket();
      if (cancelled) return; // effect cleaned up while the ticket was in-flight

      doc = new Y.Doc();

      // Connect to our custom WSServer.js at /yjs/<boardId>.
      // The ticket (not the raw JWT) is the only credential in the URL.
      prov = new WebsocketProvider(
        `${wsUrl}/yjs`,  // base URL
        boardId,          // room name (appended as path segment by y-websocket)
        doc,
        {
          params: {
            ...(ticket      ? { ticket }         : {}),
            ...(shareToken  ? { st: shareToken } : {}),
          },
          connect: true,
        }
      );

      hasSyncedOnceRef.current = false;
      setLiveRole(null);
      setAccessRevoked(false);

      // Live role change pushed by the server (editor demoted to viewer, etc.).
      // Registering a handler for our custom message type is y-websocket's
      // supported extension point — readMessage dispatches on provider.messageHandlers.
      prov.messageHandlers[MSG_ACCESS] = (_enc, decoder) => {
        try {
          const role = decoding.readVarString(decoder);
          if (role) setLiveRole(role);
        } catch { /* malformed frame — ignore */ }
      };

      // Access fully revoked: the server closes with CLOSE_ACCESS_REVOKED. Stop
      // y-websocket from auto-reconnecting (it would loop against a server that
      // now denies this user) and flag the consumer to route the user away.
      const onConnectionClose = (event) => {
        if (event && event.code === CLOSE_ACCESS_REVOKED) {
          prov.shouldConnect = false; // suppress the pending reconnect timer
          prov.disconnect();
          setAccessRevoked(true);
        }
      };

      const onSync = (isSynced) => {
        if (isSynced) {
          hasSyncedOnceRef.current = true;
          setSynced(true);
        }
        // Don't set synced=false on disconnect — the canvas should stay mounted
        // so the board canvas isn't destroyed and rebuilt.
      };

      // On every disconnect, fetch a fresh single-use ticket so the next
      // reconnect attempt has a valid credential. Tickets are consumed on
      // first use (30s TTL), so reusing the old ticket would be rejected by
      // the server's upgrade gate.
      const onStatus = async ({ status }) => {
        if (status === 'disconnected') {
          if (!hasSyncedOnceRef.current) {
            // Only show loading if we've never synced at all (first connection attempt)
            setSynced(false);
          }
          // Refresh the ticket before y-websocket's reconnect timer fires.
          const newTicket = await fetchWsTicket();
          if (newTicket && !cancelled) prov.params.ticket = newTicket;
        }
        // If we've synced before, keep synced=true so the canvas stays mounted
      };

      prov.on('connection-close', onConnectionClose);
      prov.on('sync', onSync);
      prov.on('status', onStatus);

      // Set state so consumers re-render with the new ydoc/provider
      setYdoc(doc);
      setProvider(prov);

      // Store handler refs so the cleanup return can remove the exact listeners.
      registeredHandlers = { onSync, onStatus, onConnectionClose };
    };

    init();

    return () => {
      cancelled = true;
      if (registeredHandlers && prov) {
        const { onSync, onStatus, onConnectionClose } = registeredHandlers;
        prov.off('sync', onSync);
        prov.off('status', onStatus);
        prov.off('connection-close', onConnectionClose);
        delete prov.messageHandlers[MSG_ACCESS];
        prov.destroy();
      }
      if (doc) doc.destroy();
      setYdoc(null);
      setProvider(null);
      setSynced(false);
      setLiveRole(null);
      setAccessRevoked(false);
      hasSyncedOnceRef.current = false;
    };
  }, [boardId]);

  return { ydoc, provider, synced, liveRole, accessRevoked };
}
