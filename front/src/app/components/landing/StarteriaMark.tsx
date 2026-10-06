import { useId } from 'react';

export function StarteriaMark({ className = 'h-7 w-7' }: { className?: string }) {
  const id = useId();

  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" fill="none" className={className}>
      <defs>
        <linearGradient id={`${id}-top`} x1="24" y1="5" x2="10" y2="16" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#818CF8" />
          <stop offset="1" stopColor="#4F46E5" />
        </linearGradient>
        <linearGradient id={`${id}-bottom`} x1="22" y1="16" x2="8" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3730A3" />
          <stop offset="1" stopColor="#2563EB" />
        </linearGradient>
      </defs>
      <path
        d="M23.6 7.6c-2.4-2.6-12.4-3.3-13.6 1.9-.9 3.9 3.6 5.3 7.4 6.4"
        stroke={`url(#${id}-top)`}
        strokeWidth="5.4"
        strokeLinecap="round"
      />
      <path
        d="M15.2 16.4c3.8 1.1 8.2 2.6 7.2 6.6-1.3 5.2-11.2 4.6-13.6 1.9"
        stroke={`url(#${id}-bottom)`}
        strokeWidth="5.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
