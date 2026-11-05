import React from 'react';

export const BritLogo: React.FC<{ size?: number; showText?: boolean; inverted?: boolean }> = ({
  size = 32,
  showText = true,
  inverted = false,
}) => {
  return (
    <div className="inline-flex items-center gap-2.5 shrink-0 select-none">
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Logo Brit Auto"
        className="shrink-0"
      >
        <rect
          x="1"
          y="1"
          width="38"
          height="38"
          rx="8"
          fill={inverted ? '#2C4F7C' : '#1F3A5F'}
          stroke="#C9A227"
          strokeWidth="1.5"
        />
        <text
          x="20"
          y="25"
          fontFamily="IBM Plex Mono, monospace"
          fontSize="15"
          fontWeight="600"
          fill="#FFFFFF"
          textAnchor="middle"
        >
          BA
        </text>
      </svg>
      {showText && (
        <span
          className={`font-semibold text-[16px] leading-6 tracking-tight whitespace-nowrap ${
            inverted ? 'text-white' : 'text-[var(--text)]'
          }`}
        >
          Brit Auto
        </span>
      )}
    </div>
  );
};

export const BritishGarageIllustration: React.FC<{ className?: string }> = () => null;
export const CarOnLiftIllustration: React.FC<{ className?: string }> = () => null;
