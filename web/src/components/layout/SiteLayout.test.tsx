import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SiteLayout } from './SiteLayout';

vi.mock('@/api/content', () => ({ useContent: () => ({ data: undefined }) }));

const open = (path = '/') =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <Routes><Route element={<SiteLayout />}><Route path="*" element={<p>page body</p>} /></Route></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

describe('SiteLayout', () => {
  afterEach(() => vi.restoreAllMocks());

  it('renders the page, and scrolls to the top on arrival', () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    open('/shop');
    expect(screen.getByText('page body')).toBeInTheDocument();
    expect(scrollTo).toHaveBeenCalledWith(0, 0);
  });

  // Chrome 155 returns a Promise from window.scrollTo. If the effect hands that back to React as its clean-up, React
  // throws "destroy is not a function" and the whole site is a blank page.
  it('still renders when the browser returns a Promise from scrollTo', () => {
    vi.spyOn(window, 'scrollTo').mockImplementation((() => Promise.resolve()) as never);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    open('/shop');
    expect(screen.getByText('page body')).toBeInTheDocument();
    expect(error).not.toHaveBeenCalledWith(expect.stringContaining('must not return anything besides a function'), expect.anything(), expect.anything());
  });
});
