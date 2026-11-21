import Link from "next/link";

// The TENNISSA logo (replica/design/brand). Full ≥240px, compact 120–240px, icon <120px. Never recoloured.
const SRC = { full: "/brand/tennissa-logo.svg", compact: "/brand/tennissa-logo-compact.svg", icon: "/brand/tennissa-logo-icon.svg" };

export function Logo({ variant = "compact", href = "/", className = "h-8" }: {
  variant?: keyof typeof SRC; href?: string | null; className?: string;
}) {
  // eslint-disable-next-line @next/next/no-img-element
  const img = <img src={SRC[variant]} alt={href ? "" : "TENNISSA"} className={`${className} w-auto`} />;
  if (!href) return img;
  return (
    <Link href={href} aria-label="TENNISSA home" className="inline-flex rounded-sm">
      {img}
    </Link>
  );
}
