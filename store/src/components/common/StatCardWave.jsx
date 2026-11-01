import React from "react";

export function StatCardWave({ color, id }) {
  const gradientId = `wave-grad-${id}`;
  return (
    <svg
      className="stat-card-wave"
      viewBox="0 0 160 55"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={color} stopOpacity="0.0" />
          <stop offset="30%" stopColor={color} stopOpacity="0.12" />
          <stop offset="70%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0.35" />
        </linearGradient>
      </defs>
      <path
        d="M0,55 C25,53 35,32 55,30 C75,28 90,36 110,30 C130,24 145,10 160,12 L160,55 Z"
        fill={`url(#${gradientId})`}
      />
    </svg>
  );
}

