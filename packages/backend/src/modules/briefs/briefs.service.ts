import type { BriefContent, BriefRevision } from '@exhibition/contracts';
import { BriefRepository } from './briefs.repository.js';

type RequestingUser = { id: string; role: string };

function toRevision(row: {
  id: string;
  projectId: string;
  number: number;
  content: unknown;
  createdBy: string;
  createdAt: Date;
  confirmedBy: string | null;
  confirmedAt: Date | null;
}): BriefRevision {
  return {
    id: row.id,
    projectId: row.projectId,
    number: row.number,
    content: row.content as BriefContent,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    confirmedBy: row.confirmedBy ?? null,
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
  };
}

export class BriefService {
  constructor(private repo: BriefRepository) {}

  async getBrief(
    projectId: string,
    isMemberOrAdmin: boolean,
  ): Promise<BriefRevision | null | 'forbidden'> {
    if (!isMemberOrAdmin) return 'forbidden';

    const revision = await this.repo.findCurrentByProjectId(projectId);
    return revision ? toRevision(revision) : null;
  }

  async updateBrief(
    projectId: string,
    content: BriefContent,
    expectedRevision: number,
    requestingUser: RequestingUser,
    isMemberOrAdmin: boolean,
  ): Promise<BriefRevision | 'forbidden' | 'conflict' | 'not_found'> {
    if (requestingUser.role === 'viewer') return 'forbidden';
    if (!isMemberOrAdmin) return 'forbidden';

    const result = await this.repo.createRevision({
      projectId,
      content,
      createdBy: requestingUser.id,
      expectedRevision,
    });

    if (result === 'conflict' || result === 'not_found') return result;
    return toRevision(result);
  }

  async listRevisions(
    projectId: string,
    opts: { cursor?: string; limit?: number },
    isMemberOrAdmin: boolean,
  ): Promise<
    | {
        data: BriefRevision[];
        page: { nextCursor: string | null; hasMore: boolean };
      }
    | 'forbidden'
  > {
    if (!isMemberOrAdmin) return 'forbidden';

    const result = await this.repo.listByProjectId(projectId, opts);
    return {
      data: result.data.map(toRevision),
      page: result.page,
    };
  }

  async getRevision(
    projectId: string,
    revisionId: string,
    isMemberOrAdmin: boolean,
  ): Promise<BriefRevision | null | 'forbidden'> {
    if (!isMemberOrAdmin) return 'forbidden';

    const revision = await this.repo.findByProjectId(revisionId, projectId);
    return revision ? toRevision(revision) : null;
  }

  async confirmBrief(
    projectId: string,
    revisionId: string,
    expectedRevision: number,
    requestingUser: RequestingUser,
    isMemberOrAdmin: boolean,
  ): Promise<
    BriefRevision | 'forbidden' | 'conflict' | 'not_found' | 'wrong_revision'
  > {
    if (requestingUser.role === 'viewer') return 'forbidden';
    if (!isMemberOrAdmin) return 'forbidden';

    const result = await this.repo.confirmRevision({
      projectId,
      revisionId,
      confirmedBy: requestingUser.id,
      expectedRevision,
    });

    if (typeof result === 'string') return result;
    return toRevision(result);
  }
}
