/**
 * Brand logo. Renders the black wordmark in light mode and the white one in dark mode
 * (swapped purely with CSS so there's no flash). Drop the assets at:
 *   apps/web/public/logo.png        — black, for light mode
 *   apps/web/public/logo-white.png  — white, for dark mode
 */
export function Logo({ className = 'h-8' }: { className?: string }) {
  const base = `w-auto object-contain ${className}`
  return (
    <span className="inline-flex items-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="TOP - The Outsource Pro" className={`${base} dark:hidden`} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-white.png" alt="TOP - The Outsource Pro" className={`hidden ${base} dark:block`} />
    </span>
  )
}
