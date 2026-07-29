"use client";

import { useEffect, useState } from "react";
import { ChevronRight, FileQuestion, Link2, Sparkles } from "lucide-react";
import type { Entry } from "./lib/types";
import {
  parseReferenceLink,
  REFERENCE_LINK_KIND,
  safeReferenceUrl,
} from "./lib/reference-links";

const labels: Record<string, string> = {
  impression: "一句话总体印象",
  pros: "做得好的地方",
  cons: "可以改进的地方",
  highlights: "核心亮点",
  lessons: "值得借鉴的设计",
  improvements: "如果由我来设计",
  summary: "自由总结",
};

export function SharedEntry({ token }: { token: string }) {
  const [entry, setEntry] = useState<Entry | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch(`/api/public/share/${encodeURIComponent(token)}`)
      .then(async (response) => {
        const data = (await response.json()) as { entry?: Entry; error?: string };
        if (!response.ok || !data.entry) throw new Error(data.error ?? "无法读取分享");
        setEntry(data.entry);
      })
      .catch((reason: Error) => setError(reason.message));
  }, [token]);

  if (error) {
    return (
      <main className="share-shell">
        <section className="share-error">
          <span><FileQuestion size={38} /></span>
          <h1>这份分享已经不可用</h1>
          <p>{error}</p>
        </section>
      </main>
    );
  }
  if (!entry) {
    return <main className="share-shell"><p className="share-loading">正在打开设计记录…</p></main>;
  }

  return (
    <main className="share-shell">
      <header className="share-brand"><span className="brand-mark"><Sparkles size={15} /></span><strong>Gamefolio</strong><small>只读分享</small></header>
      <article className="shared-article">
        <p className="entry-kicker">{entry.type === "idea" ? "设计灵感" : "游戏复盘"}</p>
        <h1>{entry.title}</h1>
        <div className="share-meta">
          {entry.game && <span>{entry.game.name}</span>}
          {entry.designTheme && <span>{entry.designTheme}</span>}
          {entry.tags.map((tag) => <span key={tag}>#{tag}</span>)}
        </div>
        {entry.body && <p className="shared-lead">{entry.body}</p>}
        {entry.type === "review" &&
          entry.sections.filter(
            (section) => section.kind !== REFERENCE_LINK_KIND && section.content,
          ).map((section) => (
            <section className="shared-section" key={section.kind}>
              <h2>{labels[section.kind] ?? section.kind}</h2>
              <p>{section.content}</p>
            </section>
          ))}
        {entry.sections.some((section) => {
          if (section.kind !== REFERENCE_LINK_KIND) return false;
          return Boolean(safeReferenceUrl(parseReferenceLink(section).url));
        }) && (
          <section className="shared-reference-links">
            <h2>参考链接</h2>
            <div className="reference-link-list">
              {entry.sections
                .filter((section) => section.kind === REFERENCE_LINK_KIND)
                .map((section, index) => {
                  const link = parseReferenceLink(section);
                  const href = safeReferenceUrl(link.url);
                  if (!href) return null;
                  return (
                    <a
                      className="reference-link-card"
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      key={section.id ?? `${section.kind}-${index}`}
                    >
                      <span className="reference-link-icon"><Link2 size={17} /></span>
                      <span>
                        <strong>{link.title || new URL(href).hostname}</strong>
                        <small>{link.url}</small>
                      </span>
                      <ChevronRight size={17} />
                    </a>
                  );
                })}
            </div>
          </section>
        )}
        {entry.images.length > 0 && (
          <section className="shared-images">
            {entry.images.map((image) => (
              <figure key={image.id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.url} alt={image.caption || image.fileName} />
                {image.caption && <figcaption>{image.caption}</figcaption>}
              </figure>
            ))}
          </section>
        )}
      </article>
      <footer className="share-footer">由 Gamefolio 分享 · 内容归创作者所有</footer>
    </main>
  );
}
