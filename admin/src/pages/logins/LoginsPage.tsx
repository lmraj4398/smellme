import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Pencil, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { loginsApi, type LoginRow } from '@/api/logins.api';
import { Badge, PageHeader } from '@/components/ui/bits';
import { Field } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Switch } from '@/components/ui/Switch';
import { apiErrorMessage } from '@/lib/api-error';
import { SCREEN_LABELS } from '@/lib/screens';
import { useAuthStore } from '@/store/auth.store';
import { QueryStatus } from '@/components/ui/QueryStatus';
import { ListCard } from '@/components/ui/ListCard';

type Editing = { kind: 'create' } | { kind: 'edit'; row: LoginRow } | { kind: 'password'; row: LoginRow } | null;

export default function LoginsPage() {
  const me = useAuthStore((s) => s.user);
  const q = useQuery({ queryKey: ['logins'], queryFn: loginsApi.list });
  const [editing, setEditing] = useState<Editing>(null);
  const screens = q.data?.screens ?? [];

  return (
    <div>
      <PageHeader
        title="Logins & access"
        subtitle="Give someone their own login and choose exactly which screens it can open. A login with every screen ticked is a full owner."
        actions={<button className="btn-primary" onClick={() => setEditing({ kind: 'create' })}><Plus size={16} aria-hidden /> Add login</button>}
      />

      <QueryStatus isLoading={q.isLoading} isError={q.isError} onRetry={() => void q.refetch()} what="logins" />

      {q.data && (
        <ListCard>
          {q.data.items.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1 basis-60">
                <div className="font-medium">{l.name} {l.id === me?.id && <span className="font-normal text-taupe">(you)</span>}</div>
                <div className="truncate text-sm text-taupe">{l.email}</div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {l.screens === null ? <Badge tone="ok">Owner · all screens</Badge> : l.screens.length === 0 ? <Badge tone="warn">Dashboard only</Badge> : l.screens.map((s) => <Badge key={s}>{SCREEN_LABELS[s] ?? s}</Badge>)}
                  {!l.is_active && <Badge tone="off">Switched off</Badge>}
                </div>
                <div className="mt-1 text-xs text-taupe">{l.last_login_at ? `Last signed in ${new Date(l.last_login_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}` : 'Never signed in'}</div>
              </div>
              <div className="flex gap-2">
                <button className="btn-secondary !min-h-10 !px-4" onClick={() => setEditing({ kind: 'edit', row: l })}><Pencil size={16} aria-hidden /> Access</button>
                {l.id !== me?.id && <button className="btn-secondary !min-h-10 !px-4" onClick={() => setEditing({ kind: 'password', row: l })}><KeyRound size={16} aria-hidden /> Password</button>}
              </div>
            </li>
          ))}
        </ListCard>
      )}

      {editing?.kind === 'create' && <CreateModal screens={screens} onClose={() => setEditing(null)} />}
      {editing?.kind === 'edit' && <EditModal row={editing.row} self={editing.row.id === me?.id} screens={screens} onClose={() => setEditing(null)} />}
      {editing?.kind === 'password' && <PasswordModal row={editing.row} onClose={() => setEditing(null)} />}
    </div>
  );
}

function ScreenPicker({ screens, value, onChange, disabled }: { screens: string[]; value: string[] | null; onChange: (v: string[] | null) => void; disabled?: boolean }) {
  const everything = value === null;
  return (
    <fieldset disabled={disabled} className="space-y-2">
      <legend className="label">Which screens can this login open?</legend>
      <label className="flex min-h-11 items-center gap-3 rounded border border-line bg-white px-3">
        <input type="checkbox" checked={everything} onChange={(e) => onChange(e.target.checked ? null : [])} />
        <span><strong>Everything (owner)</strong><span className="block text-sm text-taupe">Including this page: can add logins and change access</span></span>
      </label>
      <div className={`grid gap-1 sm:grid-cols-2 ${everything ? 'opacity-50' : ''}`}>
        {screens.map((s) => (
          <label key={s} className="flex min-h-11 items-center gap-3 px-1">
            <input type="checkbox" disabled={everything} checked={everything || value.includes(s)}
              onChange={(e) => onChange(e.target.checked ? [...value!, s] : value!.filter((x) => x !== s))} />
            {SCREEN_LABELS[s] ?? s}
          </label>
        ))}
      </div>
      {!everything && value.length === 0 && <p className="text-sm text-taupe">With nothing ticked, this login can only see the dashboard.</p>}
    </fieldset>
  );
}

