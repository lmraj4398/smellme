import { useId } from 'react';
import type { AddressForm as Value } from '@/lib/checkout';

type Errors = Partial<Record<keyof Value, string>>;
interface Props { value: Value; errors: Errors; states: readonly string[]; onChange: (v: Value) => void; onPincodeBlur?: () => void; pincodeNote?: string }

const control = 'min-h-12 w-full rounded border border-field bg-white px-4 text-[15px] font-normal';

function Row({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: (a: { id: string; 'aria-invalid': boolean; 'aria-describedby'?: string }) => React.ReactNode }) {
  const id = useId();
  const note = error ?? hint;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium">{label}</label>
      {children({ id, 'aria-invalid': !!error, 'aria-describedby': note ? `${id}-note` : undefined })}
      {note && <span id={`${id}-note`} role={error ? 'alert' : undefined} className={`text-[13px] ${error ? 'text-danger' : 'text-taupe'}`}>{note}</span>}
    </div>
  );
}

/** Delivery address fields. Controlled; the page owns validation so it can block submit. */
export function AddressFields({ value, errors, states, onChange, onPincodeBlur, pincodeNote }: Props) {
  const set = (k: keyof Value) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => onChange({ ...value, [k]: e.target.value });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Row label="Full name" error={errors.name}>{(a) => <input autoComplete="name" className={control} value={value.name} onChange={set('name')} {...a} />}</Row>
      <Row label="Mobile number" error={errors.phone} hint="For delivery updates">{(a) => <input type="tel" inputMode="tel" autoComplete="tel" className={control} value={value.phone} onChange={set('phone')} {...a} />}</Row>
      <div className="sm:col-span-2"><Row label="Flat, house no., building, street" error={errors.line1}>{(a) => <input autoComplete="address-line1" className={control} value={value.line1} onChange={set('line1')} {...a} />}</Row></div>
      <div className="sm:col-span-2"><Row label="Area, landmark (optional)">{(a) => <input autoComplete="address-line2" className={control} value={value.line2} onChange={set('line2')} {...a} />}</Row></div>
      <Row label="City" error={errors.city}>{(a) => <input autoComplete="address-level2" className={control} value={value.city} onChange={set('city')} {...a} />}</Row>
      <Row label="State" error={errors.state}>
        {(a) => (
          <select autoComplete="address-level1" className={control} value={value.state} onChange={set('state')} {...a}>
            <option value="">Select state</option>
            {states.map((s) => <option key={s}>{s}</option>)}
          </select>
        )}
      </Row>
      <Row label="Pincode" error={errors.pincode} hint={pincodeNote}>{(a) => <input inputMode="numeric" autoComplete="postal-code" maxLength={6} className={control} value={value.pincode} onChange={(e) => onChange({ ...value, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })} onBlur={onPincodeBlur} {...a} />}</Row>
    </div>
  );
}
