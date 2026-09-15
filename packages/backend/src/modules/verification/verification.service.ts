import { randomInt } from 'node:crypto';
import type { Redis } from 'ioredis';

export class VerificationService {
  constructor(private readonly redis: Redis) {}

  private rateKey(email: string, type: string): string {
    return `verification:rate:${type}:${email}`;
  }

  private codeKey(email: string, type: string): string {
    return `verification:code:${type}:${email}`;
  }

  async sendCode(
    email: string,
    type: 'register' | 'reset_password',
  ): Promise<'ok' | 'rate_limited'> {
    const rateKey = this.rateKey(email, type);
    const exists = await this.redis.exists(rateKey);
    if (exists) return 'rate_limited';

    const code = String(randomInt(100000, 999999));
    const codeKey = this.codeKey(email, type);
    const pipeline = this.redis.pipeline();
    pipeline.setex(codeKey, 600, code);
    pipeline.setex(rateKey, 60, '1');
    await pipeline.exec();
    return 'ok';
  }

  async verifyCode(
    email: string,
    type: 'register' | 'reset_password',
    code: string,
  ): Promise<boolean> {
    const codeKey = this.codeKey(email, type);
    const stored = await this.redis.get(codeKey);
    if (!stored || stored !== code) return false;
    await this.redis.del(codeKey);
    return true;
  }

  async getCode(
    email: string,
    type: 'register' | 'reset_password',
  ): Promise<string | null> {
    return this.redis.get(this.codeKey(email, type));
  }
}
