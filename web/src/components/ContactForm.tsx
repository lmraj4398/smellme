import { useId, useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CONTACT_TOPICS, inboxApi } from '@/api/content';
import { apiErrorMessage } from '@/lib/api-error';

// Same rules as the API; the API remains the authority.
const PHONE = /^[+\d][\d\s-]{6,18}$/;
const schema = z
  .object({
    name: z.string().trim().min(1, 'Please tell us your name').max(120),
    phone: z.string().trim().refine((v) => !v || PHONE.test(v), 'Enter a valid phone number'),
    email: z.string().trim().refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v), 'Enter a valid email'),
    topic: z.enum(CONTACT_TOPICS),
    message: z.string().trim().min(1, 'Please write your message').max(3000, 'Please keep it under 3000 characters'),
    website: z.string().optional(), // honeypot
  })
  .refine((v) => v.phone || v.email, { message: 'Give a phone number or an email so we can reply', path: ['phone'] });
type Values = z.infer<typeof schema>;

const control = 'min-h-[50px] rounded border border-field bg-white px-4 text-[15px] font-normal';

// Label, control and error as siblings: the error is announced as the field's description,
// not as part of its name.
function Row({ label, error, children }: { label: string; error?: string; children: (p: { id: string; 'aria-invalid': boolean; 'aria-describedby'?: string }) => ReactNode }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      {children({ id, 'aria-invalid': !!error, 'aria-describedby': error ? `${id}-err` : undefined })}
      {error && <span id={`${id}-err`} role="alert" className="text-[13px] text-danger">{error}</span>}
    </div>
  );
}

export function ContactForm({ initialTopic }: { initialTopic?: (typeof CONTACT_TOPICS)[number] }) {
  const [sent, setSent] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register, handleSubmit, reset, formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { name: '', phone: '', email: '', topic: initialTopic ?? CONTACT_TOPICS[0], message: '', website: '' } });

  async function onSubmit(v: Values) {
    setServerError(null);
    try {
      await inboxApi.contact({
        name: v.name, topic: v.topic, message: v.message,
        ...(v.phone ? { phone: v.phone } : {}), ...(v.email ? { email: v.email } : {}), ...(v.website ? { website: v.website } : {}),
      });
      setSent(true);
      reset();
    } catch (e) {
      setServerError(apiErrorMessage(e, 'We couldn’t send your message. Please try again.'));
    }
  }

  if (sent) {
    return (
      <div role="status" className="flex flex-col gap-3 rounded bg-ivory p-[clamp(24px,4vw,48px)]">
        <h3 className="font-serif text-3xl">Thank you — we’ve got your message.</h3>
        <p className="text-[#4A4238]">We’ll get back to you as soon as we can.</p>
        <button className="self-start text-sm underline" onClick={() => setSent(false)}>Send another message</button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex min-w-0 flex-col gap-[18px] rounded bg-ivory p-[clamp(24px,4vw,48px)]">
      <div className="grid gap-4 sm:grid-cols-2">
        <Row label="Full name" error={errors.name?.message}>{(a) => <input autoComplete="name" className={control} {...a} {...register('name')} />}</Row>
        <Row label="Phone" error={errors.phone?.message}>{(a) => <input type="tel" inputMode="tel" autoComplete="tel" placeholder="+91" className={control} {...a} {...register('phone')} />}</Row>
      </div>
      <Row label="Email" error={errors.email?.message}>{(a) => <input type="email" autoComplete="email" className={control} {...a} {...register('email')} />}</Row>
      <Row label="Topic">{(a) => <select className={control} {...a} {...register('topic')}>{CONTACT_TOPICS.map((t) => <option key={t}>{t}</option>)}</select>}</Row>
      <Row label="Message" error={errors.message?.message}>{(a) => <textarea rows={4} className={`${control} py-3.5`} {...a} {...register('message')} />}</Row>
      {/* Honeypot: invisible to people and assistive tech. */}
      <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 opacity-0" {...register('website')} />
      {serverError && <p role="alert" className="rounded bg-danger/10 px-3 py-2 text-sm text-danger">{serverError}</p>}
      <button type="submit" disabled={isSubmitting} className="btn-primary min-h-[54px] self-start px-9">{isSubmitting ? 'Sending…' : 'Send message'}</button>
    </form>
  );
}
