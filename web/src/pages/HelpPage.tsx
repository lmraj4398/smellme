import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useContent, CONTACT_TOPICS } from '@/api/content';
import { ContactForm } from '@/components/ContactForm';
import { Emphasis } from '@/components/ui/Emphasis';
import { Container, ErrorState, Eyebrow, Loading } from '@/components/ui/States';
import { usePageTitle } from '@/hooks/usePageTitle';
import { normalizeOrderNo } from '@/lib/gifting';
import { cn } from '@/lib/utils';

// /help?topic=gifting preselects the right topic when arriving from the Gifting page.
const TOPIC_BY_KEY: Record<string, (typeof CONTACT_TOPICS)[number]> = { gifting: 'Corporate or wedding gifting', order: 'An order I placed', returns: 'Returns & refunds' };
const digits = (s: string) => s.replace(/\D/g, '');

export default function HelpPage() {
  usePageTitle('Help & FAQ', 'Answers about orders, payment, authenticity and samples — or send us a message.');
  const [params] = useSearchParams();
  const help = useContent('help');
  const site = useContent('site');
  const [cat, setCat] = useState(0);
  const navigate = useNavigate();
  const [orderNo, setOrderNo] = useState('');
  const [trackError, setTrackError] = useState('');

  // Orders are private, so tracking opens the order page: signed-in shoppers see it, everyone else signs in first and lands there.
  function track(e: React.FormEvent) {
    e.preventDefault();
    const no = normalizeOrderNo(orderNo);
    if (!no) return setTrackError('Enter your order number, like SM-001234. You’ll find it in your WhatsApp confirmation.');
    setTrackError('');
    navigate(`/order/${no}`);
  }

  if (help.isLoading) return <Loading />;
  if (help.isError || !help.data) return <ErrorState onRetry={() => void help.refetch()} />;
  const c = help.data;
  const s = site.data?.site;
  const cats = c.faq.categories.filter((x) => x.faqs.length > 0);
  const current = cats[Math.min(cat, cats.length - 1)];
  const channels = s
    ? [
        s.whatsapp && { label: 'WhatsApp', value: s.whatsapp, href: `https://wa.me/${digits(s.whatsapp)}`, note: 'Fastest way to reach us' },
        s.email && { label: 'Email', value: s.email, href: `mailto:${s.email}`, note: 'We reply within one working day' },
        s.phone && { label: 'Call', value: s.phone, href: `tel:+${digits(s.phone)}`, note: s.hours },
      ].filter(Boolean) as { label: string; value: string; href: string; note: string }[]
    : [];

  return (
    <>
      <section className="bg-[radial-gradient(ellipse_60%_90%_at_50%_0%,#fff_0%,#F4EEE4_70%)]">
        <Container className="flex max-w-[900px] flex-col items-center gap-[22px] py-16 text-center md:py-[72px]">
          {c.hero.eyebrow && <Eyebrow>{c.hero.eyebrow}</Eyebrow>}
          <h1 className="font-serif text-[clamp(44px,5vw,72px)] font-normal leading-none"><Emphasis text={c.hero.heading} /></h1>
          <form onSubmit={track} noValidate className="mt-2 flex w-full max-w-[620px] flex-wrap gap-2.5 text-left">
            <label htmlFor="track-order" className="w-full text-sm font-medium">Track an order</label>
            <input
              id="track-order" value={orderNo} onChange={(e) => { setOrderNo(e.target.value); setTrackError(''); }} placeholder="Order number, e.g. SM-001234"
              autoComplete="off" aria-invalid={!!trackError} aria-describedby={trackError ? 'track-order-err' : undefined}
              className="min-h-[54px] flex-[1_1_280px] rounded-full border border-field bg-white px-[22px] text-[15px]"
            />
            <button type="submit" className="btn-primary min-h-[54px] px-8">Track</button>
            {trackError && <p id="track-order-err" role="alert" className="w-full text-sm text-danger">{trackError}</p>}
          </form>
        </Container>
      </section>

      {cats.length > 0 && current && (
        <Container className="flex flex-wrap items-start gap-14 py-16 md:py-[72px]">
          <nav aria-label="Help topics" className="-mx-4 flex max-w-none flex-[1_1_100%] gap-1 overflow-x-auto px-4 md:mx-0 md:max-w-[300px] md:flex-[1_1_240px] md:flex-col md:overflow-visible md:px-0">
            {cats.map((x, i) => (
              <button key={x.name} type="button" aria-pressed={i === cat} onClick={() => setCat(i)}
                className={cn('min-h-[52px] shrink-0 whitespace-nowrap border-l-2 px-[18px] text-left text-[15px] md:whitespace-normal', i === cat ? 'border-antique bg-pearl font-medium' : 'border-transparent text-[#4A4238]')}>
                {x.name}
              </button>
            ))}
          </nav>
          <div className="flex min-w-0 flex-[999_1_560px] flex-col">
            <h2 className="mb-5 font-serif text-[44px] font-normal leading-[1.05]">{current.name}</h2>
            <div className="border-t border-ink">
              {/* key: switching topic remounts, so the first answer opens by default again */}
              {current.faqs.map((f, i) => (
                <details key={`${current.name}-${i}`} open={i === 0} className="group border-b border-line">
                  <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 text-[17px] [&::-webkit-details-marker]:hidden">
                    {f.q}<span aria-hidden className="text-xl text-antique group-open:rotate-45">+</span>
                  </summary>
                  {f.a && <p className="mb-[22px] max-w-[720px] whitespace-pre-line text-[15px] leading-[1.75] text-[#4A4238]">{f.a}</p>}
                </details>
              ))}
            </div>
          </div>
        </Container>
      )}

      <section className="bg-pearl">
        <Container className="flex flex-wrap gap-14 py-16 md:py-[88px]">
          <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-5">
            <h2 className="font-serif text-[clamp(36px,4vw,52px)] font-normal leading-[1.05]"><Emphasis text={c.contact.heading} /></h2>
            {c.contact.body && <p className="leading-[1.7] text-[#4A4238]">{c.contact.body}</p>}
            {channels.map((ch) => (
              <div key={ch.label} className="flex flex-col gap-1 border-t border-[#DCCFBA] py-[18px]">
                <span className="text-xs uppercase tracking-[0.2em] text-antique">{ch.label}</span>
                <a href={ch.href} className="break-all text-[17px] hover:text-antique" {...(ch.href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{ch.value}</a>
                {ch.note && <span className="text-[13px] text-taupe">{ch.note}</span>}
              </div>
            ))}
          </div>
          <div className="min-w-0 flex-[1_1_480px]">
            <ContactForm initialTopic={TOPIC_BY_KEY[params.get('topic') ?? '']} />
          </div>
        </Container>
      </section>
    </>
  );
}
