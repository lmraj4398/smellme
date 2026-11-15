import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { commerceApi } from '@/api/commerce.api';
import { renderPage, signIn } from '@/test/render-page';
import SettingsPage from './SettingsPage';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/api/commerce.api', () => ({ commerceApi: { shop: vi.fn(), saveShop: vi.fn(), payment: vi.fn(), savePayment: vi.fn() } }));

const shop = { free_delivery_over_paise: 200000, delivery_fee_paise: 9900, gift_wrap_paise: 15000, free_samples_count: 2, delivery_eta_text: '3–7 working days' };

beforeEach(() => {
  vi.mocked(commerceApi.shop).mockResolvedValue(shop);
  vi.mocked(commerceApi.saveShop).mockImplementation(async (b) => b);
  vi.mocked(commerceApi.payment).mockResolvedValue({ upi_vpa: 'smellme@okhdfcbank', upi_payee_name: 'SmellMe' });
  vi.mocked(commerceApi.savePayment).mockImplementation(async (b) => b);
});

describe('Settings: delivery & gift wrap', () => {
  it('shows prices in rupees and saves exact paise', async () => {
    signIn();
    renderPage(<SettingsPage />);
    const fee = await screen.findByLabelText(/Delivery charge below/);
    expect(fee).toHaveValue('99');
    await userEvent.clear(fee);
    await userEvent.type(fee, '149.50');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(commerceApi.saveShop).toHaveBeenCalledWith({ ...shop, delivery_fee_paise: 14950 }));
  });

  it('refuses nonsense without calling the API', async () => {
    signIn();
    renderPage(<SettingsPage />);
    const wrap = await screen.findByLabelText(/Gift wrap/);
    await userEvent.clear(wrap);
    await userEvent.type(wrap, 'free');
    await userEvent.clear(screen.getByLabelText(/Free samples/));
    await userEvent.type(screen.getByLabelText(/Free samples/), '9');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findAllByText(/Enter an amount|0 to 5/)).toHaveLength(2);
    expect(commerceApi.saveShop).not.toHaveBeenCalled();
  });
});

describe('Settings: the payment address', () => {
  it('is hidden from a login that is not the owner, and is never even requested', async () => {
    signIn({ screens: ['settings'] });
    renderPage(<SettingsPage />);
    expect(await screen.findByText(/managed by the owner only/i)).toBeInTheDocument();
    expect(screen.queryByLabelText('UPI address')).toBeNull();
    expect(commerceApi.payment).not.toHaveBeenCalled();
  });

  it('the owner sees it, and Save is disabled until something changes', async () => {
    signIn();
    renderPage(<SettingsPage />);
    expect(await screen.findByLabelText('UPI address')).toHaveValue('smellme@okhdfcbank');
    expect(screen.getByRole('button', { name: 'Save payment address' })).toBeDisabled();
  });

  it.each(['nobank', 'a@', 'two words@upi', ''])('rejects the address %j', async (bad) => {
    signIn();
    renderPage(<SettingsPage />);
    const vpa = await screen.findByLabelText('UPI address');
    await userEvent.clear(vpa);
    if (bad) await userEvent.type(vpa, bad);
    await userEvent.click(screen.getByRole('button', { name: 'Save payment address' }));
    expect(commerceApi.savePayment).not.toHaveBeenCalled();
  });

  it('asks for confirmation before repointing where customers pay, and does nothing if declined', async () => {
    signIn();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderPage(<SettingsPage />);
    const vpa = await screen.findByLabelText('UPI address');
    await userEvent.clear(vpa);
    await userEvent.type(vpa, 'new@ybl');
    await userEvent.click(screen.getByRole('button', { name: 'Save payment address' }));
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('smellme@okhdfcbank'));
    expect(commerceApi.savePayment).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    await userEvent.click(screen.getByRole('button', { name: 'Save payment address' }));
    await waitFor(() => expect(commerceApi.savePayment).toHaveBeenCalledWith({ upi_vpa: 'new@ybl', upi_payee_name: 'SmellMe' }));
    confirm.mockRestore();
  });

  it('warns loudly when no payment address is set at all', async () => {
    signIn();
    vi.mocked(commerceApi.payment).mockResolvedValue({ upi_vpa: '', upi_payee_name: 'SmellMe' });
    renderPage(<SettingsPage />);
    const warn = await screen.findByText(/No payment address is set/);
    expect(within(warn.closest('form')!).getByRole('alert')).toBeInTheDocument();
  });
});
