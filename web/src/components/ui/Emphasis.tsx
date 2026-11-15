import { Fragment } from 'react';

// "Find the scent that *stays* with you." -> the starred word in italic gold.
// Builds React elements from plain text: no HTML is ever parsed, so editor-supplied
// copy cannot inject markup even if validation were bypassed.
export function Emphasis({ text, className = 'italic text-antique' }: { text: string; className?: string }) {
  const parts = text.split('*');
  // Only *pairs* emphasise. With an odd number of stars the last one has no partner, so it is
  // shown as a literal "*" and the text after it stays plain (a typo must not italicise the rest).
  const paired = parts.length % 2 === 1 ? parts.length : parts.length - 1;
  return (
    <>
      {parts.map((part, i) => {
        if (i % 2 === 1 && i < paired && part) return <em key={i} className={className}>{part}</em>;
        return <Fragment key={i}>{i === paired && i > 0 && paired < parts.length ? '*' : ''}{part}</Fragment>;
      })}
    </>
  );
}
