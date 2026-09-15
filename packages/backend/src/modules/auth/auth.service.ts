import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { AuthRepository } from './auth.repository.js';
import { MailService } from '../mail/mail.service.js';
import { VerificationService } from '../verification/verification.service.js';
import type { UserSummary } from '@exhibition/contracts';
import type { User } from '@exhibition/db';

const scryptAsync = promisify(scrypt);

export class AuthService {
  private readonly SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 天

  constructor(
    private authRepo: AuthRepository,
    private verificationService: VerificationService,
    private mailService: MailService,
  ) {}

  async login(
    email: string,
    password: string,
  ): Promise<{ sessionId: string; user: UserSummary } | null> {
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

  async changePassword(
    userId: string,
    currentPassword: string,
    _newPassword: string,
  ): Promise<boolean> {
    const user = await this.authRepo.findUserById(userId);

    if (!user || !user.passwordHash) {
      return false;
    }

    const isValid = await this.verifyPassword(
      currentPassword,
      user.passwordHash,
    );
    if (!isValid) {
      return false;
    }

    // 这里需要 UserRepository 来更新密码，暂时简化

    return true;
  }

  async sendVerificationCode(
    email: string,
    type: 'register' | 'reset_password',
  ): Promise<'ok' | 'rate_limited' | 'already_registered' | 'not_found'> {
    const user = await this.authRepo.findUserByEmail(email);
    if (type === 'register' && user) return 'already_registered';
    if (type === 'reset_password' && !user) return 'not_found';

    const result = await this.verificationService.sendCode(email, type);
    if (result === 'rate_limited') return result;

    const code = await this.verificationService.getCode(email, type);
    if (!code) throw new Error('Failed to retrieve verification code');
    await this.mailService.sendVerificationCode(email, code, type);
    return 'ok';
  }

  async register(
    email: string,
    code: string,
    displayName: string,
    password: string,
  ): Promise<
    | { sessionId: string; user: UserSummary }
    | 'invalid_code'
    | 'already_registered'
  > {
    const isValid = await this.verificationService.verifyCode(
      email,
      'register',
      code,
    );
    if (!isValid) return 'invalid_code';

    if (await this.authRepo.findUserByEmail(email)) {
      return 'already_registered';
    }

    const user = await this.authRepo.createUser(
      email,
      displayName,
      await this.hashPassword(password),
    );
    const session = await this.authRepo.createSession({
      userId: user.id,
      expiresAt: new Date(Date.now() + this.SESSION_DURATION_MS),
      createdAt: new Date(),
    });
    if (!session) throw new Error('Failed to create session');

    return { sessionId: session.id, user: this.toUserSummary(user) };
  }

  async forgotPassword(
    email: string,
    code: string,
    newPassword: string,
  ): Promise<'ok' | 'invalid_code' | 'not_found'> {
    const isValid = await this.verificationService.verifyCode(
      email,
      'reset_password',
      code,
    );
    if (!isValid) return 'invalid_code';

    const user = await this.authRepo.findUserByEmail(email);
    if (!user) return 'not_found';

    await this.authRepo.updatePassword(
      user.id,
      await this.hashPassword(newPassword),
    );
    await this.authRepo.deleteSessionsByUserId(user.id);
    return 'ok';
  }

  private async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
    return `${salt}:${derivedKey.toString('hex')}`;
  }

  private async verifyPassword(
    password: string,
    hash: string,
  ): Promise<boolean> {
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

  private toUserSummary(user: User): UserSummary {
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
