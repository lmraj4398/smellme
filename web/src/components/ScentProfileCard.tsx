import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { commerceApi } from '@/api/commerce';
import { Eyebrow, Skeleton } from '@/components/ui/States';
import { levelFor, profileHeadline } from '@/lib/scent-profile';

/** "Your scent profile": the families a customer buys most, from their orders. Invites them to the quiz until they have any. */
export function ScentProfileCard() {
  const q = useQuery({ queryKey: ['scent-profile'], queryFn: commerceApi.scentProfile, staleTime: 60_000 });
  if (q.isLoading) return <Skeleton className="h-48" />;
  // A profile is a nicety: if it cannot load, show nothing rather than an error on the account page.
  if (q.isError || !q.data) return null;
  const families = q.data;
  const headline = profileHeadline(families);

  return (
    <section aria-label="Your scent profile" className="flex flex-wrap items-center gap-8 rounded-md bg-gradient-to-br from-[#F1E5D1] to-champagne p-[clamp(24px,4vw,44px)]">
      <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-3">
        <Eyebrow className="!text-[#6E5226]">Your scent profile</Eyebrow>
        {families.length === 0 ? (
          <>
            <span className="font-serif text-[clamp(28px,3vw,40px)] leading-[1.05]">Let’s find your scent</span>
            <p className="text-[15px] leading-[1.7] text-[#4A4238]">Answer five quick questions and we’ll match you with three fragrances to try. Your profile fills in as you order.</p>
            <div className="pt-2"><Link to="/scent-finder" className="btn-primary min-h-12 px-6">Take the scent quiz</Link></div>
          </>
        ) : (
          <>
            <span className="font-serif text-[clamp(28px,3vw,40px)] leading-[1.05]">{headline || families[0].name}, from what you’ve chosen</span>
            <p className="text-[15px] leading-[1.7] text-[#4A4238]">Based on the fragrances you’ve ordered.</p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link to={`/shop?family=${families[0].slug}`} className="btn-primary min-h-12 px-6">See picks for you</Link>
              <Link to="/scent-finder" className="btn-secondary min-h-12 px-6">Take the quiz</Link>
            </div>
          </>
        )}
      </div>
      {families.length > 0 && (
        <ul aria-label="Scent families" className="flex min-w-0 flex-[1_1_260px] flex-col gap-3.5">
          {families.map((f) => (
            <li key={f.slug} className="flex flex-col gap-1.5">
              <div className="flex justify-between text-sm"><span>{f.name}</span><span className="text-[#4A4238]">{levelFor(f.share)}</span></div>
              <div aria-hidden className="h-1 rounded-sm bg-ivory/80"><div className="h-1 rounded-sm bg-antique" style={{ width: `${Math.max(8, Math.round(f.share * 100))}%` }} /></div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
