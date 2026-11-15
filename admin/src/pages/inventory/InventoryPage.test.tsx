import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { inventoryApi } from '@/api/inventory.api';
import { renderPage, signIn } from '@/test/render-page';
import InventoryPage from './InventoryPage';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));
vi.mock('@/api/inventory.api', async (orig) => ({
  ...(await orig<typeof import('@/api/inventory.api')>()),
  inventoryApi: { list: vi.fn(), ledger: vi.fn(), adjust: vi.fn() },
}));

const row = {
  variant_id: 'v1', sku: 'sd-50', label: '50 ml', size_ml: 50, stock: 5, low_stock_at: 3, is_active: true,
  product_id: 'p1', product_name: 'Saffron Dusk', product_active: true, brand: 'SmellMe Originals',
};

beforeEach(() => {
  signIn();
  vi.mocked(inventoryApi.list).mockResolvedValue({ total: 1, page: 1, limit: 30, items: [row] });
  vi.mocked(inventoryApi.adjust).mockResolvedValue({ stock: 7 });
});

async function openAdjust() {
  renderPage(<InventoryPage />);
  await userEvent.click(await screen.findByRole('button', { name: /adjust/i }));
  return screen.getByRole('dialog', { name: /adjust stock/i });
}

describe('InventoryPage', () => {
  it('lists stock with the quantity on hand', async () => {
    renderPage(<InventoryPage />);
    expect(await screen.findByText('Saffron Dusk')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('blocks removing more than is in stock, and says why, without calling the API', async () => {
    await openAdjust();
    await userEvent.click(screen.getByRole('button', { name: /remove stock/i }));
    await userEvent.type(screen.getByLabelText('Quantity'), '6');
    expect(screen.getByRole('alert')).toHaveTextContent('Only 5 in stock');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(inventoryApi.adjust).not.toHaveBeenCalled();
  });

  it('previews the result and sends a signed delta with the chosen reason', async () => {
    await openAdjust();
    await userEvent.type(screen.getByLabelText('Quantity'), '2');
    expect(screen.getByText(/After this:/)).toHaveTextContent('7');
    await userEvent.selectOptions(screen.getByLabelText('Reason'), 'purchase');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(inventoryApi.adjust).toHaveBeenCalledWith('v1', { delta: 2, reason: 'purchase', note: undefined }));
  });

  it('sends a negative delta when removing', async () => {
    await openAdjust();
    await userEvent.click(screen.getByRole('button', { name: /remove stock/i }));
    await userEvent.type(screen.getByLabelText('Quantity'), '1');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(inventoryApi.adjust).toHaveBeenCalledWith('v1', { delta: -1, reason: 'damage', note: undefined }));
  });

  it('ignores non-digits and keeps Save disabled for zero', async () => {
    await openAdjust();
    const qty = screen.getByLabelText('Quantity');
    await userEvent.type(qty, '-1.5e');
    expect(qty).toHaveValue('15');
    await userEvent.clear(qty);
    await userEvent.type(qty, '0');
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('shows the server message when the change is refused', async () => {
    vi.mocked(inventoryApi.adjust).mockRejectedValue(Object.assign(new Error('x'), { isAxiosError: true, response: { status: 409, data: { message: 'Not enough stock' } } }));
    await openAdjust();
    await userEvent.type(screen.getByLabelText('Quantity'), '1');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/not enough stock|something went wrong/i);
  });
});
