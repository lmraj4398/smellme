import { compare, hash, hashSync } from 'bcryptjs';

// Cheap rounds under test so the suite stays fast; 12 everywhere else.
const ROUNDS = process.env.NODE_ENV === 'test' ? 4 : 12;

// bcrypt silently ignores bytes past 72, so cap the length instead of letting
// two different long passwords look identical.
export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 72;
export const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).+$/;
export const PASSWORD_MESSAGE = `Password must be ${PASSWORD_MIN}-${PASSWORD_MAX} characters and include a letter and a number`;

export const hashPassword = (plain: string) => hash(plain, ROUNDS);

// A real hash of a random string, compared against when the email is unknown,
// so "no such user" takes as long as "wrong password" (no timing oracle).
const DUMMY_HASH = hashSync(`dummy-${Math.random()}`, ROUNDS);

export async function verifyPassword(plain: string, hashOrNull: string | null): Promise<boolean> {
  const ok = await compare(plain, hashOrNull ?? DUMMY_HASH);
  return hashOrNull !== null && ok;
}
