import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

// Prices are integer paise on the wire; format for display only.
export const formatINR = (paise: number) => '₹' + (paise / 100).toLocaleString('en-IN');
