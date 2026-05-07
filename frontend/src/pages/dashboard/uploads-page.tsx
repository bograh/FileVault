import { useMemo, useRef, useState } from "react";
import {
  CloudUpload,
  Copy,
  Eye,
  Loader2,
  MoreHorizontal,
  Search,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/empty-state";
import { FileTypeIcon } from "@/components/file-icon";
import { UploadStatusBadge } from "@/components/status-pill";
import { PageHeader } from "@/components/page-header";
import { useProject } from "@/features/projects/hooks";
import {
  useCreateUpload,
  useDeleteUpload,
  useDeleteUploads,
  useUploads,
} from "@/features/uploads/hooks";
import { uploadsApi } from "@/services";
import { formatBytes, formatDateTime, truncateMiddle } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { UploadStatus } from "@/types/api";

export function UploadsPage({ projectId }: { projectId: string }) {
  const { data: project } = useProject(projectId);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<UploadStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const params = useMemo(
    () => ({
      project_id: projectId,
      search: search || undefined,
      status: status === "all" ? undefined : status,
      page,
      page_size: 20,
    }),
    [projectId, search, status, page],
  );
  const { data, isFetching, isLoading } = useUploads(params);

  const createUpload = useCreateUpload(projectId);
  const deleteUpload = useDeleteUpload(projectId);
  const deleteMany = useDeleteUploads(projectId);

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const allSelected =
    items.length > 0 && items.every((u) => selected.has(u.id));
  const someSelected = items.some((u) => selected.has(u.id));

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        items.forEach((u) => next.delete(u.id));
      } else {
        items.forEach((u) => next.add(u.id));
      }
      return next;
    });
  }
  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function onFiles(files: FileList | File[]) {
    const list = Array.from(files);
    if (list.length === 0) return;
    for (const f of list) {
      try {
        await createUpload.mutateAsync({
          filename: f.name,
          content_type: f.type || "application/octet-stream",
          size_bytes: f.size,
        });
      } catch (err) {
        toast.error(`Failed to upload ${f.name}`, {
          description: err instanceof Error ? err.message : undefined,
        });
      }
    }
    toast.success(`${list.length} upload${list.length === 1 ? "" : "s"} queued`, {
      description: "Mock backend will mark them completed shortly.",
    });
  }

  async function bulkDelete() {
    if (selected.size === 0) return;
    const ids = [...selected];
    setSelected(new Set());
    try {
      await deleteMany.mutateAsync(ids);
      toast.success(`Deleted ${ids.length} file${ids.length === 1 ? "" : "s"}`);
    } catch (err) {
      toast.error("Failed to delete", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  async function copySignedUrl(id: string) {
    const res = await uploadsApi.signedUrl(projectId, id);
    await navigator.clipboard.writeText(res.url);
    toast.success("Signed URL copied", {
      description: `Expires ${formatDateTime(res.expires_at)}`,
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={project?.name ?? "Project"}
        title="Files"
        description="Upload, search, preview, and delete files in this project."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              <UploadCloud className="h-4 w-4" />
              Upload files
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) onFiles(e.target.files);
                e.currentTarget.value = "";
              }}
            />
          </>
        }
      />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          if (e.dataTransfer.files) onFiles(e.dataTransfer.files);
        }}
        className={cn(
          "rounded-xl border border-dashed p-6 transition-colors",
          dragActive
            ? "border-primary bg-primary/5"
            : "border-border/70 bg-card/30",
        )}
      >
        <div className="flex flex-col items-center justify-center gap-2 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
            <CloudUpload className="h-5 w-5" />
          </div>
          <p className="text-sm">
            <span className="font-medium">Drag & drop</span> files here, or{" "}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-primary underline-offset-4 hover:underline"
            >
              browse
            </button>
          </p>
          <p className="text-xs text-muted-foreground">
            Files are stored at{" "}
            <code className="font-mono">
              {project?.bucket_prefix}/&lt;upload_id&gt;/&lt;filename&gt;
            </code>
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle>All files</CardTitle>
            <CardDescription>
              {total} object{total === 1 ? "" : "s"} in this project.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search files..."
                className="w-full pl-9 sm:w-64"
              />
            </div>
            <Select
              value={status}
              onValueChange={(v) => {
                setStatus(v as UploadStatus | "all");
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>

            {selected.size > 0 ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={bulkDelete}
                disabled={deleteMany.isPending}
              >
                {deleteMany.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Delete {selected.size}
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-5">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              icon={CloudUpload}
              title={
                search || status !== "all"
                  ? "No files match your filters"
                  : "No files yet"
              }
              description={
                search || status !== "all"
                  ? "Try adjusting your search or filter."
                  : "Drag and drop files above to start your first upload."
              }
              className="m-5"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10 pl-5">
                    <Checkbox
                      checked={allSelected}
                      indeterminate={!allSelected && someSelected}
                      onChange={toggleAll}
                    />
                  </TableHead>
                  <TableHead>File</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>ACL</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((u) => (
                  <TableRow
                    key={u.id}
                    data-state={selected.has(u.id) ? "selected" : undefined}
                  >
                    <TableCell className="pl-5">
                      <Checkbox
                        checked={selected.has(u.id)}
                        onChange={() => toggleOne(u.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <FileTypeIcon contentType={u.content_type} />
                        <div className="min-w-0">
                          <div className="truncate font-medium">
                            {u.filename}
                          </div>
                          <div className="truncate font-mono text-[11px] text-muted-foreground">
                            {truncateMiddle(u.storage_key, 24, 16)}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {formatBytes(u.size_bytes)}
                    </TableCell>
                    <TableCell>
                      <UploadStatusBadge status={u.status} />
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {u.acl}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDateTime(u.created_at)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onSelect={() => copySignedUrl(u.id)}
                          >
                            <Copy className="h-4 w-4" />
                            Copy signed URL
                          </DropdownMenuItem>
                          <DropdownMenuItem disabled>
                            <Eye className="h-4 w-4" />
                            View details
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:bg-destructive/15 focus:text-destructive"
                            onSelect={async () => {
                              try {
                                await deleteUpload.mutateAsync(u.id);
                                toast.success("File deleted");
                              } catch (err) {
                                toast.error("Delete failed", {
                                  description:
                                    err instanceof Error
                                      ? err.message
                                      : undefined,
                                });
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
        {data && data.total > params.page_size! ? (
          <div className="flex items-center justify-between border-t border-border/60 px-5 py-3 text-sm">
            <span className="text-muted-foreground">
              Page {data.page} of{" "}
              {Math.ceil(data.total / data.page_size)} ·{" "}
              {isFetching ? "Refreshing…" : `${data.total} files`}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={data.page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!data.has_more}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
