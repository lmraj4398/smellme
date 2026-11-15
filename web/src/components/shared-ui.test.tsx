import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { card, renderAt } from '@/test/render';
import { ProductGrid } from './ProductGrid';
import { Pill } from './ui/Pill';
import { Stars } from './ui/Stars';

describe('Pill', () => {
  it('is filled when active and outlined when not', () => {
    const { rerender } = render(<Pill active aria-pressed>Under ₹1,500</Pill>);
    expect(screen.getByRole('button', { name: 'Under ₹1,500' })).toHaveClass('bg-ink', 'text-ivory');
    rerender(<Pill active={false} aria-pressed={false}>Under ₹1,500</Pill>);
    expect(screen.getByRole('button', { name: 'Under ₹1,500' })).toHaveClass('bg-white');
    expect(screen.getByRole('button', { name: 'Under ₹1,500' })).not.toHaveClass('bg-ink');
  });

  it('is a plain button that does not submit a form, and passes clicks and roles through', async () => {
    const onClick = vi.fn();
    render(<form><Pill active={false} role="tab" aria-selected={false} onClick={onClick}>Bestsellers</Pill></form>);
    const tab = screen.getByRole('tab', { name: 'Bestsellers' });
    expect(tab).toHaveAttribute('type', 'button');
    await userEvent.click(tab);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('lets the caller resize it', () => {
    render(<Pill active={false} className="px-[22px]">Wide</Pill>);
    expect(screen.getByRole('button', { name: 'Wide' })).toHaveClass('px-[22px]');
    expect(screen.getByRole('button', { name: 'Wide' })).not.toHaveClass('px-5');
  });
});

describe('Stars', () => {
  it('announces the rating to screen readers and hides the glyphs from them', () => {
    const { container } = render(<Stars rating={4} />);
    expect(screen.getByText('4 out of 5')).toHaveClass('sr-only');
    expect(container.querySelector('[aria-hidden]')).toHaveTextContent('★★★★★');
  });

  it('can stay silent when the rating is written out next to it', () => {
    render(<Stars rating={4.5} label={false} />);
    expect(screen.queryByText(/out of 5/)).toBeNull();
  });

  it('rounds, and clamps to 0–5', () => {
    const { rerender } = render(<Stars rating={4.5} />);
    expect(screen.getByText('5 out of 5')).toBeInTheDocument();
    rerender(<Stars rating={99} />);
    expect(screen.getByText('5 out of 5')).toBeInTheDocument();
    rerender(<Stars rating={-1} />);
    expect(screen.getByText('0 out of 5')).toBeInTheDocument();
  });
});

describe('ProductGrid', () => {
  it('shows a card for every product', () => {
    renderAt(<ProductGrid products={[card({ id: 'a', name: 'Alpha', slug: 'alpha' }), card({ id: 'b', name: 'Beta', slug: 'beta' })]} />);
    expect(screen.getByRole('link', { name: 'Alpha' })).toHaveAttribute('href', '/product/alpha');
    expect(screen.getByRole('link', { name: 'Beta' })).toHaveAttribute('href', '/product/beta');
  });

  it('renders children after the cards (skeletons, an empty note)', () => {
    renderAt(<ProductGrid products={[card()]}><p>Nothing else here</p></ProductGrid>);
    expect(screen.getByText('Nothing else here')).toBeInTheDocument();
  });

  it('applies the chosen layout and lets the caller add classes and a role', () => {
    const { container } = renderAt(<ProductGrid products={[]} layout="trio" className="opacity-60" role="tabpanel" />);
    const grid = container.firstElementChild!;
    expect(grid).toHaveClass('md:grid-cols-3', 'opacity-60');
    expect(grid).toHaveAttribute('role', 'tabpanel');
  });
});
