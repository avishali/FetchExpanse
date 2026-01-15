import { logger } from '../logging/logger';

export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delayMs = 1000
): Promise<T> {
  let attempt = 0;
  while (attempt < retries) {
    try {
      return await fn();
    } catch (error) {
      attempt++;
      if (attempt >= retries) {
        throw error;
      }
      logger.warn(`Retrying operation... (${attempt}/${retries})`, { error });
      await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
    }
  }
  throw new Error('Unreachable');
}
