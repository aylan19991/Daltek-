interface LogoProps {
  size?: number
  showText?: boolean
  className?: string
}

export function Logo({ size = 40, showText = true, className = '' }: LogoProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 512 512"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
      >
        <defs>
          <linearGradient id="logoGradient" x1="0" y1="0" x2="512" y2="512" gradientUnits="userSpaceOnUse">
            <stop stopColor="#1a80f5" />
            <stop offset="1" stopColor="#142d57" />
          </linearGradient>
        </defs>
        <rect width="512" height="512" rx="112" fill="url(#logoGradient)" />
        <path
          d="M160 128 L160 384 L240 384 C320 384 368 336 368 256 C368 176 320 128 240 128 L160 128 Z"
          stroke="white"
          strokeWidth="24"
          strokeLinejoin="round"
          fill="none"
        />
        <circle cx="372" cy="140" r="28" fill="#f97316" />
      </svg>
      {showText && (
        <span className="font-display text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">
          DALTEK
        </span>
      )}
    </div>
  )
}
