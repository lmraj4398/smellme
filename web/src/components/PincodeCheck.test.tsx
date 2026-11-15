import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { commerceApi } from '@/api/commerce';
import { PincodeCheck } from './PincodeCheck';

vi.mock('@/api/commerce', () => ({ commerceApi: { checkPincode: vi.fn() } }));

const type = async (v: string) => userEvent.type(screen.getByLabelText('Check delivery to your pincode'), v);
const check = () => userEvent.click(screen.getByRole('button', { name: 'Check' }));

describe('PincodeCheck', () => {
  it('only enables Check for a valid 6-digit pincode', async () => {
    render(<PincodeCheck />);
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
    await type('5600');
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
    await type('01');
    expect(screen.getByRole('button', { name: 'Check' })).toBeEnabled();
  });

  it('shows the delivery estimate for a serviceable pincode', async () => {
    vi.mocked(commerceApi.checkPincode).mockResolvedValue({ pincode: '560001', serviceable: true, eta_text: '3–5 working days' });
    render(<PincodeCheck />);
    await type('560001');
    await check();
    expect(await screen.findByText(/We deliver to 560001 — 3–5 working days/)).toBeInTheDocument();
    expect(commerceApi.checkPincode).toHaveBeenCalledWith('560001');
  });

  it('says so when a pincode is not serviceable', async () => {
    vi.mocked(commerceApi.checkPincode).mockResolvedValue({ pincode: '110001', serviceable: false, eta_text: '' });
    render(<PincodeCheck />);
    await type('110001');
    await check();
    expect(await screen.findByText(/can’t deliver to 110001/)).toBeInTheDocument();
  });

  it('shows a retry message when the check fails, and clears the result on edit', async () => {
    vi.mocked(commerceApi.checkPincode).mockRejectedValue(new Error('network'));
    render(<PincodeCheck />);
    await type('560001');
    await check();
    expect(await screen.findByText(/couldn’t check that/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Check delivery to your pincode'), '{backspace}');
    expect(screen.queryByText(/couldn’t check that/)).not.toBeInTheDocument();
  });
});
