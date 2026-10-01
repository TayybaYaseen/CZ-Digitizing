import { useMemo } from 'react';
import { useAuth } from './auth-context';

// Guest checkout — which order routes this visitor reads their order through.
//   signed in -> /api/orders/:id… with their bearer token (unchanged behaviour);
//   guest     -> /api/guest-orders/:id…, authorized by the browser's httpOnly czd_guest_orders
//                cookie, which apiFetch already sends (credentials: 'include'). Nothing here can read
//                or forge that cookie; the API matches it against the order on every request.
// The paths after the base are identical (/:id, /:id/receipt, /:id/files, /:id/files/:fileId/download).
export function useOrderAccess() {
  const { user, accessToken, isReady } = useAuth();
  const guest = isReady && !user;
  // Memoized so effects can depend on it without re-running on every render.
  const headers = useMemo(() => (!guest && accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined), [guest, accessToken]);
  return {
    // Ready once auth has restored and, for a signed-in visitor, there is a token to send.
    ready: isReady && (guest || Boolean(accessToken)),
    guest,
    base: guest ? '/api/guest-orders' : '/api/orders',
    headers,
  };
}
