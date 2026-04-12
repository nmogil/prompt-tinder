import { Button } from "@/components/ui/button";
import { FileIcon, ImageIcon, Trash2 } from "lucide-react";

interface AttachmentCardProps {
  filename: string;
  mimeType: string;
  sizeBytes: number;
  url: string | null;
  onDelete?: () => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentCard({
  filename,
  mimeType,
  sizeBytes,
  url,
  onDelete,
}: AttachmentCardProps) {
  const isImage = mimeType.startsWith("image/");

  return (
    <div className="flex items-center gap-2 rounded-md border p-2 text-xs">
      {/* Thumbnail or icon */}
      <div className="h-10 w-10 shrink-0 rounded bg-muted flex items-center justify-center overflow-hidden">
        {isImage && url ? (
          <img
            src={url}
            alt={filename}
            className="h-full w-full object-cover"
          />
        ) : isImage ? (
          <ImageIcon className="h-4 w-4 text-muted-foreground" />
        ) : (
          <FileIcon className="h-4 w-4 text-muted-foreground" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{filename}</p>
        <p className="text-muted-foreground">{formatSize(sizeBytes)}</p>
      </div>

      {/* Delete */}
      {onDelete && (
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={onDelete}
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
