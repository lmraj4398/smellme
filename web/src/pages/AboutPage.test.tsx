import { screen } from '@testing-library/react';
import * as content from '@/api/content';
import type { AboutContent, SiteContent } from '@/api/content';
import { Footer } from '@/components/layout/Footer';
import { renderAt } from '@/test/render';
import AboutPage from './AboutPage';

vi.mock('@/api/content', async (orig) => ({ ...(await orig<typeof import('@/api/content')>()), useContent: vi.fn() }));

const about = (over: Partial<AboutContent> = {}): AboutContent => ({
  hero: { eyebrow: 'Our story', heading: 'Perfume should be *tried*, not guessed.', body: '' },
  story: { kicker: 'Two shelves', heading: 'The world’s houses', paragraph_1: 'One.', paragraph_2: 'Two.', image: '' },
  values: { heading: 'What we stand for', items: [{ title: 'Authentic, always', body: 'Sealed.' }] },
  steps: { eyebrow: 'How', heading: 'From raw ingredient', items: [{ title: 'Source', body: '' }, { title: 'Compose', body: '' }] },
  visit: { eyebrow: 'Visit us', place: '', details: '', cta_label: 'Shop online' },
  ...over,
});
const site = (over: Partial<SiteContent['site']> = {}) => ({ site: { announcement: '', tagline: 'Authentic perfumes.', whatsapp: '', phone: '', email: '', hours: '', instagram: '', youtube: '', ...over } });
const use = (data: unknown) => vi.mocked(content.useContent).mockReturnValue({ data, isLoading: false, isError: false, refetch: vi.fn() } as never);

describe('AboutPage', () => {
  it('hides the "how it is made" block while every step is blank, and the visit card until a place is set', () => {
    use(about());
    renderAt(<AboutPage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Perfume should be tried, not guessed.');
    expect(screen.queryByText('From raw ingredient')).toBeNull();
    expect(screen.queryByText('Visit us')).toBeNull();
    expect(screen.getByText('Authentic, always')).toBeInTheDocument();
  });

  it('shows only the steps that have text, renumbered', () => {
    use(about({ steps: { eyebrow: 'How', heading: 'From raw ingredient', items: [{ title: 'Source', body: '' }, { title: 'Compose', body: 'Our perfumer tests each blend.' }] } }));
    renderAt(<AboutPage />);
    expect(screen.getByText('From raw ingredient')).toBeInTheDocument();
    expect(screen.queryByText('Source')).toBeNull();
    expect(screen.getByText('STEP 01')).toBeInTheDocument();
    expect(screen.getByText('Compose')).toBeInTheDocument();
  });

  it('shows the visit card once a place is entered', () => {
    use(about({ visit: { eyebrow: 'Visit us', place: 'SmellMe Studio, Bengaluru', details: '10–7', cta_label: 'Shop online' } }));
    renderAt(<AboutPage />);
    expect(screen.getByText('SmellMe Studio, Bengaluru')).toBeInTheDocument();
  });
});

describe('Footer contact + links', () => {
  it('shows only the contact details that are set', () => {
    use(site({ email: 'care@smellme.in', hours: 'Mon–Sat' }));
    renderAt(<Footer />);
    expect(screen.getByRole('link', { name: 'care@smellme.in' })).toHaveAttribute('href', 'mailto:care@smellme.in');
    expect(screen.queryByText(/^WhatsApp/)).toBeNull();
  });

  it('shows no "Talk to us" column at all when nothing is set', () => {
    use(site());
    renderAt(<Footer />);
    expect(screen.queryByText('Talk to us')).toBeNull();
  });

  it('never renders a javascript: or other non-http social link', () => {
    use(site({ instagram: 'javascript:alert(1)', youtube: 'https://youtube.com/@smellme' }));
    renderAt(<Footer />);
    expect(screen.queryByRole('link', { name: 'Instagram' })).toBeNull();
    expect(screen.getByRole('link', { name: 'YouTube' })).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
