import {
  Archive,
  File as FileIcon,
  FileAudio,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Presentation,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICON_MAP = [
  { test: /^image\//, Icon: FileImage, tone: "text-cyan-300" },
  { test: /^video\//, Icon: FileVideo, tone: "text-rose-300" },
  { test: /^audio\//, Icon: FileAudio, tone: "text-violet-300" },
  { test: /pdf/, Icon: FileText, tone: "text-red-300" },
  { test: /(zip|rar|tar|gzip|7z|compressed)/, Icon: Archive, tone: "text-amber-300" },
  { test: /(csv|sheet|excel)/, Icon: FileSpreadsheet, tone: "text-emerald-300" },
  { test: /(presentation|powerpoint)/, Icon: Presentation, tone: "text-orange-300" },
  { test: /(json|xml|html|javascript|typescript|css)/, Icon: FileCode, tone: "text-sky-300" },
  { test: /text\//, Icon: FileText, tone: "text-slate-300" },
];

export function FileTypeIcon({
  contentType,
  className,
}: {
  contentType: string;
  className?: string;
}) {
  const match = ICON_MAP.find((m) => m.test.test(contentType));
  const Icon = match?.Icon ?? FileIcon;
  const tone = match?.tone ?? "text-muted-foreground";
  return <Icon className={cn("h-4 w-4 shrink-0", tone, className)} />;
}
