"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud } from "lucide-react";
import { api } from "@/lib/api";

export default function UploadDropzone() {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agentName, setAgentName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of Array.from(files)) {
        await api.uploadCall(file, agentName.trim() || undefined);
      }
      router.refresh();
    } catch (e: any) {
      setError(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }, [router, agentName]);

  return (
    <div className="space-y-3">
      <input
        type="text"
        value={agentName}
        onChange={(e) => setAgentName(e.target.value)}
        placeholder="Agent name (optional)"
        className="w-full sm:w-72 px-3 py-2 text-[13px] bg-panel border border-hairline rounded-md text-ink placeholder-faint focus:outline-none focus:ring-1 focus:ring-accent focus:border-accent"
      />
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`border border-dashed rounded-lg px-6 py-8 text-center cursor-pointer transition-colors ${
          dragging ? "border-accent bg-accent/5" : "border-hairline hover:border-faint"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".wav,.mp3,.flac,.m4a"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <UploadCloud className="w-6 h-6 mx-auto mb-2 text-faint" strokeWidth={1.5} />
        <div className="text-sm text-ink font-medium">
          {uploading ? "Uploading to storage…" : "Drop recordings here, or click to browse"}
        </div>
        <div className="text-[12px] text-faint mt-1">WAV · MP3 · FLAC · M4A — stored in MinIO, queued for analysis automatically</div>
        {error && <div className="text-[12px] text-bad mt-2">{error}</div>}
      </div>
    </div>
  );
}
