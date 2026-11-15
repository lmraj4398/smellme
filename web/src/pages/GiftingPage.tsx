import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useContent } from '@/api/content';
import { Emphasis } from '@/components/ui/Emphasis';
import { Container, ErrorState, Eyebrow, H2, Loading } from '@/components/ui/States';
import { usePageTitle } from '@/hooks/usePageTitle';
import { BUDGETS, inBudget, priceFromText, type BudgetId } from '@/lib/gifting';
import { Pill } from '@/components/ui/Pill';

const TINTS = ['#F1E5D1', '#F6E6E3', '#E5ECEF', '#E6EADF', '#F3E6D6', '#EEE8F0'];
const VIALS = [['#B7C09A', '#D7A260', '#EBD7B5', '#BCD5DE'], ['#D9A0A0', '#B49A74', '#D2B48A'], ['#BCD5DE', '#EBD7B5'], ['#B7C09A', '#D7A260', '#AE7E52', '#C8B9D3']];

// The hero chips go straight to the shop, filtered the way the shopper described the recipient.
const RECIPIENTS = [
  { label: 'For her', to: '/shop?gender=women' },
  { label: 'For him', to: '/shop?gender=men' },
  { label: 'For anyone', to: '/shop?gender=unisex' },
];

export default function GiftingPage() {
  const [budget, setBudget] = useState<BudgetId>('all');
  const [engraving, setEngraving] = useState('Aanya');
  usePageTitle('Gifting', 'Hand-wrapped fragrance gifts with a handwritten note, engraving and custom boxes for weddings and corporate gifting.');
  const { data: c, isLoading, isError, refetch } = useContent('gifting');
  if (isLoading) return <Loading />;
  if (isError || !c) return <ErrorState onRetry={() => void refetch()} />;
  // Keep each set's original index so its tint and vials don't shift when the filter changes.
  const shownSets = c.sets.items.map((s, i) => ({ s, i })).filter(({ s }) => inBudget(s.price_text, budget));

  return (
    <>
      <section className="bg-[radial-gradient(ellipse_60%_80%_at_30%_30%,#fff_0%,#F6E6E3_55%,#F4EEE4_100%)]">
        <Container className="flex flex-wrap items-center gap-12 py-16 md:py-20">
          <div className="flex min-w-0 flex-[1_1_460px] flex-col gap-6">
            {c.hero.eyebrow && <Eyebrow>{c.hero.eyebrow}</Eyebrow>}
            <h1 className="font-serif text-[clamp(48px,6vw,88px)] font-normal leading-none"><Emphasis text={c.hero.heading} /></h1>
            {c.hero.body && <p className="max-w-[460px] text-[17px] font-light leading-[1.7] text-[#4A4238]">{c.hero.body}</p>}
            <div role="group" aria-label="Who is it for" className="flex flex-wrap gap-2.5">
              {RECIPIENTS.map((r) => (
                <Link key={r.label} to={r.to} className="inline-flex min-h-11 items-center rounded-full border border-field bg-white px-5 text-sm hover:border-ink">{r.label}</Link>
              ))}
            </div>
            <div><Link to="/shop" className="btn-primary min-h-[54px] px-8">Shop fragrances to gift</Link></div>
          </div>
          <div aria-hidden className="flex min-w-0 flex-[1_1_420px] justify-center">
            <div className="relative aspect-square w-[min(100%,460px)]">
              <div className="absolute bottom-[8%] left-[11%] h-[62%] w-[78%] rounded border border-[#E2D2B7] bg-ivory shadow-[0_30px_60px_rgba(110,80,40,0.16)]" />
              <div className="absolute bottom-[56%] left-[11%] h-[14%] w-[78%] rounded border border-[#E2D2B7] bg-pearl" />
              <div className="absolute bottom-[8%] left-[45%] h-[76%] w-[10%] bg-gold" />
              <span className="absolute bottom-[24%] left-1/2 -translate-x-1/2 bg-ivory px-4 py-1 font-serif text-[34px]">Smell<em className="text-antique">Me</em></span>
            </div>
          </div>
        </Container>
      </section>

      {c.sets.items.length > 0 && (
        <section>
          <Container className="py-[72px] md:py-24">
            <div className="mb-10 flex flex-wrap items-end justify-between gap-5">
              <div className="flex flex-col gap-3.5">
                {c.sets.eyebrow && <Eyebrow>{c.sets.eyebrow}</Eyebrow>}
                <H2><Emphasis text={c.sets.heading} /></H2>
              </div>
              {/* Only offered when at least one set has a price we can read, otherwise every chip but "All" would be empty. */}
              {c.sets.items.some((s) => priceFromText(s.price_text) !== null) && (
                <div role="group" aria-label="Budget" className="-mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
                  {BUDGETS.map((b) => (
                    <Pill key={b.id} aria-pressed={budget === b.id} active={budget === b.id} onClick={() => setBudget(b.id)}>{b.label}</Pill>
                  ))}
                </div>
              )}
            </div>
            {shownSets.length === 0 && <p className="text-taupe">No gift sets in this budget yet. <button type="button" className="underline" onClick={() => setBudget('all')}>Show all</button>.</p>}
            <ul className="grid gap-6 md:grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))]">
              {shownSets.map(({ s, i }) => (
                <li key={i} className="flex flex-col gap-4">
                  <div className="relative flex aspect-square items-end justify-center gap-2.5 overflow-hidden rounded pb-[22%]" style={{ background: TINTS[i % TINTS.length] }}>
                    {s.image ? (
                      <img src={s.image} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                    ) : (
                      VIALS[i % VIALS.length].map((col) => (
                        <span key={col} aria-hidden className="flex flex-col items-center drop-shadow-[0_12px_12px_rgba(110,80,40,0.2)]">
                          <span className="h-3 w-4 rounded-sm bg-gold" />
                          <span className="h-[64px] w-[24px] rounded-md" style={{ background: `linear-gradient(100deg, rgba(255,255,255,0.6) 0 18%, transparent 36%), ${col}` }} />
                        </span>
                      ))
                    )}
                  </div>
                  {s.tag && <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-antique">{s.tag}</span>}
                  <h3 className="font-serif text-[28px] font-normal leading-[1.1]">{s.name}</h3>
                  {s.description && <p className="text-sm leading-relaxed text-taupe">{s.description}</p>}
                  <div className="mt-auto flex items-center justify-between gap-3">
                    <span className="text-[17px] font-medium">{s.price_text}</span>
                    {s.product_slug ? (
                      <Link to={`/product/${s.product_slug}`} className="inline-flex min-h-11 items-center rounded-full border border-ink px-5 text-xs uppercase tracking-[0.16em] hover:bg-pearl">View</Link>
                    ) : (
                      <Link to="/help?topic=gifting" className="inline-flex min-h-11 items-center rounded-full border border-ink px-5 text-xs uppercase tracking-[0.16em] hover:bg-pearl">Ask us</Link>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Container>
        </section>
      )}

      <section className="bg-pearl">
        <Container className="flex flex-wrap items-center gap-14 py-24">
          <div aria-hidden className="flex min-w-0 flex-[1_1_400px] justify-center">
            <div className="flex aspect-[4/5] w-[min(100%,420px)] items-end justify-center rounded-t-[220px] rounded-b-md bg-[radial-gradient(ellipse_at_50%_40%,#fff,#F1E5D1_70%)] pb-[16%]">
              <div className="flex flex-col items-center drop-shadow-[0_26px_30px_rgba(110,80,40,0.25)]">
                <span className="h-[38px] w-[60px] rounded-[6px_6px_2px_2px] bg-gradient-to-r from-[#A9874E] via-[#E3C98F] to-[#9C7A41]" />
                <span className="h-2.5 w-7 bg-[#CDB383]" />
                <span className="flex h-[210px] w-[170px] items-end justify-center rounded-[20px] bg-[#EBD7B5] px-3 pb-7 text-center font-serif text-2xl italic text-[#6E5226]">{engraving}</span>
              </div>
            </div>
          </div>
          <div className="flex min-w-0 flex-[1_1_440px] flex-col gap-[22px]">
            {c.personalise.eyebrow && <Eyebrow>{c.personalise.eyebrow}</Eyebrow>}
            <H2><Emphasis text={c.personalise.heading} /></H2>
            <ul className="flex flex-col gap-3 text-[16px] leading-relaxed text-[#4A4238]">
              <li>Engrave a name or short message on the bottle (up to 14 characters).</li>
              <li>A handwritten gift note on our card.</li>
              <li>Signature gift wrap{c.personalise.wrap_price_text ? ` — ${c.personalise.wrap_price_text}` : ''}.</li>
            </ul>
            <div className="flex flex-col gap-2">
              <label htmlFor="engraving-preview" className="text-sm font-medium">Preview your engraving</label>
              <input id="engraving-preview" value={engraving} maxLength={14} onChange={(e) => setEngraving(e.target.value)} className="field max-w-xs" />
              <p className="text-sm text-taupe">This is just a preview. Add your engraving, note and gift wrap to your bag when you check out.</p>
            </div>
            <div><Link to="/shop" className="btn-primary min-h-[54px] px-8">Choose a fragrance</Link></div>
          </div>
        </Container>
      </section>

      {c.occasions.items.length > 0 && (
        <section>
          <Container className="py-24">
            <h2 className="mb-9 text-center font-serif text-[clamp(36px,4vw,52px)] font-normal leading-[1.05]"><Emphasis text={c.occasions.heading} /></h2>
            <ul className="grid grid-cols-2 gap-4 md:grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))]">
              {c.occasions.items.map((o, i) => (
                <li key={i}>
                  <Link to="/shop" className="flex flex-col items-center gap-3.5">
                    <div className="aspect-[3/4] w-full overflow-hidden rounded-t-[160px] rounded-b" style={{ background: TINTS[i % TINTS.length] }}>
                      {o.image && <img src={o.image} alt="" loading="lazy" className="h-full w-full object-cover" />}
                    </div>
                    <span className="font-serif text-[26px]">{o.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Container>
        </section>
      )}

      <Container className="pb-[104px]">
        <div className="flex flex-wrap items-center justify-between gap-8 rounded border border-gold bg-white p-[clamp(28px,5vw,64px)]">
          <div className="flex flex-[1_1_420px] flex-col gap-3">
            {c.corporate.eyebrow && <Eyebrow>{c.corporate.eyebrow}</Eyebrow>}
            <span className="font-serif text-[clamp(28px,3vw,40px)] leading-[1.1]">{c.corporate.heading}</span>
          </div>
          {c.corporate.cta_label && <Link to="/help?topic=gifting" className="btn-secondary min-h-[54px] px-8">{c.corporate.cta_label}</Link>}
        </div>
      </Container>
    </>
  );
}
