import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as content from '@/api/content';
import { currentUrl, renderAt } from '@/test/render';
import HelpPage from './HelpPage';

vi.mock('@/api/content', async (orig) => {
  const real = await orig<typeof import('@/api/content')>();
  return { ...real, useContent: vi.fn(), inboxApi: { contact: vi.fn(), subscribe: vi.fn() } };
});

const help = { hero: { eyebrow: 'Help centre', heading: 'How can we help?' }, faq: { categories: [] }, contact: { heading: 'Still need us?', body: '' } };
const site = { site: { announcement: '', tagline: '', whatsapp: '', phone: '', email: '', hours: '', instagram: '', youtube: '' } };

beforeEach(() => {
  vi.mocked(content.useContent).mockImplementation(((page: string) => ({ data: page === 'help' ? help : site, isLoading: false, isError: false, refetch: vi.fn() })) as never);
});

const open = () => renderAt(<HelpPage />, { path: '/help', route: '/help' });
const track = async (v: string) => {
  if (v) await userEvent.type(screen.getByLabelText('Track an order'), v);
  await userEvent.click(screen.getByRole('button', { name: 'Track' }));
};

describe('Help: track an order', () => {
  it('opens the order page for a valid order number, tidying how it was typed', async () => {
    open();
    await track('sm 001234');
    expect(currentUrl()).toBe('/order/SM-001234');
  });

  it('asks for an order number when the box is empty or not an order number', async () => {
    open();
    await track('');
    expect(await screen.findByRole('alert')).toHaveTextContent(/Enter your order number/);
    expect(currentUrl()).toBe('/help');
    await userEvent.type(screen.getByLabelText('Track an order'), '98765 43210');
    await userEvent.click(screen.getByRole('button', { name: 'Track' }));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(currentUrl()).toBe('/help');
  });

  it('clears the error as soon as the shopper edits the box', async () => {
    open();
    await track('');
    await userEvent.type(screen.getByLabelText('Track an order'), 'S');
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
