'use client';

import { useSyncExternalStore } from 'react';
import { isApiReachable, subscribeApiStatus } from './apiStatus';

function subscribe(onChange: () => void): () => void {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  const unsubscribeApi = subscribeApiStatus(onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
    unsubscribeApi();
  };
}

/**
 * True while the browser says it has internet and the last API call reached the server (Section 18, #10).
 */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine && isApiReachable(),
    () => true,
  );
}
