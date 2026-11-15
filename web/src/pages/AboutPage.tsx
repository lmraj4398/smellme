import { Link } from 'react-router-dom';
import { useContent } from '@/api/content';
import { Emphasis } from '@/components/ui/Emphasis';
import { Container, ErrorState, Eyebrow, H2, Loading } from '@/components/ui/States';
import { usePageTitle } from '@/hooks/usePageTitle';

export default function AboutPage() {
  usePageTitle('Our story', 'Perfume should be tried, not guessed. The story behind SmellMe.');
  const { data: c, isLoading, isError, refetch } = useContent('about');
  if (isLoading) return <Loading />;
  if (isError || !c) return <ErrorState onRetry={() => void refetch()} />;

  // A step with no text is just a bare title: show the block only when the owner has filled something in.
  const steps = c.steps.items.filter((s) => s.body.trim());

  return (
    <>
      <section className="bg-[radial-gradient(ellipse_60%_80%_at_50%_0%,#fff_0%,#F4EEE4_70%)]">
        <Container className="flex max-w-[980px] flex-col items-center gap-7 pb-[72px] pt-20 text-center md:pb-[88px] md:pt-[104px]">
          {c.hero.eyebrow && <Eyebrow>{c.hero.eyebrow}</Eyebrow>}
          <h1 className="font-serif text-[clamp(48px,6vw,92px)] font-normal leading-none [text-wrap:balance]"><Emphasis text={c.hero.heading} /></h1>
          {c.hero.body && <p className="max-w-[640px] text-lg font-light leading-[1.75] text-[#4A4238]">{c.hero.body}</p>}
        </Container>
      </section>

      <Container className="flex flex-wrap items-center gap-14 py-[72px] md:py-[88px]">
        <div className="aspect-[5/4] min-w-0 flex-[1_1_460px] overflow-hidden rounded bg-champagne">
          {c.story.image && <img src={c.story.image} alt="" loading="lazy" className="h-full w-full object-cover" />}
        </div>
        <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-[22px]">
          {c.story.kicker && <span className="font-serif text-[26px] italic text-antique">{c.story.kicker}</span>}
          <H2><Emphasis text={c.story.heading} /></H2>
          {c.story.paragraph_1 && <p className="leading-[1.75] text-[#4A4238]">{c.story.paragraph_1}</p>}
          {c.story.paragraph_2 && <p className="leading-[1.75] text-[#4A4238]">{c.story.paragraph_2}</p>}
        </div>
      </Container>

      {c.values.items.length > 0 && (
        <section className="bg-pearl">
          <Container className="py-24">
            <h2 className="mb-12 text-center font-serif text-[clamp(36px,4vw,56px)] font-normal leading-[1.05]"><Emphasis text={c.values.heading} /></h2>
            <ul className="grid gap-6 md:grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))]">
              {c.values.items.map((v, i) => (
                <li key={i} className="flex flex-col items-center gap-3.5 rounded-t-[160px] rounded-b bg-ivory px-8 pb-10 pt-16 text-center">
                  <span aria-hidden className="font-serif text-[44px] italic leading-none text-antique">{['i', 'ii', 'iii', 'iv', 'v', 'vi'][i] ?? i + 1}</span>
                  <h3 className="font-serif text-[28px] font-normal leading-[1.1]">{v.title}</h3>
                  {v.body && <p className="text-[15px] leading-[1.7] text-[#4A4238]">{v.body}</p>}
                </li>
              ))}
            </ul>
          </Container>
        </section>
      )}

      {steps.length > 0 && (
        <section>
          <Container className="py-24">
            <div className="mb-11 flex flex-col gap-3.5">
              {c.steps.eyebrow && <Eyebrow>{c.steps.eyebrow}</Eyebrow>}
              <H2><Emphasis text={c.steps.heading} /></H2>
            </div>
            <ol className="grid gap-8 border-t border-ink md:grid-cols-[repeat(auto-fit,minmax(min(240px,100%),1fr))]">
              {steps.map((s, i) => (
                <li key={i} className="flex flex-col gap-3 pt-6">
                  <span className="text-xs tracking-[0.2em] text-antique">STEP {String(i + 1).padStart(2, '0')}</span>
                  <span className="font-serif text-[28px]">{s.title}</span>
                  <span className="text-[15px] leading-[1.7] text-[#4A4238]">{s.body}</span>
                </li>
              ))}
            </ol>
          </Container>
        </section>
      )}

      {c.visit.place && (
        <Container className="pb-[104px]">
          <div className="flex flex-wrap items-center justify-between gap-8 rounded bg-gradient-to-br from-[#F1E5D1] to-champagne p-[clamp(32px,5vw,72px)]">
            <div className="flex flex-[1_1_420px] flex-col gap-3">
              {c.visit.eyebrow && <Eyebrow className="!text-[#6E5226]">{c.visit.eyebrow}</Eyebrow>}
              <span className="font-serif text-[clamp(28px,3vw,40px)] leading-[1.1]">{c.visit.place}</span>
              {c.visit.details && <span className="text-[15px] text-[#4A4238]">{c.visit.details}</span>}
            </div>
            {c.visit.cta_label && <Link to="/shop" className="btn-primary min-h-[54px] px-8">{c.visit.cta_label}</Link>}
          </div>
        </Container>
      )}
    </>
  );
}
