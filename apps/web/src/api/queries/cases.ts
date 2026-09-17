import { useQuery } from '@tanstack/vue-query';
import { computed, toValue, type MaybeRefOrGetter } from 'vue';

export type CaseItem = {
  id: string;
  name: string;
  customerId: string;
  customerName: string;
  status: 'archived';
  archivedFromStatus: string | null;
  exhibitionName: string | null;
  exhibitionVenue: string | null;
  industry: string | null;
  selectedVersionId: string | null;
  approvedAt: string | null;
  archivedAt: string;
  createdAt: string;
  tags: Array<{ id: string; name: string; color: string | null }>;
  favorited: boolean;
};

export type CasesQueryParams = {
  search?: string;
  customerId?: string;
  tagId?: string;
  favorited?: boolean;
  cursor?: string;
  limit?: number;
};

export const caseKeys = {
  all: () => ['cases'] as const,
  lists: () => [...caseKeys.all(), 'list'] as const,
  list: (params: Record<string, unknown>) =>
    [...caseKeys.lists(), params] as const,
};

export function useCasesQuery(
  params?: MaybeRefOrGetter<CasesQueryParams | undefined>,
) {
  const resolvedParams = computed(() => toValue(params));
  return useQuery({
    queryKey: computed(() => caseKeys.list(resolvedParams.value || {})),
    queryFn: async () => {
      const p = resolvedParams.value;
      const searchParams = new URLSearchParams();
      if (p?.search) searchParams.set('search', p.search);
      if (p?.customerId) searchParams.set('customerId', p.customerId);
      if (p?.tagId) searchParams.set('tagId', p.tagId);
      if (p?.favorited !== undefined)
        searchParams.set('favorited', String(p.favorited));
      if (p?.cursor) searchParams.set('cursor', p.cursor);
      if (p?.limit) searchParams.set('limit', String(p.limit));

      const url = `/api/v1/cases${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch cases');
      return res.json() as Promise<{
        data: CaseItem[];
        page: { nextCursor: string | null; hasMore: boolean };
      }>;
    },
  });
}
