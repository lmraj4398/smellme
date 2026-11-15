// The illustrated bottle from the design, used wherever there is no photo.
// Sizes are relative to the box it sits in, so it scales with the card.
export function Bottle({ liquid, mono, className = '' }: { liquid: string; mono?: string; className?: string }) {
  return (
    <span aria-hidden className={`flex w-[44%] flex-col items-center drop-shadow-[0_18px_18px_rgba(110,80,40,0.22)] ${className}`}>
      <span className="aspect-[1.7/1] w-[40%] rounded-[5px_5px_2px_2px] bg-gradient-to-r from-[#A9874E] via-[#E3C98F] to-[#9C7A41]" />
      <span className="h-[7px] w-[20%] bg-[#CDB383]" />
      <span
        className="flex aspect-[0.8/1] w-full items-center justify-center rounded-[14px]"
        style={{ background: `linear-gradient(105deg, rgba(255,255,255,0.6) 0 16%, rgba(255,255,255,0) 30%), ${liquid}` }}
      >
        {mono && <span className="bg-ivory/90 px-[9px] py-1.5 font-serif text-[15px] tracking-[0.08em] text-ink">{mono}</span>}
      </span>
    </span>
  );
}
