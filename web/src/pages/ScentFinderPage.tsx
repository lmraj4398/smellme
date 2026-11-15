import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { catalogApi } from '@/api/catalog';
import { Container, ErrorState, Eyebrow, Skeleton } from '@/components/ui/States';
import { usePageTitle } from '@/hooks/usePageTitle';
import { FAMILY_LINES, QUESTIONS, findMatches, isComplete, resultFamily, type Answers } from '@/lib/scent-finder';
import { cn } from '@/lib/utils';
import { useBag } from '@/store/cart.store';
import { ProductGrid } from '@/components/ProductGrid';

export default function ScentFinderPage() {
  usePageTitle('Scent finder', 'Answer five quick questions and we’ll match you with three fragrances to sample.');
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const done = step >= QUESTIONS.length && isComplete(answers);

  const restart = () => { setStep(0); setAnswers({}); };

  return (
    <div className="bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,#fff_0%,#F4EEE4_60%,#FBF8F3_100%)]">
      <Container className="flex max-w-[1040px] flex-col gap-10 py-12 md:py-16">
        {done ? <Results answers={answers} onRestart={restart} /> : <Question step={step} answers={answers} setAnswers={setAnswers} setStep={setStep} />}
      </Container>
    </div>
  );
}

function Question({ step, answers, setAnswers, setStep }: {
  step: number; answers: Answers; setAnswers: (a: Answers) => void; setStep: (n: number) => void;
}) {
  const q = QUESTIONS[step];
  const picked = answers[step];
  const last = step === QUESTIONS.length - 1;
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col items-center gap-3.5 text-center">
        <Eyebrow>Scent finder · Question {step + 1} of {QUESTIONS.length}</Eyebrow>
        <div role="progressbar" aria-valuemin={1} aria-valuemax={QUESTIONS.length} aria-valuenow={step + 1} aria-label="Quiz progress" className="grid w-[min(100%,360px)] grid-cols-5 gap-1.5">
          {QUESTIONS.map((_, i) => <span key={i} className={cn('h-[3px] rounded-sm', i <= step ? 'bg-antique' : 'bg-line')} />)}
        </div>
        <h1 className="mt-3 font-serif text-[clamp(38px,4.6vw,64px)] font-normal leading-[1.05] [text-wrap:balance]">{q.title}</h1>
        <p className="text-base text-taupe">{q.sub}</p>
      </div>

      <div role="radiogroup" aria-label={q.title} className="grid grid-cols-2 gap-3 md:grid-cols-[repeat(auto-fit,minmax(min(220px,100%),1fr))] md:gap-4">
        {q.options.map((o, i) => {
          const on = picked === i;
          return (
            <button
              key={o.label} type="button" role="radio" aria-checked={on}
              onClick={() => setAnswers({ ...answers, [step]: i })}
              className={cn(
                'flex min-h-40 flex-col items-center justify-center gap-3 rounded-t-[120px] rounded-b-md border px-4 py-6 text-center md:min-h-[210px] md:px-5 md:py-7',
                on ? 'border-[1.5px] border-ink bg-white shadow-[0_12px_30px_rgba(110,80,40,0.12)]' : 'border-line bg-white/70',
              )}
            >
              <span aria-hidden className="h-14 w-14 rounded-full border border-antique/25" style={{ background: o.swatch }} />
              <span className="font-serif text-[21px] leading-[1.15] md:text-2xl">{o.label}</span>
              <span className="text-sm leading-normal text-taupe">{o.sub}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <button type="button" disabled={step === 0} onClick={() => setStep(step - 1)} className="min-h-[52px] px-7 text-[13px] uppercase tracking-[0.16em] disabled:opacity-30">← Back</button>
        <button type="button" disabled={picked === undefined} onClick={() => setStep(step + 1)} className="btn-primary min-h-[54px] px-9 disabled:cursor-not-allowed disabled:bg-line disabled:text-taupe">
          {last ? 'See my matches' : 'Next question'}
        </button>
      </div>
    </div>
  );
}

function Results({ answers, onRestart }: { answers: Answers; onRestart: () => void }) {
  const family = resultFamily(answers);
  const copy = FAMILY_LINES[family] ?? { name: family, line: '' };
  const add = useBag((s) => s.add);
  const [adding, setAdding] = useState(false);
  const q = useQuery({ queryKey: ['scent-finder', answers], queryFn: () => findMatches(answers, catalogApi.products), staleTime: 60_000 });

  // The trio is the three 2 ml sample variants, which a card does not carry, so read each product's detail.
  async function addSampleTrio() {
    if (!q.data?.length) return;
    setAdding(true);
    try {
      const details = await Promise.all(q.data.map((p) => catalogApi.product(p.slug)));
      let added = 0;
      for (const p of details) {
        const s = p.variants.find((v) => v.is_sample && v.in_stock);
        if (!s) continue;
        add({ variantId: s.id, productSlug: p.slug, name: p.name, brand: p.brand.name, label: s.label, price_paise: s.price_paise, tint: p.tint, liquid: p.liquid, mono: p.mono, image: p.media[0]?.url ?? null });
        added++;
      }
      if (added) toast.success(`${added} sample${added === 1 ? '' : 's'} added to your bag`, { id: 'bag-added' });
      else toast.error('Samples aren’t available for these right now.');
    } catch {
      toast.error('We couldn’t add the samples. Please try again.');
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="flex flex-col gap-11">
      <div className="flex flex-col items-center gap-4 text-center">
        <Eyebrow>Your scent profile</Eyebrow>
        <h1 className="font-serif text-[clamp(44px,5vw,72px)] font-normal leading-none">You’re drawn to <em className="italic text-antique">{copy.name}</em></h1>
        {copy.line && <p className="max-w-[560px] text-[17px] leading-[1.7] text-taupe">{copy.line}</p>}
      </div>

      {q.isLoading && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-[480px]" />)}</div>
      )}
      {q.isError && <ErrorState onRetry={() => void q.refetch()} />}
      {q.data && q.data.length === 0 && (
        <p className="text-center text-taupe">We couldn’t find a match just yet. <Link to="/shop" className="underline">Browse all fragrances</Link>.</p>
      )}
      {q.data && q.data.length > 0 && (
        <>
          <ProductGrid products={q.data} layout="trio" />
          <div className="flex flex-wrap items-center justify-between gap-5 rounded-md border border-line bg-white p-8">
            <div className="flex flex-col gap-1.5">
              <span className="font-serif text-3xl">Try {q.data.length === 3 ? 'all three' : 'them'} at home</span>
              <span className="text-[15px] text-taupe">Get your matches as 2 ml samples to wear for a day each.</span>
            </div>
            <button type="button" onClick={() => void addSampleTrio()} disabled={adding} className="btn-primary min-h-[54px] px-8">
              {adding ? 'Adding…' : 'Add sample trio'}
            </button>
          </div>
        </>
      )}
      <button type="button" onClick={onRestart} className="self-center min-h-12 px-6 text-sm text-antique underline">Retake the quiz</button>
    </div>
  );
}
