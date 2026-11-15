import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ListCard } from './ListCard';
import { PillTabs } from './PillTabs';
import { QueryStatus } from './QueryStatus';
import { Stars } from './Stars';

describe('PillTabs', () => {
  const items = [{ id: 'a', label: 'Alpha' }, { id: 'b', label: 'Beta' }] as const;

  it('marks the current tab and reports a click', async () => {
    const onChange = vi.fn();
    render(<PillTabs label="Letters" items={items} value="a" onChange={onChange} />);
    expect(screen.getByRole('tablist', { name: 'Letters' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Alpha' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Beta' })).toHaveAttribute('aria-selected', 'false');
    await userEvent.click(screen.getByRole('tab', { name: 'Beta' }));
    expect(onChange).toHaveBeenCalledWith('b');
  });

  it('accepts extra classes on the row', () => {
    render(<PillTabs label="Letters" items={items} value="a" onChange={() => undefined} className="mb-0" />);
    expect(screen.getByRole('tablist')).toHaveClass('mb-0');
  });
});

describe('ListCard', () => {
  it('wraps its rows in a bordered, divided list', () => {
    render(<ListCard><li>One</li><li>Two</li></ListCard>);
    expect(screen.getByRole('list')).toHaveClass('divide-y', 'rounded-lg', 'border');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });
});

describe('QueryStatus', () => {
  it('shows nothing once data has arrived', () => {
    const { container } = render(<QueryStatus isLoading={false} isError={false} onRetry={() => undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('announces loading', () => {
    render(<QueryStatus isLoading isError={false} onRetry={() => undefined} />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading…');
  });

  it('says what could not be loaded and offers a retry', async () => {
    const onRetry = vi.fn();
    render(<QueryStatus isLoading={false} isError onRetry={onRetry} what="orders" />);
    expect(screen.getByText(/Could not load orders\./)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('has a generic message when no subject is given', () => {
    render(<QueryStatus isLoading={false} isError onRetry={() => undefined} />);
    expect(screen.getByText(/^Could not load\./)).toBeInTheDocument();
  });
});

describe('Stars', () => {
  it('reads out the rating and clamps it to 0–5', () => {
    const { rerender } = render(<Stars rating={4} />);
    expect(screen.getByRole('img', { name: '4 out of 5' })).toBeInTheDocument();
    rerender(<Stars rating={9} />);
    expect(screen.getByRole('img', { name: '5 out of 5' })).toBeInTheDocument();
    rerender(<Stars rating={-2} />);
    expect(screen.getByRole('img', { name: '0 out of 5' })).toBeInTheDocument();
  });
});
