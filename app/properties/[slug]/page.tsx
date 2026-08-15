import Link from "next/link";
import { notFound } from "next/navigation";
import { properties, findProperty } from "@/lib/data";
import PropertyScoreView from "@/components/PropertyScoreView";
import Header from "@/components/Header";

export function generateStaticParams() {
  return properties.map((prop) => ({ slug: prop.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const prop = findProperty(decodeURIComponent((await params).slug));
  return {
    title: prop ? `${prop.name} · Online Presence Score` : "Property not found",
    description: prop
      ? `Online presence score for ${prop.name} in ${prop.city}, ${prop.country}.`
      : "Property not found",
  };
}

export default async function PropertyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const prop = findProperty(decodeURIComponent(slug));
  if (!prop) notFound();

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
        <Link
          href="/"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
          Back to search
        </Link>
        <PropertyScoreView property={prop} />
      </main>
      <footer className="border-t border-zinc-200 py-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        HospiScore · Hospitality OS
      </footer>
    </div>
  );
}