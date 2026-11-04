/** ScholarTasks logo: the app icon (cap, books, A+ report card and award ribbon). */
export function BrandMark({ className = "brand-mark" }: { className?: string }) {
  return <img className={className} src="/logo-mark.png" alt="" aria-hidden="true" width={256} height={256} />;
}

export function Brand({ href = "/", large = false }: { href?: string; large?: boolean }) {
  return (
    <a className={large ? "brand brand-lg" : "brand"} href={href}>
      <BrandMark />
      <span>ScholarTasks</span>
    </a>
  );
}
