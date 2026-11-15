import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { authApi } from '@/api/auth.api';
import { apiErrorMessage } from '@/lib/api-error';
import { useAuthStore } from '@/store/auth.store';

const schema = z.object({
  email: z.string().trim().email('Enter a valid email'),
  password: z.string().min(1, 'Enter your password'),
});
type Form = z.infer<typeof schema>;

export default function LoginPage() {
  const status = useAuthStore((s) => s.status);
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/';
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema) });

  if (status === 'authed') return <Navigate to={from} replace />;

  const onSubmit = async (v: Form) => {
    setError(null);
    try {
      await authApi.login(v.email, v.password);
      navigate(from, { replace: true });
    } catch (e) {
      // Server returns one message for wrong email and wrong password, so we never reveal which exists.
      setError(apiErrorMessage(e, 'Could not sign in. Check your details and try again.'));
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-white to-pearl p-4">
      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="w-full max-w-sm space-y-5 rounded-lg border border-line bg-ivory p-8 shadow-sm"
      >
        <div className="text-center">
          <div className="font-serif text-4xl font-medium">Smell<em className="text-antique">Me</em></div>
          <div className="eyebrow mt-2">Admin sign in</div>
        </div>
        <div>
          <label htmlFor="email" className="label">Email</label>
          <input id="email" type="email" autoComplete="username" className="field" aria-invalid={!!errors.email} {...register('email')} />
          {errors.email && <p role="alert" className="mt-1 text-sm text-danger">{errors.email.message}</p>}
        </div>
        <div>
          <label htmlFor="password" className="label">Password</label>
          <input id="password" type="password" autoComplete="current-password" className="field" aria-invalid={!!errors.password} {...register('password')} />
          {errors.password && <p role="alert" className="mt-1 text-sm text-danger">{errors.password.message}</p>}
        </div>
        {error && <p role="alert" className="rounded bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
        <button type="submit" disabled={isSubmitting} className="btn-primary w-full">
          {isSubmitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
