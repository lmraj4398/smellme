import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { catalogApi } from '@/api/catalog';
import { useContent, type HomeContent } from '@/api/content';
import { NewsletterForm } from '@/components/NewsletterForm';
import { Bottle } from '@/components/ui/Bottle';
import { Emphasis } from '@/components/ui/Emphasis';
import { Container, ErrorState, Eyebrow, H2, Loading, Skeleton } from '@/components/ui/States';
import { usePageTitle } from '@/hooks/usePageTitle';
import { cn } from '@/lib/utils';
import { ProductGrid } from '@/components/ProductGrid';
import { Pill } from '@/components/ui/Pill';

const ROMAN = ['i', 'ii', 'iii', 'iv', 'v', 'vi'];
const hscroll = 'flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] md:grid md:overflow-visible md:px-0 [&::-webkit-scrollbar]:hidden';

export default function HomePage() {
  usePageTitle(undefined, 'Authentic perfumes, attars and SmellMe Originals. Try any fragrance as a 2 ml sample before you buy the full bottle.');
  const { data: c, isLoading, isError, refetch } = useContent('home');
  if (isLoading) return <Loading />;
  if (isError || !c) return <ErrorState onRetry={() => void refetch()} />;

  return (
    <>
      <Hero c={c.hero} />
      {c.trust.items.length > 0 && <Trust items={c.trust.items} />}
      <Families c={c.families} />
      <Bestsellers c={c.bestsellers} />
      <Originals c={c.originals} />
      <DiscoveryAndQuiz discovery={c.discovery} quiz={c.quiz} />
      {c.moments.items.length > 0 && <Moments c={c.moments} />}
      {c.guides.items.length > 0 && <Guides c={c.guides} />}
      <Newsletter c={c.newsletter} />
    </>
  );
}

function Hero({ c }: { c: HomeContent['hero'] }) {
  return (
    <section className="relative overflow-hidden bg-[radial-gradient(ellipse_60%_70%_at_72%_45%,#fff_0%,#F6EFE3_55%,#FBF8F3_100%)]">
      <Container className="flex flex-wrap items-center gap-14 pb-14 pt-12 md:pb-[88px] md:pt-[72px]">
        <div className="flex min-w-0 flex-[1_1_480px] flex-col gap-7">
          {c.eyebrow && <Eyebrow>{c.eyebrow}</Eyebrow>}
          <h1 className="font-serif text-[clamp(52px,6.4vw,96px)] font-normal leading-none tracking-[-0.01em] [text-wrap:balance]"><Emphasis text={c.headline} /></h1>
          {c.body && <p className="max-w-[480px] text-lg font-light leading-[1.65] text-taupe">{c.body}</p>}
          <div className="flex flex-wrap gap-3.5">
            {c.primary_label && <Link to="/shop" className="btn-primary min-h-[54px] px-[34px]">{c.primary_label}</Link>}
            {c.secondary_label && <Link to="/scent-finder" className="btn-secondary min-h-[54px] px-[34px]">{c.secondary_label}</Link>}
          </div>
        </div>
        <div className="flex min-w-0 flex-[1_1_440px] justify-center">
          <div className="relative flex aspect-[5/6] w-[min(100%,500px)] items-end justify-center overflow-hidden rounded-t-[260px] rounded-b-md border border-[#E2D2B7] bg-gradient-to-b from-[#F1E5D1] to-champagne pb-16">
            {c.image ? (
              <img src={c.image} alt="" className="absolute inset-0 h-full w-full object-cover" fetchPriority="high" />
            ) : (
              <>
                <div aria-hidden className="absolute inset-[18px] rounded-t-[242px] rounded-b-sm border border-antique/35" />
                <div aria-hidden className="relative flex items-end gap-[18px]">
                  <Bottle liquid="#D7A260" mono="SD" className="!w-[150px]" />
                  <Bottle liquid="#B7C09A" className="!w-[104px]" />
                </div>
              </>
            )}
          </div>
        </div>
      </Container>
    </section>
  );
}

