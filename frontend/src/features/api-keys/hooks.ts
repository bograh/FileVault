import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiKeysApi } from "@/services";
import type { ApiKey, ApiKeyEnvironment, ApiKeyScope } from "@/types/api";

export const apiKeysKeys = {
  list: (projectId: string) => ["api-keys", projectId] as const,
};

export function useApiKeys(projectId: string) {
  return useQuery<ApiKey[]>({
    queryKey: apiKeysKeys.list(projectId),
    queryFn: () => apiKeysApi.list(projectId),
  });
}

export interface CreateApiKeyInput {
  name: string;
  scopes: ApiKeyScope[];
  environment: ApiKeyEnvironment;
}

export function useCreateApiKey(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateApiKeyInput) =>
      apiKeysApi.create({ project_id: projectId, ...input }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: apiKeysKeys.list(projectId) }),
  });
}

export function useRevokeApiKey(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (keyId: string) => apiKeysApi.revoke(projectId, keyId),
    onMutate: async (keyId: string) => {
      await qc.cancelQueries({ queryKey: apiKeysKeys.list(projectId) });
      const prev = qc.getQueryData<ApiKey[]>(apiKeysKeys.list(projectId));
      if (prev) {
        qc.setQueryData<ApiKey[]>(
          apiKeysKeys.list(projectId),
          prev.map((k) =>
            k.id === keyId ? { ...k, revoked_at: new Date().toISOString() } : k,
          ),
        );
      }
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(apiKeysKeys.list(projectId), ctx.prev);
    },
    onSettled: () =>
      qc.invalidateQueries({ queryKey: apiKeysKeys.list(projectId) }),
  });
}
