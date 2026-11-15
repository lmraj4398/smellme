import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SectionSpec } from '@/api/content.api';
import { SectionEditor } from './SectionEditor';

vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/api/uploads.api', () => ({ uploadImage: vi.fn() }));

const spec: SectionSpec = {
  key: 'moments', title: 'Moments',
  fields: [
    { type: 'text', key: 'heading', label: 'Heading', max: 30, required: true, hint: 'Use *asterisks*' },
    { type: 'list', key: 'items', label: 'Moments', itemLabel: 'moment', max: 3, fields: [
      { type: 'text', key: 'label', label: 'Title', required: true },
      { type: 'text', key: 'sub', label: 'Small text' },
    ] },
  ],
};
const value = { heading: 'A scent for every occasion', items: [{ label: 'Office hours', sub: 'Clean' }, { label: 'Date night', sub: 'Warm' }] };

function setup(over: Partial<React.ComponentProps<typeof SectionEditor>> = {}) {
  const props = { spec, value, mediaBase: 'https://cdn.test', saving: false, customised: false, onSave: vi.fn(), onReset: vi.fn(), onCancel: vi.fn(), ...over };
  render(<SectionEditor {...props} />);
  return props;
}

describe('SectionEditor (generated from the section spec)', () => {
  it('renders every field, including each list entry', () => {
    setup();
    expect(screen.getByLabelText(/Heading/)).toHaveValue('A scent for every occasion');
    expect(screen.getAllByLabelText(/^Title/)).toHaveLength(2);
    expect(screen.getByRole('button', { name: /add moment/i })).toBeEnabled();
  });

  it('keeps Save disabled until something changes', async () => {
    setup();
    expect(screen.getByRole('button', { name: 'Save section' })).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/Heading/), '!');
    expect(screen.getByRole('button', { name: 'Save section' })).toBeEnabled();
  });

  it('saves the edited section as plain data', async () => {
    const { onSave } = setup();
    const heading = screen.getByLabelText(/Heading/);
    await userEvent.clear(heading);
    await userEvent.type(heading, 'Any *moment*');
    await userEvent.click(screen.getByRole('button', { name: 'Save section' }));
    expect(onSave).toHaveBeenCalledWith({ ...value, heading: 'Any *moment*' });
  });

  it('adds a blank entry, and refuses to save it until its required field is filled (error beside the field)', async () => {
    const { onSave } = setup();
    await userEvent.click(screen.getByRole('button', { name: /add moment/i }));
    expect(screen.getAllByLabelText(/^Title/)).toHaveLength(3);
    await userEvent.click(screen.getByRole('button', { name: 'Save section' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(await screen.findByText('Required')).toBeInTheDocument();
    await userEvent.type(screen.getAllByLabelText(/^Title/)[2], 'Monsoon');
    await userEvent.click(screen.getByRole('button', { name: 'Save section' }));
    expect(onSave).toHaveBeenCalledWith({ ...value, items: [...value.items, { label: 'Monsoon', sub: '' }] });
  });

  it('stops adding at the limit', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: /add moment/i }));
    expect(screen.getByRole('button', { name: /add moment/i })).toBeDisabled();
    expect(screen.getByText('Up to 3')).toBeInTheDocument();
  });

  it('removes and reorders entries', async () => {
    const { onSave } = setup();
    await userEvent.click(screen.getByRole('button', { name: 'Move moment 2 up' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save section' }));
    expect(onSave).toHaveBeenLastCalledWith({ ...value, items: [value.items[1], value.items[0]] });
    await userEvent.click(screen.getByRole('button', { name: 'Remove moment 1' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save section' }));
    expect(onSave).toHaveBeenLastCalledWith({ ...value, items: [value.items[0]] });
  });

  it('disables the first "up" and last "down" arrows', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Move moment 1 up' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move moment 2 down' })).toBeDisabled();
  });

  it('blocks markup and over-long text', async () => {
    const { onSave } = setup();
    const heading = screen.getByLabelText(/Heading/);
    await userEvent.clear(heading);
    await userEvent.type(heading, '<b>hi</b>');
    await userEvent.click(screen.getByRole('button', { name: 'Save section' }));
    expect(await screen.findByText(/Cannot contain/)).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('hides "Reset to original" for sections that are still the original wording', () => {
    setup({ customised: false });
    expect(screen.queryByRole('button', { name: /reset to original/i })).toBeNull();
  });

  it('confirms before resetting', async () => {
    const confirm = vi.spyOn(window, 'confirm');
    const { onReset } = setup({ customised: true });
    confirm.mockReturnValueOnce(false);
    await userEvent.click(screen.getByRole('button', { name: /reset to original/i }));
    expect(onReset).not.toHaveBeenCalled();
    confirm.mockReturnValueOnce(true);
    await userEvent.click(screen.getByRole('button', { name: /reset to original/i }));
    expect(onReset).toHaveBeenCalledTimes(1);
    confirm.mockRestore();
  });

  it('shows the server error', () => {
    setup({ error: 'items[1].label: is required' });
    expect(within(screen.getByRole('alert')).getByText(/items\[1\]\.label/)).toBeInTheDocument();
  });
});
