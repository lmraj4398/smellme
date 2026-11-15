import { useEffect } from 'react';

// Stands in for each prototype page until it is rebuilt against the real API.
export default function PlaceholderPage({ title }: { title: string }) {
  useEffect(() => {
    document.title = `${title} - SmellMe`;
  }, [title]);

  return (
    <section className="mx-auto max-w-[1360px] px-4 py-24 text-center md:px-10">
      <span className="eyebrow">Coming together</span>
      <h1 className="mt-3 font-serif text-5xl">{title}</h1>
      <p className="mx-auto mt-4 max-w-md text-taupe">This page is converted from the prototype in a later phase.</p>
    </section>
  );
}
