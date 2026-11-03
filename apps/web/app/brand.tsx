/** ScholarTasks logo: a graduation cap whose tassel ends in a check mark. */
export function BrandMark({ className = "brand-mark" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" aria-hidden="true">
      <rect width="40" height="40" rx="10" fill="#f2b33d" />
      <path d="M20 9 4.5 16 20 23l15.5-7L20 9Z" fill="#14305a" />
      <path d="M11 19.5v6.2c0 1.6 4 3.8 9 3.8s9-2.2 9-3.8v-6.2L20 23.6l-9-4.1Z" fill="#14305a" />
      <path d="m24.5 29.5 3 3 6-6.5" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m24.5 29.5 3 3 6-6.5" fill="none" stroke="#14305a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Brand() {
  return (
    <a className="brand" href="/">
      <BrandMark />
      <span>ScholarTasks</span>
    </a>
  );
}
