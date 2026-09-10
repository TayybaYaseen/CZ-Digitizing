import { useCallback, useEffect, useRef, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { apiFetch } from './api-client';

// docs/specs/2026-08-29-18-mobile-app-android-ios.md AC-16 (aspect A-023): "When connectivity is
// restored, the app re-fetches current state from the API rather than trusting any locally cached
// state as authoritative." No offline-write queueing/local-first merge — deliberately out of scope
// per spec §7 and architecture's own "cache critical screens" guidance, nothing more.
export type ApiQueryState<T> =
  | { status: 'loading'; data: undefined; error: undefined }
  | { status: 'success'; data: T; error: undefined }
  | { status: 'error'; data: undefined; error: unknown }
  | { status: 'offline'; data: undefined; error: undefined };

export function useApiQuery<T>(path: string | null, deps: unknown[] = []): ApiQueryState<T> & { refetch: () => void } {
  const [state, setState] = useState<ApiQueryState<T>>({ status: 'loading', data: undefined, error: undefined });
  const pathRef = useRef(path);
  pathRef.current = path;

  const fetchNow = useCallback(async () => {
    if (!pathRef.current) return;
    const net = await NetInfo.fetch();
    if (net.isConnected === false) {
      setState({ status: 'offline', data: undefined, error: undefined });
      return;
    }
    setState((prev) => (prev.status === 'success' ? prev : { status: 'loading', data: undefined, error: undefined }));
    try {
      const data = await apiFetch<T>(pathRef.current);
      setState({ status: 'success', data, error: undefined });
    } catch (error) {
      setState({ status: 'error', data: undefined, error });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void fetchNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);

  // AC-16 — always refetch (never trust cache) when connectivity is restored.
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((net) => {
      if (net.isConnected) void fetchNow();
    });
    return unsubscribe;
  }, [fetchNow]);

  return { ...state, refetch: fetchNow };
}
