import { ConfigService } from '@nestjs/config';

/**
 * The API refuses to start without a real JWT secret. A hard-coded fallback
 * would let anyone forge an admin token if the variable were missing in prod.
 */
export function requireJwtSecret(config: ConfigService): string {
  const secret = config.get<string>('JWT_SECRET');
  if (!secret || secret.length < 32) {
    throw new Error(
      'JWT_SECRET is missing or too short (min. 32 characters). ' +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"',
    );
  }
  return secret;
}
