import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { AuthRepository } from './auth.repository.js';
import type { UserSummary } from '@exhibition/contracts';

const scryptAsync = promisify(scrypt);

export class AuthService {
  private readonly SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 天

  constructor(private authRepo: AuthRepository) {}

  async login(email: string, password: string): Promise<{ sessionId: string; user: UserSummary } | null> {
    const user = await this.authRepo.findUserByEmail(email);

    if (!user || !user.passwordHash) {
      return null;
    }

    if (user.status === 'disabled') {
      return null;
    }

    const isValid = await this.verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return null;
    }

    // 创建 session - 使用数据库自动生成的 UUID
    const expiresAt = new Date(Date.now() + this.SESSION_DURATION_MS);

    const session = await this.authRepo.createSession({
      userId: user.id,
      expiresAt,
      createdAt: new Date(),
    });

    if (!session) {
      return null;
    }

    return {
      sessionId: session.id,
      user: this.toUserSummary(user),
    };
  }

  async logout(sessionId: string): Promise<void> {
    await this.authRepo.deleteSession(sessionId);
  }

  async validateSession(sessionId: string): Promise<UserSummary | null> {
    const session = await this.authRepo.findSessionById(sessionId);

    if (!session) {
      return null;
    }

    if (session.expiresAt < new Date()) {
      await this.authRepo.deleteSession(sessionId);
      return null;
    }

    const user = await this.authRepo.findUserById(session.userId);

    if (!user || user.status === 'disabled') {
      await this.authRepo.deleteSession(sessionId);
      return null;
    }

    return this.toUserSummary(user);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<boolean> {
    const user = await this.authRepo.findUserById(userId);

    if (!user || !user.passwordHash) {
      return false;
    }

    const isValid = await this.verifyPassword(currentPassword, user.passwordHash);
    if (!isValid) {
      return false;
    }

    const newHash = await this.hashPassword(newPassword);

    // 这里需要 UserRepository 来更新密码，暂时简化
    // await this.userRepo.updatePassword(userId, newHash);

    return true;
  }

  private async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
    return `${salt}:${derivedKey.toString('hex')}`;
  }

  private async verifyPassword(password: string, hash: string): Promise<boolean> {
    const parts = hash.split(':');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      return false;
    }

    const salt = parts[0];
    const key = parts[1];
    const keyBuffer = Buffer.from(key, 'hex');
    const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
    return timingSafeEqual(keyBuffer, derivedKey);
  }

  private toUserSummary(user: any): UserSummary {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      status: user.status,
      mustChangePassword: user.mustChangePassword || false,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
