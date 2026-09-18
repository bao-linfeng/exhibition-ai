import { randomBytes, createHash, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { AuthRepository } from './auth.repository.js';
import { MailService } from '../mail/mail.service.js';
import { VerificationService } from '../verification/verification.service.js';
import type { UserSummary } from '@exhibition/contracts';
import type { User } from '@exhibition/db';

const scryptAsync = promisify(scrypt);

export class AuthService {
  // 空闲超时：8 小时无活跃则过期
  private readonly IDLE_TIMEOUT_MS = 8 * 60 * 60 * 1000;
  // 绝对过期：7 天，无论是否活跃
  private readonly ABSOLUTE_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
  // 空闲刷新节流：距上次刷新超过 1 小时才写库
  private readonly REFRESH_THRESHOLD_MS = 60 * 60 * 1000;

  constructor(
    private authRepo: AuthRepository,
    private verificationService: VerificationService,
    private mailService: MailService,
  ) {}

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private generateToken(): string {
    return randomBytes(32).toString('hex');
  }

  async login(
    email: string,
    password: string,
  ): Promise<{ sessionToken: string; user: UserSummary } | null> {
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

    const token = this.generateToken();
    const tokenHash = this.hashToken(token);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.IDLE_TIMEOUT_MS);
    const absoluteExpiresAt = new Date(
      now.getTime() + this.ABSOLUTE_DURATION_MS,
    );

    const session = await this.authRepo.createSession({
      tokenHash,
      userId: user.id,
      expiresAt,
      absoluteExpiresAt,
      createdAt: now,
    });

    if (!session) {
      return null;
    }

    return {
      sessionToken: token,
      user: this.toUserSummary(user),
    };
  }

  async logout(sessionToken: string): Promise<void> {
    const tokenHash = this.hashToken(sessionToken);
    const session = await this.authRepo.findSessionByTokenHash(tokenHash);
    if (session) {
      await this.authRepo.deleteSessionById(session.id);
    }
  }

  async validateSession(sessionToken: string): Promise<UserSummary | null> {
    const tokenHash = this.hashToken(sessionToken);
    const session = await this.authRepo.findSessionByTokenHash(tokenHash);

    if (!session) {
      return null;
    }

    const now = new Date();

    // 检查绝对过期
    if (session.absoluteExpiresAt < now) {
      await this.authRepo.deleteSessionById(session.id);
      return null;
    }

    // 检查空闲过期
    if (session.expiresAt < now) {
      await this.authRepo.deleteSessionById(session.id);
      return null;
    }

    const user = await this.authRepo.findUserById(session.userId);

    if (!user || user.status === 'disabled') {
      await this.authRepo.deleteSessionById(session.id);
      return null;
    }

    // 空闲刷新：超过阈值才写库，避免每次请求都写
    const msSinceLastActivity =
      now.getTime() - session.lastActivityAt.getTime();
    if (msSinceLastActivity > this.REFRESH_THRESHOLD_MS) {
      const newExpiresAt = new Date(now.getTime() + this.IDLE_TIMEOUT_MS);
      // 不超过绝对过期
      const clampedExpiresAt =
        newExpiresAt < session.absoluteExpiresAt
          ? newExpiresAt
          : session.absoluteExpiresAt;
      await this.authRepo.refreshSessionActivity(session.id, clampedExpiresAt);
    }

    return this.toUserSummary(user);
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
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

    const newHash = await this.hashPassword(newPassword);
    await this.authRepo.updatePassword(userId, newHash);

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
    | { sessionToken: string; user: UserSummary }
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

    const token = this.generateToken();
    const tokenHash = this.hashToken(token);
    const now = new Date();
    const session = await this.authRepo.createSession({
      tokenHash,
      userId: user.id,
      expiresAt: new Date(now.getTime() + this.IDLE_TIMEOUT_MS),
      absoluteExpiresAt: new Date(now.getTime() + this.ABSOLUTE_DURATION_MS),
      createdAt: now,
    });
    if (!session) throw new Error('Failed to create session');

    return { sessionToken: token, user: this.toUserSummary(user) };
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
