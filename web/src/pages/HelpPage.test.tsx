import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AxiosError } from 'axios';
import * as content from '@/api/content';
import { renderAt } from '@/test/render';
import HelpPage from './HelpPage';

vi.mock('@/api/content', async (orig) => {
  const real = await orig<typeof import('@/api/content')>();
  return { ...real, useContent: vi.fn(), inboxApi: { contact: vi.fn(), subscribe: vi.fn() } };
});

const help = {
  hero: { eyebrow: 'Help centre', heading: 'How can we help?' },
  faq: { categories: [
    { name: 'Orders', faqs: [{ q: 'How do I pay?', a: 'Scan the UPI QR.' }, { q: 'When does it ship?', a: 'After we confirm your payment.' }] },
    { name: 'Empty topic', faqs: [] },
    { name: 'Authenticity', faqs: [{ q: 'Are they genuine?', a: 'Yes, sealed.' }] },
  ] },
  contact: { heading: 'Still need us?', body: 'Ask us anything.' },
};
const site = { site: { announcement: '', tagline: '', whatsapp: '+91 98765 43210', phone: '', email: 'care@smellme.in', hours: 'Mon–Sat, 10–7', instagram: '', youtube: '' } };

beforeEach(() => {
  vi.mocked(content.useContent).mockImplementation(((page: string) => ({ data: page === 'help' ? help : site, isLoading: false, isError: false, refetch: vi.fn() })) as never);
  vi.mocked(content.inboxApi.contact).mockResolvedValue({ ok: true });
});

const open = (route = '/help') => renderAt(<HelpPage />, { path: '/help', route });
const fill = async (over: { name?: string; phone?: string; email?: string; message?: string } = {}) => {
  const v = { name: 'Anaya', phone: '', email: 'anaya@example.com', message: 'Where is my order?', ...over };
  if (v.name) await userEvent.type(screen.getByLabelText('Full name'), v.name);
  if (v.phone) await userEvent.type(screen.getByLabelText('Phone'), v.phone);
  if (v.email) await userEvent.type(screen.getByLabelText('Email'), v.email);
  if (v.message) await userEvent.type(screen.getByLabelText('Message'), v.message);
};
const send = () => userEvent.click(screen.getByRole('button', { name: 'Send message' }));

describe('HelpPage FAQ', () => {
  it('lists topics (skipping empty ones), opens the first question, and switches topic', async () => {
    open();
    expect(screen.queryByRole('button', { name: 'Empty topic' })).toBeNull();
    expect(screen.getByText('How do I pay?').closest('details')).toHaveAttribute('open');
    expect(screen.getByText('When does it ship?').closest('details')).not.toHaveAttribute('open');
    await userEvent.click(screen.getByRole('button', { name: 'Authenticity' }));
    expect(screen.getByText('Are they genuine?')).toBeInTheDocument();
    expect(screen.queryByText('How do I pay?')).toBeNull();
  });

  it('shows contact channels from the site settings, and hides ones that are blank', () => {
    open();
    expect(screen.getByRole('link', { name: '+91 98765 43210' })).toHaveAttribute('href', 'https://wa.me/919876543210');
    expect(screen.getByRole('link', { name: 'care@smellme.in' })).toHaveAttribute('href', 'mailto:care@smellme.in');
    expect(screen.queryByText('Call')).toBeNull(); // no phone set
  });
});

describe('ContactForm', () => {
  it('sends a valid message with only the fields that were filled in', async () => {
    open();
    await fill();
    await send();
    await waitFor(() => expect(content.inboxApi.contact).toHaveBeenCalledTimes(1));
    expect(content.inboxApi.contact).toHaveBeenCalledWith({ name: 'Anaya', email: 'anaya@example.com', topic: 'Help choosing a fragrance', message: 'Where is my order?' });
    expect(await screen.findByText(/we’ve got your message/i)).toBeInTheDocument();
  });

  it('needs a phone OR an email, and says so beside the phone field', async () => {
    open();
    await fill({ email: '' });
    await send();
    expect(await screen.findByText(/Give a phone number or an email/)).toBeInTheDocument();
    expect(content.inboxApi.contact).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText('Phone'), '+91 98765 43210');
    await send();
    await waitFor(() => expect(content.inboxApi.contact).toHaveBeenCalledWith(expect.objectContaining({ phone: '+91 98765 43210' })));
  });

  it.each([
    ['empty name', { name: '' }, 'Please tell us your name'],
    ['bad email', { email: 'nope' }, 'Enter a valid email'],
    ['bad phone', { email: '', phone: 'call me' }, 'Enter a valid phone number'],
    ['empty message', { message: '' }, 'Please write your message'],
  ])('refuses %s without calling the API', async (_n, over, msg) => {
    open();
    await fill(over);
    await send();
    expect(await screen.findByText(msg)).toBeInTheDocument();
    expect(content.inboxApi.contact).not.toHaveBeenCalled();
  });

  it('preselects the topic when arriving from the Gifting page', async () => {
    open('/help?topic=gifting');
    expect(screen.getByLabelText('Topic')).toHaveValue('Corporate or wedding gifting');
  });

  it('ignores an unknown ?topic value', () => {
    open('/help?topic=<script>');
    expect(screen.getByLabelText('Topic')).toHaveValue('Help choosing a fragrance');
  });

  it('passes the hidden honeypot through only when it is filled (as a bot would)', async () => {
    const { container } = open();
    await fill();
    const trap = container.querySelector<HTMLInputElement>('input[aria-hidden="true"]')!;
    expect(trap).toHaveAttribute('tabindex', '-1');
    await userEvent.type(trap, 'http://spam');
    await send();
    await waitFor(() => expect(content.inboxApi.contact).toHaveBeenCalledWith(expect.objectContaining({ website: 'http://spam' })));
  });

  it('shows the failure and keeps what was typed when sending fails', async () => {
    vi.mocked(content.inboxApi.contact).mockRejectedValue(new AxiosError('Network Error', 'ERR_NETWORK')); // no response = offline
    open();
    await fill();
    await send();
    expect(await screen.findByRole('alert')).toHaveTextContent(/connection problem/i);
    expect(screen.getByLabelText('Message')).toHaveValue('Where is my order?');
  });
});
