import { queryOptions, useMutation, useQueryClient } from '@tanstack/vue-query';

export type PromptStatus = 'draft' | 'published' | 'archived';

export type PromptVersion = {
  id: string;
  templateId: string;
  version: number;
  status: PromptStatus;
  content: string;
  variables: string[];
  changeNote: string | null;
  publishedAt: string | null;
  publishedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PromptTemplateWithVersion = {
  id: string;
  name: string;
  description: string | null;
  templateKey: string;
  currentVersionId: string | null;
  currentVersion: PromptVersion | null;
  createdAt: string;
  updatedAt: string;
};

export const promptKeys = {
  all: ['prompts'] as const,
  templates: () => [...promptKeys.all, 'templates'] as const,
  template: (id: string) => [...promptKeys.all, 'template', id] as const,
};

// ģ
export function listPromptTemplatesOptions() {
  return queryOptions({
    queryKey: promptKeys.templates(),
    queryFn: async () => {
      const res = await fetch('/api/v1/settings/prompt-templates', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      return data as { templates: PromptTemplateWithVersion[] };
    },
  });
}

// ȡģ壬汾ʷ
export function getPromptTemplateOptions(id: string) {
  return {
    queryKey: promptKeys.template(id),
    queryFn: async () => {
      const res = await fetch(`/api/v1/settings/prompt-templates/${id}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      return data as {
        template: PromptTemplateWithVersion;
        versions: PromptVersion[];
      };
    },
  };
}

// ģ
export function useCreatePromptTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      name: string;
      templateKey: string;
      description?: string;
      initialContent: string;
      variables?: string[];
      changeNote?: string;
    }) => {
      const res = await fetch('/api/v1/settings/prompt-templates', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: promptKeys.templates() });
    },
  });
}

// ݸ汾
export function useCreatePromptVersion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      body,
    }: {
      id: string;
      body: { content: string; variables?: string[]; changeNote?: string };
    }) => {
      const res = await fetch(
        `/api/v1/settings/prompt-templates/${id}/versions`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: promptKeys.template(variables.id),
      });
    },
  });
}

// ¸
export function useUpdatePromptVersion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      versionId,
      body,
    }: {
      id: string;
      versionId: string;
      body: { content?: string; variables?: string[]; changeNote?: string };
    }) => {
      const res = await fetch(
        `/api/v1/settings/prompt-templates/${id}/versions/${versionId}`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: promptKeys.template(variables.id),
      });
    },
  });
}

// 汾
export function usePublishPromptVersion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      versionId,
      body,
    }: {
      id: string;
      versionId: string;
      body: { changeNote?: string };
    }) => {
      const res = await fetch(
        `/api/v1/settings/prompt-templates/${id}/versions/${versionId}/publish`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: promptKeys.templates() });
      queryClient.invalidateQueries({
        queryKey: promptKeys.template(variables.id),
      });
    },
  });
}

// ع汾
export function useRollbackPromptVersion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      versionId,
    }: {
      id: string;
      versionId: string;
    }) => {
      const res = await fetch(
        `/api/v1/settings/prompt-templates/${id}/versions/${versionId}/rollback`,
        {
          method: 'POST',
          credentials: 'include',
        },
      );
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: promptKeys.templates() });
      queryClient.invalidateQueries({
        queryKey: promptKeys.template(variables.id),
      });
    },
  });
}