function useDone(onClose: () => void, message: string) {
  const qc = useQueryClient();
  return () => { toast.success(message); void qc.invalidateQueries({ queryKey: ['logins'] }); onClose(); };
}

function CreateModal({ screens, onClose }: { screens: string[]; onClose: () => void }) {
  const [v, setV] = useState<{ name: string; email: string; password: string; screens: string[] | null }>({ name: '', email: '', password: '', screens: ['content', 'products'] });
  const done = useDone(onClose, 'Login created');
  const save = useMutation({ mutationFn: () => loginsApi.create({ ...v, name: v.name.trim(), email: v.email.trim() }), onSuccess: done });
  return (
    <Modal title="Add login" onClose={onClose} wide>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name"><input className="field" required value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
          <Field label="Email"><input className="field" type="email" required autoComplete="off" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} /></Field>
        </div>
        <Field label="Starting password" hint="10+ characters with a letter and a number. Tell them in person; they can change it after signing in.">
          <input className="field" type="password" required autoComplete="new-password" value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} />
        </Field>
        <ScreenPicker screens={screens} value={v.screens} onChange={(s) => setV({ ...v, screens: s })} />
        {save.isError && <p role="alert" className="text-sm text-danger">{apiErrorMessage(save.error)}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={save.isPending}>{save.isPending ? 'Creating…' : 'Create login'}</button>
        </div>
      </form>
    </Modal>
  );
}

function EditModal({ row, self, screens, onClose }: { row: LoginRow; self: boolean; screens: string[]; onClose: () => void }) {
  const [name, setName] = useState(row.name);
  const [sc, setSc] = useState<string[] | null>(row.screens);
  const [active, setActive] = useState(row.is_active);
  const done = useDone(onClose, 'Saved');
  const changed = sc !== row.screens && JSON.stringify(sc) !== JSON.stringify(row.screens);
  const save = useMutation({
    mutationFn: () => loginsApi.update(row.id, { name: name.trim(), ...(self ? {} : { screens: sc, is_active: active }) }),
    onSuccess: done,
  });
  return (
    <Modal title={`Access — ${row.name}`} onClose={onClose} wide>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
        <Field label="Name"><input className="field" required value={name} onChange={(e) => setName(e.target.value)} /></Field>
        {self ? (
          <p className="rounded bg-pearl px-3 py-2 text-sm text-taupe">You can’t change your own access, so you can never lock yourself out. Another owner can do it.</p>
        ) : (
          <>
            <ScreenPicker screens={screens} value={sc} onChange={setSc} />
            <Switch checked={active} onChange={setActive} label="Login is switched on" />
            {(changed || !active) && row.is_active && <p className="text-sm text-taupe">They will be signed out and need to sign in again for this to apply.</p>}
          </>
        )}
        {save.isError && <p role="alert" className="text-sm text-danger">{apiErrorMessage(save.error)}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  );
}

function PasswordModal({ row, onClose }: { row: LoginRow; onClose: () => void }) {
  const [pw, setPw] = useState('');
  const done = useDone(onClose, `Password reset for ${row.name}`);
  const save = useMutation({ mutationFn: () => loginsApi.resetPassword(row.id, pw), onSuccess: done });
  return (
    <Modal title={`Reset password — ${row.name}`} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
        <Field label="New password" hint="10+ characters with a letter and a number. They are signed out everywhere.">
          <input className="field" type="password" required autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        </Field>
        {save.isError && <p role="alert" className="text-sm text-danger">{apiErrorMessage(save.error)}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Reset password'}</button>
        </div>
      </form>
    </Modal>
  );
}
