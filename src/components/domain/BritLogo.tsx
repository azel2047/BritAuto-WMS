import React from 'react';

export const BritLogo: React.FC<{ size?: number; showText?: boolean }> = ({ size = 40, showText = true }) => {
  return (
    <div className="inline-flex items-center gap-3 shrink-0 select-none">
      <svg
        width={size}
        height={size}
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Logo Brit Auto"
        className="shrink-0"
      >
        <circle cx="60" cy="60" r="56" fill="#1f3a5f" stroke="#c9a227" strokeWidth="5" />
        <circle cx="60" cy="60" r="47" fill="none" stroke="#c9a227" strokeWidth="1.5" strokeDasharray="4 3" />
        <text
          x="60"
          y="65"
          fontFamily="Plus Jakarta Sans, Inter, sans-serif"
          fontSize="38"
          fontWeight="700"
          fill="#ffffff"
          textAnchor="middle"
        >
          BA
        </text>
        <text
          x="60"
          y="89"
          fontFamily="Plus Jakarta Sans, Inter, sans-serif"
          fontSize="11"
          fontWeight="700"
          letterSpacing="1.5"
          fill="#c9a227"
          textAnchor="middle"
        >
          BRIT AUTO
        </text>
      </svg>
      {showText && (
        <div className="flex flex-col">
          <span className="font-display font-bold text-base tracking-tight leading-tight whitespace-nowrap">
            Brit Auto WMS
          </span>
        </div>
      )}
    </div>
  );
};
