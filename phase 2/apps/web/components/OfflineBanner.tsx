'use client';

import { Icon } from './Icon';
import { useOnlineStatus } from './useOnlineStatus';

interface OfflineBannerProps {
  message: string;
  /** Red on S2, amber on every other screen (Section 18, #18). */
  tone?: 'red' | 'amber';
  /** A screen can force the banner on or off. Left out, the browser's online status decides. */
  offline?: boolean;
}

export function OfflineBanner({ message, tone = 'amber', offline }: OfflineBannerProps) {
  const online = useOnlineStatus();
  const isOffline = offline ?? !online;
  if (!isOffline) return null;

  const colours = tone === 'red' ? 'bg-errorBg text-error' : 'bg-warningBg text-warningText';
  return (
    <div role="status" className={`flex w-full items-center gap-s1 px-s3 py-s1 text-staff-body ${colours}`}>
      <Icon name="wifi-off" size={20} />
      <span>{message}</span>
    </div>
  );
}
