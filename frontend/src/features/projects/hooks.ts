import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import {
  dashboardApi,
  projectsApi,
  type DashboardOverview,
} from "@/services";
import type {
  Project,
  ProjectStatPoint,
  ProjectUsage,
  StorageBackend,
  StorageRegion,
} from "@/types/api";

export const projectsKeys = {
  all: ["projects"] as const,
  lists: () => ["projects", "list"] as const,
  detail: (id: string) => ["projects", id] as const,
  usage: (id: string) => ["projects", id, "usage"] as const,
  stats: (id: string) => ["projects", id, "stats"] as const,
};

export function useProjects(
  options?: Omit<UseQueryOptions<Project[]>, "queryKey" | "queryFn">,
) {
  return useQuery<Project[]>({
    queryKey: projectsKeys.lists(),
    queryFn: () => projectsApi.list(),
    ...options,
  });
}

export function useProject(projectId: string | undefined) {
  return useQuery<Project>({
    queryKey: projectId ? projectsKeys.detail(projectId) : ["project", "none"],
    queryFn: () => projectsApi.get(projectId as string),
    enabled: !!projectId,
  });
}

export function useProjectUsage(projectId: string | undefined) {
  return useQuery<ProjectUsage>({
    queryKey: projectId ? projectsKeys.usage(projectId) : ["usage", "none"],
    queryFn: () => projectsApi.usage(projectId as string),
    enabled: !!projectId,
  });
}

export function useProjectStats(projectId: string | undefined) {
  return useQuery<ProjectStatPoint[]>({
    queryKey: projectId ? projectsKeys.stats(projectId) : ["stats", "none"],
    queryFn: () => projectsApi.stats(projectId as string),
    enabled: !!projectId,
  });
}

export function useDashboardOverview() {
  return useQuery<DashboardOverview>({
    queryKey: ["dashboard", "overview"],
    queryFn: () => dashboardApi.overview(),
  });
}

export interface CreateProjectInput {
  name: string;
  slug: string;
  description?: string;
  storage_region: StorageRegion;
  storage_backend: StorageBackend;
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProjectInput) => projectsApi.create(input),
    onSuccess: (project) => {
      qc.invalidateQueries({ queryKey: projectsKeys.lists() });
      qc.setQueryData(projectsKeys.detail(project.id), project);
    },
  });
}

export function useUpdateProject(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Partial<Project>) =>
      projectsApi.update(projectId, patch),
    onSuccess: (project) => {
      qc.setQueryData(projectsKeys.detail(projectId), project);
      qc.invalidateQueries({ queryKey: projectsKeys.lists() });
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (projectId: string) => projectsApi.remove(projectId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: projectsKeys.all });
    },
  });
}