function Trust({ items }: { items: HomeContent['trust']['items'] }) {
  return (
    <section aria-label="Why SmellMe" className="border-y border-line bg-ivory">
      <Container className="grid grid-cols-2 gap-x-3 gap-y-[18px] py-7 md:grid-cols-[repeat(auto-fit,minmax(240px,1fr))] md:gap-6">
        {items.map((t, i) => (
          <div key={i} className="flex items-center gap-3.5">
            <span aria-hidden className="flex h-10 w-10 flex-none items-center justify-center rounded-full border border-gold font-serif text-lg italic text-antique">{ROMAN[i] ?? i + 1}</span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <strong className="text-[15px] font-medium">{t.title}</strong>
              {t.sub && <span className="text-[13px] text-taupe">{t.sub}</span>}
            </div>
          </div>
        ))}
      </Container>
    </section>
  );
}

function Families({ c }: { c: HomeContent['families'] }) {
  const { data } = useQuery({ queryKey: ['families'], queryFn: catalogApi.families, staleTime: 60_000 });
  if (!data?.length) return null;
  return (
    <section>
      <Container className="pb-10 pt-[72px] md:pt-[104px]">
        <div className="mb-11 flex flex-wrap items-end justify-between gap-5">
          <div className="flex flex-col gap-3.5">
            {c.eyebrow && <Eyebrow>{c.eyebrow}</Eyebrow>}
            <H2><Emphasis text={c.heading} /></H2>
          </div>
          <Link to="/shop" className="text-[13px] uppercase tracking-[0.16em] underline-offset-4 hover:underline">View all</Link>
        </div>
        <ul className={cn(hscroll, '-mx-4 md:mx-0 md:grid-cols-[repeat(auto-fit,minmax(190px,1fr))] md:gap-5')}>
          {data.map((f) => (
            <li key={f.id} className="w-[44%] flex-none snap-start md:w-auto">
              <Link to={`/shop?family=${f.slug}`} className="flex flex-col items-center gap-4">
                <div className="flex aspect-[3/4] w-full items-center justify-center rounded-t-[200px] rounded-b border border-antique/20" style={{ background: f.tint }}>
                  <span aria-hidden className="font-serif text-6xl italic opacity-90" style={{ color: f.ink }}>{f.name.slice(0, 2)}</span>
                </div>
                <div className="flex flex-col items-center gap-1 text-center">
                  <span className="font-serif text-2xl">{f.name}</span>
                  {f.notes_hint && <span className="text-[13px] text-taupe">{f.notes_hint}</span>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

const TABS = [
  { id: 'pop', label: 'Bestsellers', q: { sort: 'pop' as const } },
  { id: 'new', label: 'New arrivals', q: { sort: 'new' as const } },
  { id: 'under', label: 'Under ₹2,500', q: { sort: 'pop' as const, price_max: 250000 } },
];

function Bestsellers({ c }: { c: HomeContent['bestsellers'] }) {
  const [tab, setTab] = useState(TABS[0].id);
  const current = TABS.find((t) => t.id === tab)!;
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['home-products', tab],
    queryFn: () => catalogApi.products({ ...current.q, limit: 4 }),
    staleTime: 60_000,
  });

  return (
    <section>
      <Container className="py-[72px] md:py-[88px]">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
          <div className="flex flex-col gap-3.5">
            {c.eyebrow && <Eyebrow>{c.eyebrow}</Eyebrow>}
            <H2><Emphasis text={c.heading} /></H2>
          </div>
          <div role="tablist" aria-label="Product groups" className="flex gap-2 overflow-x-auto">
            {TABS.map((t) => (
              <Pill key={t.id} role="tab" aria-selected={tab === t.id} active={tab === t.id} onClick={() => setTab(t.id)} className="px-[22px] text-[13px] tracking-[0.08em]">{t.label}</Pill>
            ))}
          </div>
        </div>
        {isError ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : (
          <ProductGrid products={data?.items ?? []} role="tabpanel">
            {isLoading && Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="aspect-[4/6]" />)}
            {data && data.items.length === 0 && <p className="col-span-full py-10 text-center text-taupe">Nothing here yet — <Link to="/shop" className="underline">browse everything</Link>.</p>}
          </ProductGrid>
        )}
      </Container>
    </section>
  );
}

function Originals({ c }: { c: HomeContent['originals'] }) {
  const { data: brands } = useQuery({ queryKey: ['brands'], queryFn: catalogApi.brands, staleTime: 60_000 });
  const own = brands?.find((b) => b.is_original);
  const stats = c.stats.filter((s) => s.value);
  return (
    <section className="bg-pearl">
      <Container className="flex flex-wrap items-center gap-12 py-[72px] md:gap-16 md:py-[104px]">
        <div className="grid min-w-0 flex-[1_1_460px] grid-cols-2 gap-5">
          <div className="aspect-[3/4] overflow-hidden rounded-t-[200px] rounded-b bg-[#E6EADF]">
            {c.image_1 && <img src={c.image_1} alt="" loading="lazy" className="h-full w-full object-cover" />}
          </div>
          <div className="mt-16 aspect-[3/4] overflow-hidden rounded bg-champagne">
            {c.image_2 && <img src={c.image_2} alt="" loading="lazy" className="h-full w-full object-cover" />}
          </div>
        </div>
        <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-6">
          {c.eyebrow && <Eyebrow>{c.eyebrow}</Eyebrow>}
          <h2 className="font-serif text-[clamp(40px,4.4vw,64px)] font-normal leading-[1.02]"><Emphasis text={c.heading} /></h2>
          {c.body && <p className="text-[17px] font-light leading-[1.7] text-taupe">{c.body}</p>}
          {stats.length > 0 && (
            <dl className="flex flex-wrap gap-8 py-2">
              {stats.map((s, i) => (
                <div key={i} className="flex flex-col gap-1"><dt className="order-2 text-[13px] text-taupe">{s.label}</dt><dd className="font-serif text-4xl">{s.value}</dd></div>
              ))}
            </dl>
          )}
          {c.cta_label && <div><Link to={own ? `/shop?brand=${own.slug}` : '/shop'} className="btn-primary min-h-[54px] px-[34px]">{c.cta_label}</Link></div>}
        </div>
      </Container>
    </section>
  );
}

function DiscoveryAndQuiz({ discovery: d, quiz: q }: { discovery: HomeContent['discovery']; quiz: HomeContent['quiz'] }) {
  return (
    <section>
      <Container className="grid gap-6 py-[72px] md:grid-cols-[repeat(auto-fit,minmax(min(460px,100%),1fr))] md:py-[104px]">
        <div className="flex flex-col gap-[22px] rounded-md border border-line bg-white p-[clamp(28px,4vw,56px)]">
          {d.eyebrow && <Eyebrow>{d.eyebrow}</Eyebrow>}
          <h3 className="font-serif text-[44px] font-normal leading-[1.05]">{d.heading}</h3>
          {d.body && <p className="leading-[1.7] text-taupe">{d.body}</p>}
          <div aria-hidden className="flex items-end gap-2.5 py-2">
            {['#B7C09A', '#D7A260', '#EBD7B5', '#AE7E52', '#BCD5DE', '#D9A0A0'].map((v) => (
              <span key={v} className="flex flex-col items-center"><span className="h-3 w-3.5 rounded-sm bg-gold" /><span className="h-[74px] w-[26px] rounded-b-[13px]" style={{ background: `linear-gradient(100deg, rgba(255,255,255,0.6) 0 20%, transparent 40%), ${v}` }} /></span>
            ))}
          </div>
          <div className="mt-auto flex flex-wrap items-center gap-5">
            {d.cta_label && <Link to="/gifting" className="btn-primary min-h-[52px] px-[30px]">{d.cta_label}</Link>}
            {d.price_text && <span className="font-serif text-2xl">{d.price_text}</span>}
          </div>
        </div>
        <div className="flex flex-col gap-[22px] rounded-md bg-gradient-to-br from-[#F1E5D1] to-champagne p-[clamp(28px,4vw,56px)]">
          {q.eyebrow && <Eyebrow className="!text-[#6E5226]">{q.eyebrow}</Eyebrow>}
          <h3 className="font-serif text-[44px] font-normal leading-[1.05]">{q.heading}</h3>
          {q.body && <p className="leading-[1.7] text-[#4A4238]">{q.body}</p>}
          {q.steps.length > 0 && (
            <ol className="flex flex-col gap-3">
              {q.steps.map((s, i) => (
                <li key={i} className="flex items-center gap-3.5 text-[15px]"><span aria-hidden className="flex h-7 w-7 items-center justify-center rounded-full border border-antique text-[13px]">{i + 1}</span>{s.text}</li>
              ))}
            </ol>
          )}
          {q.cta_label && <div className="mt-auto"><Link to="/scent-finder" className="btn-secondary min-h-[52px] px-[30px]">{q.cta_label}</Link></div>}
        </div>
      </Container>
    </section>
  );
}

function Moments({ c }: { c: HomeContent['moments'] }) {
  return (
    <section>
      <Container className="pb-[72px] md:pb-[104px]">
        <div className="mb-9 flex flex-col items-center gap-3.5 text-center">
          {c.eyebrow && <Eyebrow>{c.eyebrow}</Eyebrow>}
          <H2><Emphasis text={c.heading} /></H2>
        </div>
        <ul className={cn(hscroll, '-mx-4 md:mx-0 md:grid-cols-[repeat(auto-fit,minmax(220px,1fr))] md:gap-4')}>
          {c.items.map((m, i) => (
            <li key={i} className="w-[62%] flex-none snap-start md:w-auto">
              <Link to="/shop" className="flex min-h-[150px] flex-col gap-2.5 rounded border border-line bg-white px-6 py-7 hover:border-gold">
                <span className="font-serif text-[28px] leading-[1.1]">{m.label}</span>
                {m.sub && <span className="text-sm leading-normal text-taupe">{m.sub}</span>}
                <span className="mt-auto text-xs uppercase tracking-[0.16em] text-antique">Shop now →</span>
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

function Guides({ c }: { c: HomeContent['guides'] }) {
  const tints = ['#F3E6D6', '#E5ECEF', '#F6E6E3'];
  return (
    <section>
      <Container className="pb-[72px] md:pb-[104px]">
        <div className="mb-10 flex flex-col gap-3.5">
          {c.eyebrow && <Eyebrow>{c.eyebrow}</Eyebrow>}
          <H2><Emphasis text={c.heading} /></H2>
        </div>
        <ul className={cn(hscroll, '-mx-4 md:mx-0 md:grid-cols-[repeat(auto-fit,minmax(300px,1fr))] md:gap-7')}>
          {c.items.map((g, i) => (
            <li key={i} className="w-[84%] flex-none snap-start md:w-auto">
              <Link to="/help" className="flex flex-col gap-4">
                <div className="aspect-[4/3] overflow-hidden rounded" style={{ background: tints[i % tints.length] }}>
                  {g.image && <img src={g.image} alt="" loading="lazy" className="h-full w-full object-cover" />}
                </div>
                {g.tag && <span className="text-xs uppercase tracking-[0.18em] text-antique">{g.tag}</span>}
                <span className="font-serif text-[28px] leading-[1.15]">{g.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

function Newsletter({ c }: { c: HomeContent['newsletter'] }) {
  return (
    <section className="bg-pearl">
      <div className="mx-auto flex max-w-[760px] flex-col items-center gap-5 px-4 py-24 text-center md:px-10">
        {c.kicker && <span className="font-serif text-[22px] italic text-antique">{c.kicker}</span>}
        <h2 className="font-serif text-[clamp(34px,4vw,52px)] font-normal leading-[1.08]"><Emphasis text={c.heading} /></h2>
        <NewsletterForm />
      </div>
    </section>
  );
}
