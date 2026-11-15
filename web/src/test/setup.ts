import '@testing-library/jest-dom/vitest';
import { configure } from '@testing-library/react';

// findBy*/waitFor give up after 1 s by default, which is tight when the machine is busy. A real failure still fails; it just waits longer.
configure({ asyncUtilTimeout: 5000 });
