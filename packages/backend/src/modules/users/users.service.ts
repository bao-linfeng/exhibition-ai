import type { ListUsersQuery, User as UserContract, UserOption, UserSummary, UpdateUserRequest } from '@exhibition/contracts';
import type { User as DbUser } from '@exhibition/db';
import { UserRepository } from './users.repository.js';

export class UserService {
  constructor(private repo: UserRepository) {}

  async listUsers(query: ListUsersQuery, requestingUser: UserSummary): Promise<{ data: UserContract[]; page: { nextCursor: string | null; hasMore: boolean } } | 'forbidden'> {
    if (requestingUser.role !== 'admin') return 'forbidden';
    const result = await this.repo.findAll(query);
    return { data: result.data.map((user) => this.toUser(user)), page: result.page };
  }

  async getUser(id: string, requestingUser: UserSummary): Promise<UserContract | null | 'forbidden'> {
    if (requestingUser.role !== 'admin' && requestingUser.id !== id) return 'forbidden';
    const user = await this.repo.findById(id);
    return user ? this.toUser(user) : null;
  }

  async updateUser(id: string, data: UpdateUserRequest, requestingUser: UserSummary): Promise<UserContract | null | 'conflict' | 'forbidden'> {
    if (requestingUser.role !== 'admin') return 'forbidden';
    const { expectedRevision, ...update } = data;
    const user = await this.repo.update(id, update, expectedRevision);
    return user && user !== 'conflict' ? this.toUser(user) : user;
  }

  async listOptions(search: string | undefined, limit: number | undefined, requestingUser: UserSummary): Promise<UserOption[] | 'forbidden'> {
    if (requestingUser.role !== 'admin') return 'forbidden';
    return this.repo.findOptions(search, limit);
  }

  private toUser(user: DbUser): UserContract {
    return { id: user.id, email: user.email, displayName: user.displayName, role: user.role, status: user.status, mustChangePassword: user.mustChangePassword, createdAt: user.createdAt.toISOString(), updatedAt: user.updatedAt.toISOString(), revision: user.revision };
  }
}
