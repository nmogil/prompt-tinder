import { useEffect, useRef, useState } from "react";
import { useAction } from "convex/react";
import { Key } from "lucide-react";

import { api } from "../../convex/_generated/api";
import { useOrg } from "@/contexts/OrgContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { friendlyError } from "@/lib/errors";

interface InlineBYOKModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Fired immediately after the key save resolves so the caller can re-fire
   * the run with its captured args — no second click required.
   */
  onSaved: () => void;
}

/**
 * M29.5: Lightweight key-entry modal that intercepts a Run click when the
 * org has no OpenRouter key on file. On save we call back with `onSaved` so
 * the run executes with the same args, eliminating the "save key, then click
 * Run again" two-step that the M28.6 ByokGateModal forced.
 *
 * Non-owners can't add a key to a workspace they don't own; they get an
 * ask-your-admin message instead.
 */
export function InlineBYOKModal({
  open,
  onOpenChange,
  onSaved,
}: InlineBYOKModalProps) {
  const { orgId, role } = useOrg();
  const setKey = useAction(api.openRouterKeys.setKey);
  const isOwner = role === "owner";

  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setValue("");
      setError("");
      setSaving(false);
    } else {
      // Defer focus until after the dialog opens its first frame.
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim() || saving) return;
    setSaving(true);
    setError("");
    try {
      await setKey({ orgId, key: value.trim() });
      onOpenChange(false);
      onSaved();
    } catch (err) {
      setError(friendlyError(err, "Couldn't save the key. Try again."));
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton>
        <DialogHeader>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
            <Key className="h-4 w-4 text-primary" />
          </div>
          <DialogTitle>Add your OpenRouter key to run</DialogTitle>
          <DialogDescription>
            Encrypted at rest. Never sent to the client. We use it only to
            execute your runs against the model you pick.
          </DialogDescription>
        </DialogHeader>

        {isOwner ? (
          <form onSubmit={handleSubmit} className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="inline-byok-key">API key</Label>
              <Input
                id="inline-byok-key"
                ref={inputRef}
                type="password"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="sk-or-..."
                autoComplete="off"
                disabled={saving}
              />
              <p className="text-[11px] text-muted-foreground">
                Get one from{" "}
                <a
                  href="https://openrouter.ai/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  openrouter.ai/keys
                </a>
                .
              </p>
            </div>

            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !value.trim()}>
                {saving ? "Saving…" : "Save and run"}
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-3 pt-2">
            <p className="text-sm text-muted-foreground">
              Only the workspace owner can add an OpenRouter key. Ask them to
              save one before retrying this run.
            </p>
            <div className="flex justify-end">
              <Button onClick={() => onOpenChange(false)}>Close</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
