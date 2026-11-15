import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { catalogApi } from '@/api/catalog.api';
import { renderPage, signIn } from '@/test/render-page';
import ProductFormPage from './ProductFormPage';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));
vi.mock('@/api/catalog.api', async (orig) => ({
  ...(await orig<typeof import('@/api/catalog.api')>()),
  catalogApi: {
    brands: vi.fn(), families: vi.fn(), notes: vi.fn(), product: vi.fn(), createProduct: vi.fn(), updateProduct: vi.fn(),
  },
}));
vi.mock('@/api/uploads.api', () => ({ uploadImage: vi.fn() }));

beforeEach(() => {
  signIn();
  vi.mocked(catalogApi.brands).mockResolvedValue([{ id: 'b1', name: 'SmellMe Originals', slug: 's', is_original: true, sort_order: 0, is_active: true }]);
  vi.mocked(catalogApi.families).mockResolvedValue([{ id: 'f1', name: 'Amber', slug: 'a', tint: '#F3E6D6', ink: '#9A6A2E', notes_hint: '', sort_order: 0, is_active: true }]);
  vi.mocked(catalogApi.notes).mockResolvedValue([{ id: 'n1', name: 'Saffron', color: '#E8B46A' }, { id: 'n2', name: 'Rose', color: '#E2A5A8' }]);
  vi.mocked(catalogApi.createProduct).mockResolvedValue({ id: 'new1' } as never);
});

const open = () => renderPage(<ProductFormPage />, { path: '/products/new', route: '/products/new' });
const save = () => userEvent.click(screen.getByRole('button', { name: /create product/i }));

describe('ProductFormPage (new)', () => {
  it('does not call the API when required fields are missing, and shows the errors beside them', async () => {
    open();
    await screen.findByRole('option', { name: 'SmellMe Originals' });
    await save();
    expect(await screen.findByText('Enter a name')).toBeInTheDocument();
    expect(screen.getByText('Choose a brand')).toBeInTheDocument();
    expect(screen.getByText('Choose a scent family')).toBeInTheDocument();
    expect(screen.getAllByText(/Enter an amount like 2850/).length).toBeGreaterThan(0);
    expect(catalogApi.createProduct).not.toHaveBeenCalled();
  });

  it('sends exact paise, opening stock, and the chosen notes when the form is valid', async () => {
    open();
    await screen.findByRole('option', { name: 'SmellMe Originals' });
    await userEvent.type(screen.getByLabelText('Name'), 'Saffron Dusk');
    await userEvent.selectOptions(screen.getByLabelText('Brand'), 'b1');
    await userEvent.selectOptions(screen.getByLabelText('Scent family'), 'f1');

    const sizes = screen.getAllByRole('group'); // the two default size rows (fieldsets)
    const sample = sizes[0];
    const bottle = sizes[1];
    await userEvent.type(within(sample).getByLabelText('Price ₹'), '190');
    await userEvent.type(within(bottle).getByLabelText('Price ₹'), '2,850.50');
    await userEvent.type(within(bottle).getByLabelText('Opening stock'), '12');

    await userEvent.selectOptions(screen.getByLabelText('Add to Top notes'), 'n1');
    await save();

    await waitFor(() => expect(catalogApi.createProduct).toHaveBeenCalledTimes(1));
    const body = vi.mocked(catalogApi.createProduct).mock.calls[0][0];
    expect(body.name).toBe('Saffron Dusk');
    expect(body.variants.map((v) => [v.label, v.price_paise, v.is_sample])).toEqual([['2 ml sample', 19000, true], ['50 ml', 285050, false]]);
    expect(body.variants[1].stock).toBe(12);
    expect(body.notes).toEqual([{ note_id: 'n1', tier: 'top' }]);
    expect(body).not.toHaveProperty('slug'); // blank, so the server derives it
  });

  it('rejects an MRP lower than the price', async () => {
    open();
    await screen.findByRole('option', { name: 'SmellMe Originals' });
    const bottle = screen.getAllByRole('group')[1];
    await userEvent.type(within(bottle).getByLabelText('Price ₹'), '3000');
    await userEvent.type(within(bottle).getByLabelText('MRP ₹'), '2500');
    await save();
    expect(await screen.findByText('MRP cannot be below the price')).toBeInTheDocument();
  });

  it('shows the server\'s message if saving fails, and keeps the form filled in', async () => {
    vi.mocked(catalogApi.createProduct).mockRejectedValue(Object.assign(new Error('x'), { isAxiosError: true, response: { status: 409, data: { message: 'A product or SKU with this name already exists' } } }));
    open();
    await screen.findByRole('option', { name: 'SmellMe Originals' });
    await userEvent.type(screen.getByLabelText('Name'), 'Saffron Dusk');
    await userEvent.selectOptions(screen.getByLabelText('Brand'), 'b1');
    await userEvent.selectOptions(screen.getByLabelText('Scent family'), 'f1');
    for (const g of screen.getAllByRole('group')) await userEvent.type(within(g).getByLabelText('Price ₹'), '100');
    await save();
    expect(await screen.findByRole('alert')).toHaveTextContent(/already exists|could not save/i);
    expect(screen.getByLabelText('Name')).toHaveValue('Saffron Dusk');
  });

  it('can remove a new size but never the last one', async () => {
    open();
    await screen.findByRole('option', { name: 'SmellMe Originals' });
    expect(screen.getAllByRole('button', { name: /remove this new size/i })).toHaveLength(2);
    await userEvent.click(screen.getAllByRole('button', { name: /remove this new size/i })[0]);
    expect(screen.queryByRole('button', { name: /remove this new size/i })).toBeNull();
  });
});
