import { render, screen } from '@testing-library/react';
import { Emphasis } from './Emphasis';

describe('Emphasis', () => {
  it('turns *starred* words into <em>', () => {
    const { container } = render(<p><Emphasis text="Find the scent that *stays* with you." /></p>);
    expect(container.querySelectorAll('em')).toHaveLength(1);
    expect(screen.getByText('stays').tagName).toBe('EM');
    expect(container.textContent).toBe('Find the scent that stays with you.');
  });

  it('handles several emphasised words', () => {
    const { container } = render(<Emphasis text="*a* b *c*" />);
    expect([...container.querySelectorAll('em')].map((e) => e.textContent)).toEqual(['a', 'c']);
  });

  it('leaves plain text, and a stray single asterisk, alone', () => {
    expect(render(<Emphasis text="No emphasis here" />).container.querySelector('em')).toBeNull();
    const { container } = render(<Emphasis text="5 * 3" />);
    expect(container.querySelector('em')).toBeNull();
    expect(container.textContent).toBe('5 * 3'); // an unpaired star is shown literally
  });

  it('an unpaired star never italicises the rest of the sentence', () => {
    const { container } = render(<Emphasis text="Hello *world and more" />);
    expect(container.querySelector('em')).toBeNull();
    expect(container.textContent).toBe('Hello *world and more');
    const mixed = render(<Emphasis text="*one* two *three" />);
    expect([...mixed.container.querySelectorAll('em')].map((e) => e.textContent)).toEqual(['one']);
    expect(mixed.container.textContent).toBe('one two *three');
  });

  it('never parses HTML: markup in copy is shown as inert text', () => {
    const { container } = render(<Emphasis text={'<img src=x onerror=alert(1)> *<b>x</b>*'} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('b')).toBeNull();
    expect(container.textContent).toContain('<img src=x onerror=alert(1)>');
  });
});
