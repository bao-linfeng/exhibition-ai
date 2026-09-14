import { eq } from 'drizzle-orm';
import type { Database } from '@exhibition/db';
import { users, sessions } from '@exhibition/db';
import type { User, NewSession } from '@exhibition/db';

export class AuthRepository {
  constructor(private db: Database) {}

  async findUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    return user;
  }

  async findUserById(id: string): Promise<User | undefined> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return user;
  }

  async createSession(session: NewSession) {
    const [created] = await this.db
      .insert(sessions)
      .values(session)
      .returning();
    return created;
  }

  async findSessionById(id: string) {
    const [session] = await this.db
      .select()
      .from(sessions)
      .where(eq(sessions.id, id))
      .limit(1);
    return session;
  }

  async deleteSession(id: string): Promise<void> {
    await this.db.delete(sessions).where(eq(sessions.id, id));
  }

  async deleteUserSessions(userId: string): Promise<void> {
    await this.db.delete(sessions).where(eq(sessions.userId, userId));
  }

  async updateSessionExpiry(id: string, expiresAt: Date): Promise<void> {
    await this.db
      .update(sessions)
      .set({ expiresAt })
      .where(eq(sessions.id, id));
  }
}
