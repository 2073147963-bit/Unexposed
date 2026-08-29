"use client";

// 桌面右上角的数据管理菜单：推理通道徽章 + 导出 / 导入 / 清空。
// 导出为单一 JSON 备份（照片内嵌 base64）；导入按 ID 合并；清空需两次确认。
import { useEffect, useRef, useState } from "react";

import { fetchAiStatus, type AiStatus } from "@/lib/ai/consent";
import { downloadBackup, restoreFromBackup, wipeAllData } from "@/lib/db/backup";

export function DataMenu() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<AiStatus | null>(null);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void fetchAiStatus().then(setStatus).catch(() => {});
  }, []);

  useEffect(() => {
    function onOutside(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  async function onExport() {
    setBusy("export");
    try {
      await downloadBackup();
      setNotice("备份已导出。");
    } catch (err) {
      setNotice(err instanceof Error ? `导出失败：${err.message}` : "导出失败。");
    } finally {
      setBusy("");
    }
  }

  async function onImportFile(file: File) {
    setBusy("import");
    try {
      const result = await restoreFromBackup(file);
      window.alert(
        `已恢复：胶卷 ${result.rolls} 卷、封存版本 ${result.versions} 份、反思 ${result.reflections} 条、对话 ${result.conversations} 条。`,
      );
      window.location.reload();
    } catch (err) {
      setNotice(err instanceof Error ? `导入失败：${err.message}` : "导入失败。");
      setBusy("");
    }
  }

  async function onWipe() {
    if (!window.confirm("将删除本浏览器的全部胶卷、照片与对话，且不可恢复。确定继续？")) return;
    if (!window.confirm("再次确认：真的要清空全部本地数据吗？")) return;
    setBusy("wipe");
    try {
      await wipeAllData();
      window.location.reload();
    } catch (err) {
      setNotice(err instanceof Error ? `清空失败：${err.message}` : "清空失败。");
      setBusy("");
    }
  }

  const badge = status ? (status.cloud ? `AI · 云端 ${status.model}` : "AI · 本地 Ollama") : "AI · 检测中";

  return (
    <div className="data-menu" ref={rootRef}>
      <span className={`ai-badge ${status?.cloud ? "ai-badge-cloud" : "ai-badge-local"}`}>{badge}</span>
      <button type="button" className="data-menu-toggle" onClick={() => setOpen((v) => !v)}>
        数据
      </button>
      {open && (
        <div className="data-menu-panel">
          <button type="button" disabled={busy !== ""} onClick={() => void onExport()}>
            {busy === "export" ? "导出中…" : "导出备份"}
          </button>
          <button type="button" disabled={busy !== ""} onClick={() => fileRef.current?.click()}>
            {busy === "import" ? "导入中…" : "导入备份"}
          </button>
          <button type="button" className="data-menu-danger" disabled={busy !== ""} onClick={() => void onWipe()}>
            {busy === "wipe" ? "清空中…" : "清空全部数据"}
          </button>
          {notice && <p className="data-menu-notice">{notice}</p>}
        </div>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void onImportFile(file);
        }}
      />
    </div>
  );
}
