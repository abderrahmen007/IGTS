import { Logger } from '@nestjs/common';
import * as argon2 from 'argon2';

const logger = new Logger('Password');

/**
 * Same parameters as the legacy Symfony "auto" hasher (PHP PASSWORD_ARGON2ID
 * defaults: m=65536, t=4, p=1). Keeping them identical means a password set in
 * the new platform still works on the old one while both run side by side.
 */
export function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 4,
    parallelism: 1,
  });
}

/**
 * Verifies a password hashed by either platform. One legacy account still has
 * a bcrypt ($2y$) hash: it is refused cleanly instead of crashing.
 */
export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  if (hash.startsWith('$argon2')) {
    try {
      return await argon2.verify(hash, plain);
    } catch (e) {
      logger.warn(`Malformed argon2 hash: ${(e as Error).message}`);
      return false;
    }
  }
  if (/^\$2[aby]\$/.test(hash)) {
    logger.warn('Login refused: account uses a legacy bcrypt hash — password must be reset');
  }
  return false;
}
