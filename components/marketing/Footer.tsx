import Link from "next/link";

const COLUMNS = [
  {
    title: "Platform",
    links: [
      { label: "All 23 modules", href: "/platform" },
      { label: "Booking Engine", href: "/platform/bookingengine" },
      { label: "Channel Manager", href: "/platform/channel" },
      { label: "Restaurant POS", href: "/platform/pos" },
      { label: "Housekeeping", href: "/platform/housekeeping" },
      { label: "Revenue & Pricing", href: "/platform/revenue" },
      { label: "AI Assistant", href: "/platform/ai" },
    ],
  },
  {
    title: "Solutions",
    links: [
      { label: "Hotels", href: "/solutions/hotels" },
      { label: "Hotel Groups", href: "/solutions/groups" },
      { label: "Hostels", href: "/solutions/hostels" },
      { label: "Vacation Rentals", href: "/solutions/vacation-rentals" },
      { label: "Boutique Hotels", href: "/solutions/boutique-hotels" },
      { label: "Resorts", href: "/solutions/resorts" },
      { label: "Serviced Apartments", href: "/solutions/serviced-apartments" },
      { label: "B&Bs & Guesthouses", href: "/solutions/bed-and-breakfast" },
      { label: "Hourly & Flexible Stays", href: "/solutions/hourly-flexible-stays" },
      { label: "Experimental Stays", href: "/solutions/experimental-stays" },
      { label: "All 10 solutions", href: "/solutions" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Free presence score", href: "/free-score" },
      { label: "Pricing", href: "/pricing" },
      { label: "Integrations", href: "/integrations" },
      { label: "Case studies", href: "/case-studies" },
      { label: "Blog", href: "/blog" },
      { label: "Knowledge base", href: "/knowledge-base" },
      { label: "Product updates", href: "/product-updates" },
      { label: "Migrate to HospiOS", href: "/migration" },
      { label: "FAQ", href: "/faq" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About us", href: "/about" },
      { label: "Careers", href: "/careers" },
      { label: "News", href: "/news" },
      { label: "Contact", href: "/contact" },
      { label: "Book a demo", href: "/demo" },
      { label: "Security", href: "/security" },
      { label: "Sign in", href: "/account" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="relative border-t border-zinc-800 bg-zinc-950 py-12">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-500/60 to-transparent" />
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div>
            <Link href="/" className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">
                H
              </span>
              <span className="text-lg font-semibold tracking-tight text-zinc-50">
                HospiOS
              </span>
            </Link>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-zinc-400">
              The all-in-one hotel PMS. Front desk, housekeeping, POS, finance,
              HRMS, channel manager and AI automation — every part of your
              property in one platform.
            </p>
            <Link
              href="/demo"
              className="mt-4 inline-flex items-center rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              Book a demo
            </Link>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
                {col.title}
              </h3>
              <ul className="mt-3 flex flex-col gap-2">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="link-underline text-sm text-zinc-400 transition hover:text-indigo-400"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-zinc-800 pt-6 text-xs text-zinc-500 sm:flex-row">
          <p>© {new Date().getFullYear()} HospiOS · Hospitality Operating System</p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href="/free-score" className="hover:text-indigo-400">
              Free score
            </Link>
            <Link href="/privacy" className="hover:text-indigo-400">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-indigo-400">
              Terms
            </Link>
            <Link href="/security" className="hover:text-indigo-400">
              Security
            </Link>
            <Link href="/account" className="hover:text-indigo-400">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
