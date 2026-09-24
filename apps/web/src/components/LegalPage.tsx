import type { ReactNode } from "react";

import { Footer } from "../sections/Footer";
import { Nav } from "../sections/Nav";

/**
 * Shared shell for the legal pages: the site nav and footer around a single
 * readable column. Prose styling lives in the `.prose-legal` class in
 * index.css so the page bodies stay plain markup.
 */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white">
      <Nav />
      <main className="px-5 pb-16 pt-10 md:px-10 lg:px-20 lg:pb-24 lg:pt-14">
        <article className="prose-legal mx-auto w-full max-w-[760px]">
          <h1>{title}</h1>
          <p className="text-[13px] leading-5 text-muted">Last updated: {updated}</p>
          {children}
        </article>
      </main>
      <Footer />
    </div>
  );
}
