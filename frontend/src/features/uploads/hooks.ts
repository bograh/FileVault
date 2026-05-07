import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { uploadsApi } from "@/services";
import type { Page, Upload, UploadListParams } from "@/types/api";

export const uploadsKeys = {
  list: (params: UploadListParams) =>
    ["uploads", params.project_id, params] as const,
  detail: (projectId: string, uploadId: string) =>
    ["uploads", projectId, uploadId] as const,
};

export function useUploads(params: UploadListParams) {
  return useQuery<Page<Upload>>({
    queryKey: uploadsKeys.list(params),
    queryFn: () => uploadsApi.list(params),
    placeholderData: (prev) => prev,
  });
}

export function useDeleteUpload(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (uploadId: string) => uploadsApi.remove(projectId, uploadId),
    onMutate: async (uploadId: string) => {
      await qc.cancelQueries({ queryKey: ["uploads", projectId] });
      const snapshots = qc.getQueriesData<Page<Upload>>({
        queryKey: ["uploads", projectId],
      });
      for (const [key, data] of snapshots) {
        if (!data) continue;
        qc.setQueryData<Page<Upload>>(key, {
          ...data,
          items: data.items.filter((u) => u.id !== uploadId),
          total: Math.max(0, data.total - 1),
        });
      }
      return { snapshots };
    },
    onError: (_err, _id, ctx) => {
      ctx?.snapshots?.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["uploads", projectId] });
    },
  });
}

export function useDeleteUploads(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (uploadIds: string[]) =>
      uploadsApi.removeMany(projectId, uploadIds),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["uploads", projectId] });
    },
  });
}

export function useCreateUpload(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: {
      filename: string;
      content_type: string;
      size_bytes: number;
      folder?: string;
    }) =>
      uploadsApi.create({
        project_id: projectId,
        ...params,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["uploads", projectId] });
      // Re-fetch in 1.6s to see status flip to completed.
      setTimeout(
        () => qc.invalidateQueries({ queryKey: ["uploads", projectId] }),
        1600,
      );
    },
  });
}
