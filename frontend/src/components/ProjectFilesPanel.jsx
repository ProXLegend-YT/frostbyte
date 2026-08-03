import React, { useEffect, useRef, useState } from "react";
import { FolderUp, File, X, Loader2, FileArchive, AlertTriangle, ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { api } from "../lib/api.js";

const LANGUAGE_DOT_COLORS = {
  javascript: "bg-yellow-400", typescript: "bg-blue-400", python: "bg-green-400",
  go: "bg-cyan-400", rust: "bg-orange-500", java: "bg-red-400",
  html: "bg-orange-400", css: "bg-sky-400", json: "bg-ink-400",
  markdown: "bg-ink-300", ruby: "bg-red-500", php: "bg-indigo-400"
};

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/**
 * Lets someone attach a small project's worth of source files (a zip, or a
 * dragged folder / multi-select) to a conversation. Attached files that are
 * "included" get sent as context on every message in this conversation, so
 * the model can reference and edit real files instead of guessing at
 * structure it's never seen.
 */
export default function ProjectFilesPanel({ conversationId, onFilesChanged }) {
  const [files, setFiles] = useState([]);
  const [expanded, setExpanded] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [notice, setNotice] = useState(null); // { type: 'error'|'info', text }
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);

  const load = async () => {
    if (!conversationId) return setFiles([]);
    const data = await api.getProjectFiles(conversationId);
    setFiles(data.files);
  };

  useEffect(() => {
    load();
  }, [conversationId]);

  // React doesn't reliably pass the non-standard `webkitdirectory` attribute
  // through JSX props in all versions/environments, so it's set directly on
  // the DOM node instead — this is the same approach browsers themselves
  // expect for this attribute.
  useEffect(() => {
    if (folderInputRef.current) {
      folderInputRef.current.setAttribute("webkitdirectory", "");
      folderInputRef.current.setAttribute("directory", "");
    }
  }, []);

  const handleUpload = async (fileList) => {
    if (!conversationId || !fileList || fileList.length === 0) return;
    setUploading(true);
    setNotice(null);
    try {
      const result = await api.uploadProjectFiles(conversationId, fileList);
      await load();
      onFilesChanged?.();
      if (result.skipped?.length > 0) {
        setNotice({
          type: "info",
          text: `Added ${result.added} file${result.added !== 1 ? "s" : ""}. Skipped ${result.skipped.length}: ${result.skipped
            .slice(0, 3)
            .map((s) => s.path)
            .join(", ")}${result.skipped.length > 3 ? "…" : ""}`
        });
      }
    } catch (err) {
      setNotice({ type: "error", text: err.message });
    } finally {
      setUploading(false);
    }
  };

  const toggleFile = async (fileId, included) => {
    setFiles((prev) => prev.map((f) => (f.id === fileId ? { ...f, included } : f)));
    await api.toggleProjectFile(conversationId, fileId, included);
    onFilesChanged?.();
  };

  const removeFile = async (fileId) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
    await api.deleteProjectFile(conversationId, fileId);
    onFilesChanged?.();
  };

  const clearAll = async () => {
    setFiles([]);
    await api.clearProjectFiles(conversationId);
    onFilesChanged?.();
  };

  if (!conversationId) return null;

  const includedCount = files.filter((f) => f.included).length;
  const totalSize = files.reduce((sum, f) => sum + f.sizeBytes, 0);

  return (
    <div className="border-b border-ink-800 shrink-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 md:px-6 py-2 text-xs text-ink-400 hover:text-ink-200 transition"
      >
        <span className="flex items-center gap-1.5">
          {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          <FolderUp size={13} />
          Project files
          {files.length > 0 && (
            <span className="text-ink-500">
              ({includedCount}/{files.length} included, {formatSize(totalSize)})
            </span>
          )}
        </span>
      </button>

      {expanded && (
        <div className="px-4 md:px-6 pb-3 space-y-2">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleUpload(e.dataTransfer.files);
            }}
            className={`flex items-center justify-center gap-4 rounded-lg border border-dashed px-4 py-3 text-xs transition ${
              dragOver ? "border-frost-500/60 bg-frost-500/5" : "border-ink-700 text-ink-500"
            }`}
          >
            {uploading ? (
              <span className="flex items-center gap-2 text-ink-400">
                <Loader2 size={14} className="animate-spin" /> Uploading…
              </span>
            ) : (
              <>
                <span>Drag a folder, files, or a .zip here</span>
                <span className="text-ink-700">or</span>
                <button onClick={() => fileInputRef.current?.click()} className="text-frost-400 hover:text-frost-300 flex items-center gap-1">
                  <File size={12} /> choose files
                </button>
                <button onClick={() => folderInputRef.current?.click()} className="text-frost-400 hover:text-frost-300 flex items-center gap-1">
                  <FolderUp size={12} /> choose folder
                </button>
              </>
            )}
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => handleUpload(e.target.files)} />
            <input
              ref={folderInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => handleUpload(e.target.files)}
            />
          </div>

          {notice && (
            <div
              className={`flex items-start gap-2 text-[11px] rounded-lg px-3 py-2 ${
                notice.type === "error" ? "text-signal-red bg-signal-red/10 border border-signal-red/25" : "text-ink-400 bg-ink-900 border border-ink-800"
              }`}
            >
              <AlertTriangle size={12} className="mt-0.5 shrink-0" />
              <span className="flex-1">{notice.text}</span>
              <button onClick={() => setNotice(null)} className="shrink-0">
                <X size={11} />
              </button>
            </div>
          )}

          {files.length > 0 && (
            <div className="space-y-0.5 max-h-52 overflow-y-auto">
              {files.map((f) => (
                <div key={f.id} className="group flex items-center gap-2 px-2 py-1 rounded-md hover:bg-ink-900 text-xs">
                  <input
                    type="checkbox"
                    checked={f.included}
                    onChange={(e) => toggleFile(f.id, e.target.checked)}
                    className="accent-frost-500 shrink-0"
                    title={f.included ? "Included in context" : "Excluded from context"}
                  />
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${LANGUAGE_DOT_COLORS[f.language] || "bg-ink-600"}`} />
                  <span className={`font-mono truncate flex-1 ${f.included ? "text-ink-300" : "text-ink-600 line-through"}`}>{f.path}</span>
                  <span className="text-ink-600 shrink-0">{formatSize(f.sizeBytes)}</span>
                  <button
                    onClick={() => removeFile(f.id)}
                    className="opacity-0 group-hover:opacity-100 text-ink-600 hover:text-signal-red shrink-0 transition"
                    aria-label="Remove file"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              <button onClick={clearAll} className="flex items-center gap-1 text-[11px] text-ink-600 hover:text-signal-red mt-1 px-2">
                <Trash2 size={11} /> Remove all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
