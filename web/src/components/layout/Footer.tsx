import { Link } from 'react-router-dom';
import { useContent } from '@/api/content';

const COLS = [
  { title: 'Shop', links: [['All fragrances', '/shop'], ['Gifting', '/gifting'], ['Discovery sets', '/gifting']] },
  { title: 'Help', links: [['Track your order', '/help'], ['Shipping & delivery', '/help'], ['Returns', '/help'], ['FAQ', '/help']] },
  { title: 'SmellMe', links: [['Our story', '/our-story'], ['Scent finder', '/scent-finder'], ['Corporate gifting', '/gifting']] },
];

const digits = (s: string) => s.replace(/\D/g, '');
// Only ever link http(s) addresses an editor typed in: a "javascript:" link must never render.
const safeUrl = (u: string) => (/^https?:\/\//i.test(u) ? u : '');

export function Footer() {
  const { data } = useContent('site');
  const s = data?.site;
  const hasContact = !!(s && (s.whatsapp || s.phone || s.email || s.hours));

  return (
    <footer className="border-t border-line bg-pearl">
      <div className="mx-auto flex max-w-[1360px] flex-col gap-14 px-4 pb-10 pt-[72px] md:px-10">
        <div className="flex flex-wrap gap-x-4 gap-y-8 md:gap-12">
          <div className="flex min-w-0 flex-[2_1_300px] flex-col gap-[18px]">
            <Link to="/" className="font-serif text-[40px] font-medium leading-none">Smell<em className="text-antique">Me</em></Link>
            {s?.tagline && <p className="max-w-[340px] text-[15px] leading-[1.7] text-taupe">{s.tagline}</p>}
            <div className="flex flex-wrap gap-3 text-sm">
              {s && safeUrl(s.instagram) && <a href={safeUrl(s.instagram)} target="_blank" rel="noopener noreferrer" className="underline">Instagram</a>}
              {s && safeUrl(s.youtube) && <a href={safeUrl(s.youtube)} target="_blank" rel="noopener noreferrer" className="underline">YouTube</a>}
              {s?.whatsapp && digits(s.whatsapp) && <a href={`https://wa.me/${digits(s.whatsapp)}`} target="_blank" rel="noopener noreferrer" className="underline">WhatsApp</a>}
            </div>
          </div>
          {COLS.map((c) => (
            <nav key={c.title} aria-label={c.title} className="flex min-w-0 flex-[1_1_160px] flex-col gap-3">
              <span className="eyebrow mb-1 !tracking-[0.2em]">{c.title}</span>
              {c.links.map(([label, to]) => <Link key={label} to={to} className="flex min-h-7 items-center text-[15px] hover:text-antique">{label}</Link>)}
            </nav>
          ))}
          {hasContact && (
            <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-3">
              <span className="eyebrow mb-1 !tracking-[0.2em]">Talk to us</span>
              {s.whatsapp && <span className="text-[15px]">WhatsApp {s.whatsapp}</span>}
              {s.phone && <a href={`tel:+${digits(s.phone)}`} className="text-[15px]">{s.phone}</a>}
              {s.email && <a href={`mailto:${s.email}`} className="break-all text-[15px]">{s.email}</a>}
              {s.hours && <span className="text-sm leading-relaxed text-taupe">{s.hours}</span>}
            </div>
          )}
        </div>
        <div className="flex flex-wrap justify-between gap-4 border-t border-[#DCCFBA] pt-6 text-[13px] text-taupe">
          <span>© {new Date().getFullYear()} SmellMe. All rights reserved.</span>
          <span>Pay by UPI · Delivered across India</span>
          <div className="flex gap-5">
            <Link to="/help">Privacy</Link>
            <Link to="/help">Terms</Link>
            <Link to="/help">Shipping &amp; returns</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
