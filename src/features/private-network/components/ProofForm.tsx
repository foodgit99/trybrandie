import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { rpc, pnError } from "../api";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

/** Private proof upload: files go to the caller's own folder in a private bucket. */
export default function ProofForm({ placementId, onDone }: { placementId: string; onDone?: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!user) return;
    if (!file && !url.trim()) { toast.error("Add a screenshot or a link to your post."); return; }
    if (file && file.size > 10 * 1024 * 1024) { toast.error("Screenshot must be under 10 MB."); return; }
    setBusy(true);
    try {
      let path: string | null = null;
      if (file) {
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5);
        path = `${user.id}/${placementId}/${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from("private-network-proofs").upload(path, file, { contentType: file.type, upsert: false });
        if (error) throw error;
      }
      await rpc("submit_proof", { _placement: placementId, _path: path, _url: url.trim() || null, _note: note.trim() || null });
      toast.success("Proof sent for review");
      qc.invalidateQueries({ queryKey: ["pn"] });
      onDone?.();
    } catch (e) {
      toast.error(pnError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor={`proof-file-${placementId}`}>Screenshot of your post</Label>
        <Input id={`proof-file-${placementId}`} type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <p className="text-xs text-muted-foreground">Private — only Brandie reviewers can see it.</p>
      </div>
      <div className="space-y-1">
        <Label htmlFor={`proof-url-${placementId}`}>Or a link to the post (optional)</Label>
        <Input id={`proof-url-${placementId}`} type="url" placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`proof-note-${placementId}`}>Note (optional)</Label>
        <Textarea id={`proof-note-${placementId}`} rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <Button onClick={submit} disabled={busy} className="w-full">{busy ? "Sending…" : "Submit proof"}</Button>
    </div>
  );
}
