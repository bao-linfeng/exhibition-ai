import type { Case, ListCasesQuery } from '@exhibition/contracts';
import type { FavoriteRepository } from '../favorites/favorites.repository.js';
import type { CasesRepository } from './cases.repository.js';

export class CasesService {
  constructor(
    private repo: CasesRepository,
    private favoriteRepo: FavoriteRepository,
  ) {}

  async listCases(
    query: ListCasesQuery,
    requestingUser: { id: string; role: string },
  ): Promise<{
    data: Case[];
    page: { nextCursor: string | null; hasMore: boolean };
  }> {
    const result = await this.repo.listCases(requestingUser, query);
    if (result.data.length === 0) return { data: [], page: result.page };

    const projectIds = result.data.map((row) => row.id);
    const tagsMap = await this.repo.getTagsForProjects(projectIds);
    const versionIds = result.data
      .map((row) => row.selectedVersionId)
      .filter((id): id is string => id !== null);
    const favoritedSet = await this.favoriteRepo.isVersionFavoritedBatch(
      requestingUser.id,
      versionIds,
    );

    return {
      data: result.data.map((row) => ({
        id: row.id,
        name: row.name,
        customerId: row.customerId,
        customerName: row.customerName,
        status: 'archived' as const,
        archivedFromStatus:
          (row.archivedFromStatus as Case['archivedFromStatus']) ?? null,
        exhibitionName: row.exhibitionName ?? null,
        exhibitionVenue: row.exhibitionVenue ?? null,
        industry: row.industry ?? null,
        selectedVersionId: row.selectedVersionId ?? null,
        approvedAt: row.approvedAt?.toISOString() ?? null,
        archivedAt: row.updatedAt.toISOString(),
        createdAt: row.createdAt.toISOString(),
        tags: tagsMap.get(row.id) ?? [],
        favorited:
          row.selectedVersionId !== null
            ? favoritedSet.has(row.selectedVersionId)
            : false,
      })),
      page: result.page,
    };
  }
}
