import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { webhooksApi } from "@/services";
import type {
  WebhookDelivery,
  WebhookEndpoint,
  WebhookEvent,
} from "@/types/api";

export const webhooksKeys = {
  list: (projectId: string) => ["webhooks", projectId] as const,
  deliveries: (projectId: string, endpointId: string) =>
    ["webhooks", projectId, endpointId, "deliveries"] as const,
};

export function useWebhooks(projectId: string) {
  return useQuery<WebhookEndpoint[]>({
    queryKey: webhooksKeys.list(projectId),
    queryFn: () => webhooksApi.list(projectId),
  });
}

export function useWebhookDeliveries(
  projectId: string,
  endpointId: string | null,
) {
  return useQuery<WebhookDelivery[]>({
    queryKey: endpointId
      ? webhooksKeys.deliveries(projectId, endpointId)
      : ["webhooks", projectId, "no-endpoint"],
    queryFn: () => webhooksApi.deliveries(projectId, endpointId as string),
    enabled: !!endpointId,
  });
}

export function useCreateWebhook(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { url: string; events: WebhookEvent[] }) =>
      webhooksApi.create({ project_id: projectId, ...input }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: webhooksKeys.list(projectId) }),
  });
}

export function useDeleteWebhook(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (endpointId: string) =>
      webhooksApi.remove(projectId, endpointId),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: webhooksKeys.list(projectId) }),
  });
}

export function useToggleWebhook(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { endpointId: string; enabled: boolean }) =>
      webhooksApi.update(projectId, input.endpointId, {
        enabled: input.enabled,
      }),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: webhooksKeys.list(projectId) });
      const prev = qc.getQueryData<WebhookEndpoint[]>(
        webhooksKeys.list(projectId),
      );
      if (prev) {
        qc.setQueryData<WebhookEndpoint[]>(
          webhooksKeys.list(projectId),
          prev.map((w) =>
            w.id === input.endpointId ? { ...w, enabled: input.enabled } : w,
          ),
        );
      }
      return { prev };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.prev) qc.setQueryData(webhooksKeys.list(projectId), ctx.prev);
    },
    onSettled: () =>
      qc.invalidateQueries({ queryKey: webhooksKeys.list(projectId) }),
  });
}

export function useTestWebhook(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (endpointId: string) =>
      webhooksApi.sendTest(projectId, endpointId),
    onSuccess: (_data, endpointId) =>
      qc.invalidateQueries({
        queryKey: webhooksKeys.deliveries(projectId, endpointId),
      }),
  });
}
