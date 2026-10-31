export default function KenyanFlag({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 36 24"
      role="img"
      aria-label="Kenyan flag"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="36" height="24" fill="#006600" />
      <path d="M0 0h36v7H0z" fill="#111" />
      <path d="M0 7h36v2H0zM0 15h36v2H0z" fill="#fff" />
      <path d="M0 9h36v6H0z" fill="#bb0000" />
      <path
        d="M18 4.4c-1.1 1.5-2.15 4.35-2.15 7.55S16.9 18 18 19.6c1.1-1.6 2.15-4.45 2.15-7.65S19.1 5.9 18 4.4Z"
        fill="#fff"
        stroke="#111"
        strokeWidth=".45"
      />
      <path
        d="M18 5.8c-.7 1.35-1.25 3.55-1.25 6.15S17.3 16.75 18 18.1c.7-1.35 1.25-3.55 1.25-6.15S18.7 7.15 18 5.8Z"
        fill="#111"
      />
      <path d="m13.35 6.8 9.3 10.4m0-10.4-9.3 10.4" fill="none" stroke="#fff" strokeWidth=".6" />
      <path d="m13.35 6.8 9.3 10.4m0-10.4-9.3 10.4" fill="none" stroke="#111" strokeWidth=".22" />
    </svg>
  );
}
