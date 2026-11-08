'use client';

import { useEffect, useRef } from 'react';

const TOUCH_EVENTS = ['pointerdown', 'touchstart', 'mousedown', 'keydown'] as const;

/** Calls onIdle when nothing has been touched for `ms`. Every touch starts the wait again (BR10). */
export function useIdleTimer(ms: number, onIdle: () => void): void {
  const latest = useRef(onIdle);
  latest.current = onIdle;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const restart = () => {
      clearTimeout(timer);
      timer = setTimeout(() => latest.current(), ms);
    };
    restart();
    TOUCH_EVENTS.forEach((name) => document.addEventListener(name, restart, true));
    return () => {
      clearTimeout(timer);
      TOUCH_EVENTS.forEach((name) => document.removeEventListener(name, restart, true));
    };
  }, [ms]);
}
