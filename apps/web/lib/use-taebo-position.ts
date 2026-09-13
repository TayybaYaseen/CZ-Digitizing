'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Taebo launcher drag/positioning (docs/specs/2026-08-28-15-taebo-chatbot.md §10.8-§10.10).
// Only the closed-state launcher is draggable — a client-side UI preference, not application
// state, so it lives in localStorage rather than any backend table (§10.10 explicitly rules out
// new backend storage for this).

const POSITION_KEY = 'czd.taebo.position';
const EDGE_MARGIN = 16;
const DRAG_THRESHOLD_PX = 6;
// The launcher is now the full-body panda itself (portrait aspect, ~2:3), not a square circular
// avatar — a single conservative bounding box (the desktop-max ~130px-tall size, per the design
// spec's 90-130px desktop / 70-95px mobile range) covers every breakpoint for clamping purposes,
// same "slightly generous margin, no per-breakpoint tracking" approach as before.
const LAUNCHER_WIDTH = 100;
const LAUNCHER_HEIGHT = 140;

export interface TaeboPosition {
  left: number;
  top: number;
}

function clamp(pos: TaeboPosition): TaeboPosition {
  if (typeof window === 'undefined') return pos;
  const maxLeft = Math.max(window.innerWidth - LAUNCHER_WIDTH - EDGE_MARGIN, EDGE_MARGIN);
  const maxTop = Math.max(window.innerHeight - LAUNCHER_HEIGHT - EDGE_MARGIN, EDGE_MARGIN);
  return {
    left: Math.min(Math.max(pos.left, EDGE_MARGIN), maxLeft),
    top: Math.min(Math.max(pos.top, EDGE_MARGIN), maxTop),
  };
}

// Default: bottom-right, matching the widget's original fixed `bottom-* right-*` anchor.
function defaultPosition(): TaeboPosition {
  if (typeof window === 'undefined') return { left: 0, top: 0 };
  return clamp({
    left: window.innerWidth - LAUNCHER_WIDTH - EDGE_MARGIN,
    top: window.innerHeight - LAUNCHER_HEIGHT - EDGE_MARGIN,
  });
}

function readStored(): TaeboPosition | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(POSITION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.left !== 'number' || typeof parsed?.top !== 'number') return null;
    return clamp(parsed);
  } catch {
    return null;
  }
}

export function useTaeboPosition() {
  // null until the mount effect resolves — avoids an SSR/client mismatch, since the default
  // position depends on window size that doesn't exist on the server.
  const [position, setPosition] = useState<TaeboPosition | null>(null);
  const draggingRef = useRef(false);
  const movedRef = useRef(false);
  const startRef = useRef<{ pointerX: number; pointerY: number; left: number; top: number } | null>(null);
  const positionRef = useRef<TaeboPosition | null>(null);
  positionRef.current = position;

  useEffect(() => {
    setPosition(readStored() ?? defaultPosition());
  }, []);

  useEffect(() => {
    function onResize() {
      setPosition((prev) => (prev ? clamp(prev) : prev));
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return; // primary mouse button (or any touch/pen) only
    draggingRef.current = true;
    movedRef.current = false;
    startRef.current = {
      pointerX: e.clientX,
      pointerY: e.clientY,
      left: positionRef.current?.left ?? 0,
      top: positionRef.current?.top ?? 0,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (!draggingRef.current || !startRef.current) return;
    const dx = e.clientX - startRef.current.pointerX;
    const dy = e.clientY - startRef.current.pointerY;
    if (!movedRef.current && Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) movedRef.current = true;
    if (!movedRef.current) return;
    setPosition(clamp({ left: startRef.current.left + dx, top: startRef.current.top + dy }));
  }, []);

  // Returns true when this pointer sequence was a genuine drag (moved past the threshold) so the
  // caller can suppress the "open chat" action a synthetic click would otherwise fire next —
  // without this, releasing a drag would also open the chat panel (Part 6's accidental-open bug).
  const onPointerUp = useCallback((e: React.PointerEvent<HTMLElement>) => {
    const wasDrag = draggingRef.current && movedRef.current;
    draggingRef.current = false;
    startRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (wasDrag && positionRef.current) {
      try {
        window.localStorage.setItem(POSITION_KEY, JSON.stringify(positionRef.current));
      } catch {
        // best-effort only — a UI position preference, not critical state
      }
    }
    return wasDrag;
  }, []);

  const reset = useCallback(() => {
    setPosition(defaultPosition());
    try {
      window.localStorage.removeItem(POSITION_KEY);
    } catch {
      // best-effort
    }
  }, []);

  return {
    position,
    launcherSize: { width: LAUNCHER_WIDTH, height: LAUNCHER_HEIGHT },
    onPointerDown,
    onPointerMove,
    onPointerUp,
    reset,
  };
}
