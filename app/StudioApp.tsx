"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Entry, EntryImage, EntryInput, EntryType, Game, ReviewSection } from "./lib/types";
import { listOfflineDrafts, removeOfflineDraft, saveOfflineDraft } from "./lib/offline";

type View = "home" | "library" | "editor" | "game" | "settings";
type SyncState = "saved" | "saving" | "offline" | "conflict" | "error";

const reviewTemplate: ReviewSection[] = [
  { kind: "impression", label: "一句话总体印象", content: "", position: 0 },
  { kind: "pros", label: "做得好的地方", content: "", position: 1 },
  { kind: "cons", label: "可以改进的地方", content: "", position: 2 },
  { kind: "highlights", label: "核心亮点", content: "", position: 3 },
  { kind: "lessons", label: "值得借鉴的设计", content: "", position: 4 },
  { kind: "improvements", label: "如果由我来设计", content: "", position: 5 },
  { kind: "summary", label: "自由总结", content: "", position: 6 },
];

const sectionLabels: Record<string, string> = Object.fromEntries(
  reviewTemplate.map((section) => [section.kind, section.label ?? section.kind]),
);

const sampleEntries: Entry[] = [
  {
    id: "sample-1",
    type: "idea",
    title: "让失败成为地图的一部分",
    body: "玩家每次失败的位置都留下微弱痕迹，逐渐形成一张属于自己的风险地图。它既是叙事，也是下一次行动的线索。",
    designTheme: "核心玩法",
    status: "draft",
    favorite: true,
    version: 1,
    tags: ["失败反馈", "环境叙事"],
    sections: [],
    images: [],
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: "sample-2",
    type: "review",
    title: "《空洞骑士》的探索节奏",
    body: "真正驱动探索的不是奖励密度，而是持续制造“我好像能到那里”的空间暗示。",
    designTheme: "关卡设计",
    status: "complete",
    favorite: false,
    version: 1,
    tags: ["探索", "地图", "节奏"],
    sections: [
      { kind: "highlights", label: "核心亮点", content: "用声音、地标和未解锁路径共同制造方向感。", position: 0 },
      { kind: "lessons", label: "值得借鉴的设计", content: "让玩家记住空间关系，而不是只跟随任务箭头。", position: 1 },
    ],
    images: [],
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    updatedAt: new Date(Date.now() - 7200000).toISOString(),
  },
];

const emptyInput = (type: EntryType = "idea"): EntryInput => ({
  type,
  title: "",
  body: "",
  gameId: null,
  designTheme: "",
  status: "draft",
  favorite: false,
  tags: [],
  sections: type === "review" ? reviewTemplate.map((section) => ({ ...section })) : [],
});

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers:
      init?.body instanceof FormData
        ? init.headers
        : { "Content-Type": "application/json", ...init?.headers },
  });
  const data =
    response.status === 204
      ? ({} as T)
      : ((await response.json()) as T & { error?: string });
  if (!response.ok) {
    const error = new Error(
      (data as { error?: string }).error ?? "请求失败",
    ) as Error & { status?: number; data?: unknown };
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

export function StudioApp({
  initialView = "home",
  initialEntryId,
  initialGameId,
}: {
  initialView?: View;
  initialEntryId?: string;
  initialGameId?: string;
}) {
  const [view, setView] = useState<View>(initialView);
  const [entries, setEntries] = useState<Entry[]>(sampleEntries);
  const [games, setGames] = useState<Game[]>([]);
  const [selectedEntryId, setSelectedEntryId] = useState(initialEntryId);
  const [selectedGameId, setSelectedGameId] = useState(initialGameId);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );

  const loadData = useCallback(async () => {
    try {
      const [entryData, gameData] = await Promise.all([
        api<{ entries: Entry[] }>("/api/entries"),
        api<{ games: Game[] }>("/api/games"),
      ]);
      setEntries(entryData.entries);
      setGames(gameData.games);
    } catch {
      // Keep the starter records visible if the local database is not ready.
    } finally {
      setLoading(false);
    }
  }, []);

  const syncOfflineDrafts = useCallback(async () => {
    if (!navigator.onLine) return;
    const drafts = await listOfflineDrafts().catch(() => []);
    for (const draft of drafts) {
      try {
        await api(draft.entryId ? `/api/entries/${draft.entryId}` : "/api/entries", {
          method: draft.entryId ? "PATCH" : "POST",
          body: JSON.stringify(draft.payload),
        });
        await removeOfflineDraft(draft.key);
      } catch (error) {
        if ((error as Error & { status?: number }).status === 409) {
          setToast("发现跨设备修改，离线版本已保留，请打开条目处理");
        }
        break;
      }
    }
    if (drafts.length) await loadData();
  }, [loadData]);

  useEffect(() => {
    const bootstrap = window.setTimeout(() => {
      void loadData();
      void syncOfflineDrafts();
    }, 0);
    const onOnline = () => {
      setOnline(true);
      syncOfflineDrafts();
    };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
    return () => {
      window.clearTimeout(bootstrap);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [loadData, syncOfflineDrafts]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const navigate = (
    next: View,
    options?: { entryId?: string; gameId?: string; type?: EntryType },
  ) => {
    setView(next);
    setSelectedEntryId(options?.entryId);
    setSelectedGameId(options?.gameId);
    let path = "/";
    if (next === "library") path = "/library";
    if (next === "settings") path = "/settings";
    if (next === "editor") {
      path = options?.entryId
        ? `/entries/${options.entryId}`
        : `/entries/new?type=${options?.type ?? "idea"}`;
    }
    if (next === "game" && options?.gameId) path = `/games/${options.gameId}`;
    window.history.pushState({}, "", path);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const selectedEntry = entries.find((entry) => entry.id === selectedEntryId);
  const selectedGame = games.find((game) => game.id === selectedGameId);

  return (
    <div className="app-root">
      <aside className="sidebar">
        <button
          className="brand"
          onClick={() => navigate("home")}
          aria-label="返回首页"
        >
          <span className="brand-mark">G</span>
          <span>
            <strong>Gamefolio</strong>
            <small>游戏设计灵感库</small>
          </span>
        </button>
        <nav className="primary-nav" aria-label="主要导航">
          <NavButton
            active={view === "home"}
            icon="⌂"
            label="今日"
            onClick={() => navigate("home")}
          />
          <NavButton
            active={view === "library"}
            icon="▦"
            label="资料库"
            onClick={() => navigate("library")}
          />
          <NavButton
            active={view === "settings"}
            icon="◎"
            label="设置"
            onClick={() => navigate("settings")}
          />
        </nav>
        <div className="sidebar-section">
          <p>快速筛选</p>
          <button onClick={() => navigate("library")}>
            <span className="dot violet" />
            灵感
          </button>
          <button onClick={() => navigate("library")}>
            <span className="dot mint" />
            游戏复盘
          </button>
          <button onClick={() => navigate("library")}>
            <span className="dot amber" />
            已收藏
          </button>
        </div>
        <div className="sync-card">
          <span className={`online-dot ${online ? "" : "offline"}`} />
          <div>
            <strong>{online ? "云端已连接" : "当前离线"}</strong>
            <small>{online ? "内容会自动同步" : "文字草稿保存在设备上"}</small>
          </div>
        </div>
      </aside>

      <main className="main-content">
        {view === "home" && (
          <Dashboard entries={entries} loading={loading} navigate={navigate} />
        )}
        {view === "library" && (
          <Library
            entries={entries}
            navigate={navigate}
            onFavorite={async (entry) => {
              setEntries((current) =>
                current.map((item) =>
                  item.id === entry.id
                    ? { ...item, favorite: !item.favorite }
                    : item,
                ),
              );
              if (!entry.id.startsWith("sample-")) {
                await api(`/api/entries/${entry.id}`, {
                  method: "PATCH",
                  body: JSON.stringify({ ...entry, favorite: !entry.favorite }),
                }).catch(() => setToast("收藏状态暂未同步"));
              }
            }}
          />
        )}
        {view === "editor" && (
          <Editor
            key={
              selectedEntryId ??
              new URLSearchParams(
                typeof location !== "undefined" ? location.search : "",
              ).get("type") ??
              "new"
            }
            entry={selectedEntry}
            defaultType={
              typeof location !== "undefined" &&
              new URLSearchParams(location.search).get("type") === "review"
                ? "review"
                : "idea"
            }
            games={games}
            online={online}
            onSaved={(savedEntry) => {
              setEntries((current) => [
                savedEntry,
                ...current.filter((item) => item.id !== savedEntry.id),
              ]);
              setSelectedEntryId(savedEntry.id);
              window.history.replaceState({}, "", `/entries/${savedEntry.id}`);
            }}
            onDeleted={(id) => {
              setEntries((current) =>
                current.filter((entry) => entry.id !== id),
              );
              navigate("library");
              setToast("条目已删除");
            }}
            onGameCreated={(game) =>
              setGames((current) => [
                game,
                ...current.filter((item) => item.id !== game.id),
              ])
            }
            onToast={setToast}
          />
        )}
        {view === "game" && selectedGame && (
          <GameDetail
            game={selectedGame}
            entries={entries.filter(
              (entry) => entry.gameId === selectedGame.id,
            )}
            navigate={navigate}
          />
        )}
        {view === "settings" && (
          <Settings entries={entries} onToast={setToast} />
        )}
      </main>

      <nav className="bottom-nav" aria-label="移动端导航">
        <NavButton
          active={view === "home"}
          icon="⌂"
          label="今日"
          onClick={() => navigate("home")}
        />
        <button
          className="mobile-create"
          onClick={() => navigate("editor", { type: "idea" })}
          aria-label="新建灵感"
        >
          ＋
        </button>
        <NavButton
          active={view === "library"}
          icon="▦"
          label="资料库"
          onClick={() => navigate("library")}
        />
      </nav>
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

function NavButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button className={active ? "active" : ""} onClick={onClick}>
      <span aria-hidden="true">{icon}</span>
      {label}
    </button>
  );
}

function Dashboard({
  entries,
  loading,
  navigate,
}: {
  entries: Entry[];
  loading: boolean;
  navigate: (
    view: View,
    options?: { entryId?: string; type?: EntryType },
  ) => void;
}) {
  const recent = entries.slice(0, 4);
  const drafts = entries.filter((entry) => entry.status === "draft").length;
  return (
    <div className="page dashboard-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">星期二 · 保持好奇</p>
          <h1>今天捕捉到了什么？</h1>
          <p>把稍纵即逝的感受，变成以后用得上的设计判断。</p>
        </div>
        <button className="avatar" aria-label="个人账户">
          研
        </button>
      </header>

      <section className="capture-grid" aria-label="快速创建">
        <button
          className="capture-card idea-card"
          onClick={() => navigate("editor", { type: "idea" })}
        >
          <span className="capture-icon">✦</span>
          <span>
            <strong>记录一个灵感</strong>
            <small>机制、画面、声音，先记下来再整理</small>
          </span>
          <span className="arrow">↗</span>
        </button>
        <button
          className="capture-card review-card"
          onClick={() => navigate("editor", { type: "review" })}
        >
          <span className="capture-icon">◉</span>
          <span>
            <strong>开始游戏复盘</strong>
            <small>把体验拆成亮点、问题与可借鉴设计</small>
          </span>
          <span className="arrow">↗</span>
        </button>
      </section>

      <section className="stat-row">
        <article>
          <strong>{entries.length}</strong>
          <span>条设计记录</span>
        </article>
        <article>
          <strong>{entries.filter((entry) => entry.favorite).length}</strong>
          <span>个重要洞察</span>
        </article>
        <article>
          <strong>{drafts}</strong>
          <span>篇等待完成</span>
        </article>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <p className="eyebrow">RECENT NOTES</p>
            <h2>最近记录</h2>
          </div>
          <button onClick={() => navigate("library")}>
            查看全部 <span>→</span>
          </button>
        </div>
        <div className="entry-list">
          {loading && !entries.length ? (
            <p className="empty-state">正在整理你的资料库…</p>
          ) : (
            recent.map((entry) => (
              <EntryRow
                key={entry.id}
                entry={entry}
                onOpen={() =>
                  navigate("editor", { entryId: entry.id })
                }
              />
            ))
          )}
        </div>
      </section>
      <blockquote className="closing-thought">
        “好的设计观察，不必完整；只要足够诚实，就值得留下。”
      </blockquote>
    </div>
  );
}

function EntryRow({
  entry,
  onOpen,
  onFavorite,
}: {
  entry: Entry;
  onOpen: () => void;
  onFavorite?: () => void;
}) {
  return (
    <article className="entry-row" onClick={onOpen}>
      <div className={`entry-symbol ${entry.type}`}>
        {entry.type === "idea" ? "✦" : "◉"}
      </div>
      <div className="entry-main">
        <div className="entry-title-line">
          <span className={`type-pill ${entry.type}`}>
            {entry.type === "idea" ? "灵感" : "复盘"}
          </span>
          <h3>{entry.title}</h3>
        </div>
        <p>
          {entry.body ||
            entry.sections.find((section) => section.content)?.content ||
            "还没有写下正文"}
        </p>
        <div className="entry-meta">
          {entry.designTheme && <span>{entry.designTheme}</span>}
          {entry.game && <span>{entry.game.name}</span>}
          {entry.tags.slice(0, 3).map((tag) => (
            <span key={tag}>#{tag}</span>
          ))}
          <time>{formatDate(entry.updatedAt)}</time>
        </div>
      </div>
      {onFavorite && (
        <button
          className={`star-button ${entry.favorite ? "selected" : ""}`}
          onClick={(event) => {
            event.stopPropagation();
            onFavorite();
          }}
          aria-label={entry.favorite ? "取消收藏" : "收藏"}
        >
          {entry.favorite ? "★" : "☆"}
        </button>
      )}
    </article>
  );
}

function Library({
  entries,
  navigate,
  onFavorite,
}: {
  entries: Entry[];
  navigate: (
    view: View,
    options?: { entryId?: string; type?: EntryType },
  ) => void;
  onFavorite: (entry: Entry) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<
    "all" | EntryType | "favorite"
  >("all");
  const filtered = entries.filter((entry) => {
    const matchesFilter =
      filter === "all" ||
      (filter === "favorite" ? entry.favorite : entry.type === filter);
    const haystack =
      `${entry.title} ${entry.body} ${entry.designTheme ?? ""} ${entry.tags.join(" ")} ${entry.game?.name ?? ""}`.toLowerCase();
    return matchesFilter && haystack.includes(query.toLowerCase());
  });
  return (
    <div className="page library-page">
      <header className="page-header compact">
        <div>
          <p className="eyebrow">YOUR DESIGN MEMORY</p>
          <h1>资料库</h1>
          <p>所有灵感与复盘，都在这里建立联系。</p>
        </div>
        <button
          className="primary-button"
          onClick={() => navigate("editor", { type: "idea" })}
        >
          ＋ 新建记录
        </button>
      </header>
      <div className="library-toolbar">
        <label className="search-box">
          <span>⌕</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索标题、正文、游戏或标签"
          />
        </label>
        <div className="segmented" role="group" aria-label="条目筛选">
          {(
            [
              ["all", "全部"],
              ["idea", "灵感"],
              ["review", "复盘"],
              ["favorite", "收藏"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              className={filter === value ? "selected" : ""}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="library-summary">
        <span>{filtered.length} 条记录</span>
        <span>按最近更新排序</span>
      </div>
      <section className="entry-list library-list">
        {filtered.length ? (
          filtered.map((entry) => (
            <EntryRow
              key={entry.id}
              entry={entry}
              onOpen={() =>
                navigate("editor", { entryId: entry.id })
              }
              onFavorite={() => onFavorite(entry)}
            />
          ))
        ) : (
          <div className="empty-state">
            <strong>没有找到相符内容</strong>
            <p>换一个关键词，或记录新的灵感。</p>
          </div>
        )}
      </section>
    </div>
  );
}

function Editor({
  entry,
  defaultType,
  games,
  online,
  onSaved,
  onDeleted,
  onGameCreated,
  onToast,
}: {
  entry?: Entry;
  defaultType: EntryType;
  games: Game[];
  online: boolean;
  onSaved: (entry: Entry) => void;
  onDeleted: (id: string) => void;
  onGameCreated: (game: Game) => void;
  onToast: (message: string) => void;
}) {
  const [draft, setDraft] = useState<EntryInput>(() =>
    entry
      ? {
          type: entry.type,
          title: entry.title,
          body: entry.body,
          gameId: entry.gameId,
          designTheme: entry.designTheme,
          status: entry.status,
          favorite: entry.favorite,
          tags: entry.tags,
          sections:
            entry.type === "review"
              ? reviewTemplate.map(
                  (template) =>
                    entry.sections.find(
                      (section) => section.kind === template.kind,
                    ) ?? { ...template },
                )
              : [],
          version: entry.version,
        }
      : emptyInput(defaultType),
  );
  const [entryId, setEntryId] = useState(entry?.id);
  const [images, setImages] = useState<EntryImage[]>(entry?.images ?? []);
  const [tagText, setTagText] = useState(entry?.tags.join("，") ?? "");
  const [syncState, setSyncState] = useState<SyncState>("saved");
  const [gameDialog, setGameDialog] = useState(false);
  const [shareDialog, setShareDialog] = useState(false);
  const [sharePath, setSharePath] = useState("");
  const [advanced, setAdvanced] = useState(
    Boolean(entry?.gameId || entry?.designTheme || entry?.tags.length),
  );
  const saveTimer = useRef<number | undefined>(undefined);
  const fileRef = useRef<HTMLInputElement>(null);

  const selectedGame = games.find((game) => game.id === draft.gameId);
  const payload = useMemo<EntryInput>(
    () => ({
      ...draft,
      tags: tagText
        .split(/[，,\n]/)
        .map((tag) => tag.trim())
        .filter(Boolean),
    }),
    [draft, tagText],
  );

  const save = useCallback(
    async (quiet = false): Promise<Entry | undefined> => {
      if (!payload.title.trim() && !payload.body.trim()) return undefined;
      setSyncState(online ? "saving" : "offline");
      const key = entryId
        ? `entry:${entryId}`
        : `new:${crypto.randomUUID()}`;
      if (!online) {
        await saveOfflineDraft({
          key,
          entryId,
          payload,
          savedAt: new Date().toISOString(),
        });
        if (!quiet) onToast("已保存到本机，联网后会自动同步");
        return undefined;
      }
      try {
        const result = await api<{ entry: Entry }>(
          entryId ? `/api/entries/${entryId}` : "/api/entries",
          {
            method: entryId ? "PATCH" : "POST",
            body: JSON.stringify(payload),
          },
        );
        setEntryId(result.entry.id);
        setDraft((current) => ({
          ...current,
          version: result.entry.version,
        }));
        setSyncState("saved");
        onSaved(result.entry);
        if (!quiet) onToast("已保存");
        return result.entry;
      } catch (error) {
        const typed = error as Error & { status?: number };
        if (typed.status === 409) {
          setSyncState("conflict");
          await saveOfflineDraft({
            key: `conflict:${entryId}:${Date.now()}`,
            entryId,
            payload,
            savedAt: new Date().toISOString(),
          });
          onToast("检测到另一台设备的修改，本地版本已保留");
        } else {
          setSyncState("error");
          await saveOfflineDraft({
            key,
            entryId,
            payload,
            savedAt: new Date().toISOString(),
          }).catch(() => undefined);
          if (!quiet) onToast(typed.message);
        }
        return undefined;
      }
    },
    [entryId, online, onSaved, onToast, payload],
  );

  useEffect(() => {
    window.clearTimeout(saveTimer.current);
    if (!payload.title.trim() && !payload.body.trim()) return;
    saveTimer.current = window.setTimeout(() => void save(true), 1400);
    return () => window.clearTimeout(saveTimer.current);
  }, [
    payload.title,
    payload.body,
    payload.designTheme,
    payload.favorite,
    tagText,
    save,
  ]);

  const changeType = (type: EntryType) => {
    setDraft((current) => ({
      ...current,
      type,
      sections:
        type === "review"
          ? reviewTemplate.map(
              (section) =>
                current.sections?.find(
                  (item) => item.kind === section.kind,
                ) ?? { ...section },
            )
          : [],
    }));
  };

  const uploadImages = async (files: FileList | null) => {
    if (!files?.length) return;
    if (!online) {
      onToast("图片需要联网后上传，文字草稿不会丢失");
      return;
    }
    let targetId = entryId;
    if (!targetId) targetId = (await save())?.id;
    if (!targetId) {
      onToast("请先填写标题或正文");
      return;
    }
    for (const file of Array.from(files).slice(0, 10 - images.length)) {
      const form = new FormData();
      form.append("entryId", targetId);
      form.append("file", file);
      try {
        const result = await api<{ image: EntryImage }>("/api/images", {
          method: "POST",
          body: form,
        });
        setImages((current) => [...current, result.image]);
      } catch (error) {
        onToast((error as Error).message);
        break;
      }
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const updateImage = async (
    image: EntryImage,
    patch: Partial<EntryImage>,
  ) => {
    const next = { ...image, ...patch };
    setImages((current) =>
      current.map((item) => (item.id === image.id ? next : item)),
    );
    await api(`/api/images/${image.id}`, {
      method: "PATCH",
      body: JSON.stringify(next),
    }).catch(() => onToast("图片说明暂未同步"));
  };

  const moveImage = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= images.length) return;
    const next = [...images];
    [next[index], next[target]] = [next[target], next[index]];
    const normalized = next.map((image, position) => ({
      ...image,
      position,
    }));
    setImages(normalized);
    await Promise.all(
      normalized.map((image) =>
        api(`/api/images/${image.id}`, {
          method: "PATCH",
          body: JSON.stringify(image),
        }),
      ),
    ).catch(() => onToast("图片顺序暂未同步"));
  };

  const createShare = async () => {
    let targetId = entryId;
    if (!targetId) targetId = (await save())?.id;
    if (!targetId) return;
    const result = await api<{ path: string }>("/api/shares", {
      method: "POST",
      body: JSON.stringify({ entryId: targetId }),
    });
    setSharePath(`${location.origin}${result.path}`);
    setShareDialog(true);
  };

  return (
    <div className="page editor-page">
      <header className="editor-header">
        <button
          className="back-button"
          onClick={() => history.back()}
          aria-label="返回"
        >
          ←
        </button>
        <div className="type-switch">
          <button
            className={draft.type === "idea" ? "selected" : ""}
            onClick={() => changeType("idea")}
          >
            ✦ 灵感
          </button>
          <button
            className={draft.type === "review" ? "selected" : ""}
            onClick={() => changeType("review")}
          >
            ◉ 游戏复盘
          </button>
        </div>
        <div className="editor-actions">
          <span className={`sync-label ${syncState}`}>
            {syncState === "saving"
              ? "正在保存…"
              : syncState === "offline"
                ? "已存于本机"
                : syncState === "conflict"
                  ? "存在冲突"
                  : syncState === "error"
                    ? "等待重试"
                    : "已保存"}
          </span>
          <button
            className="icon-button"
            onClick={() =>
              setDraft((current) => ({
                ...current,
                favorite: !current.favorite,
              }))
            }
            aria-label="收藏"
          >
            {draft.favorite ? "★" : "☆"}
          </button>
          <button className="secondary-button" onClick={createShare}>
            分享
          </button>
          <button className="primary-button" onClick={() => void save()}>
            完成
          </button>
        </div>
      </header>

      <div className="editor-canvas">
        <p className="entry-kicker">
          {draft.type === "idea" ? "DESIGN IDEA" : "GAME REVIEW"}
        </p>
        <input
          className="title-input"
          value={draft.title}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              title: event.target.value,
            }))
          }
          placeholder={
            draft.type === "idea"
              ? "给这个灵感起个名字"
              : "这次游戏体验的主题"
          }
          maxLength={160}
        />
        <textarea
          className="lead-input"
          value={draft.body}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              body: event.target.value,
            }))
          }
          placeholder={
            draft.type === "idea"
              ? "发生了什么？为什么它值得记下来？"
              : "先写下你最直接的感受，不必急着完整。"
          }
          rows={4}
        />

        <button
          className="advanced-toggle"
          onClick={() => setAdvanced((value) => !value)}
        >
          {advanced ? "收起分类信息" : "添加游戏、主题和标签"}{" "}
          <span>{advanced ? "⌃" : "⌄"}</span>
        </button>
        {advanced && (
          <section className="metadata-panel">
            <button
              className="field-button"
              onClick={() => setGameDialog(true)}
            >
              <span>
                <small>关联游戏</small>
                <strong>{selectedGame?.name ?? "选择或创建游戏"}</strong>
              </span>
              <span>›</span>
            </button>
            <label>
              <small>设计主题</small>
              <select
                value={draft.designTheme ?? ""}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    designTheme: event.target.value,
                  }))
                }
              >
                <option value="">未选择</option>
                <option>核心玩法</option>
                <option>关卡设计</option>
                <option>叙事设计</option>
                <option>视觉与交互</option>
                <option>音频设计</option>
                <option>数值与经济</option>
                <option>玩家心理</option>
              </select>
            </label>
            <label className="wide-field">
              <small>标签</small>
              <input
                value={tagText}
                onChange={(event) => setTagText(event.target.value)}
                placeholder="用逗号分隔，例如：探索，反馈，节奏"
              />
            </label>
          </section>
        )}

        {draft.type === "review" && (
          <section className="review-sections">
            <div className="content-divider">
              <span>引导式复盘</span>
              <small>所有模块均可跳过</small>
            </div>
            {draft.sections?.map((section, index) => (
              <label className="review-field" key={section.kind}>
                <span>
                  <b>{String(index + 1).padStart(2, "0")}</b>
                  {sectionLabels[section.kind] ?? section.kind}
                </span>
                <textarea
                  value={section.content}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      sections: current.sections?.map((item) =>
                        item.kind === section.kind
                          ? { ...item, content: event.target.value }
                          : item,
                      ),
                    }))
                  }
                  placeholder="写下你观察到的具体设计，以及它带来的玩家感受…"
                  rows={3}
                />
              </label>
            ))}
          </section>
        )}

        <section className="image-section">
          <div className="content-divider">
            <span>图片资料</span>
            <small>{images.length}/10</small>
          </div>
          <div className="image-grid">
            {images.map((image, index) => (
              <figure className="image-card" key={image.id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.url} alt={image.caption || image.fileName} />
                <figcaption>
                  <input
                    value={image.caption}
                    onChange={(event) =>
                      setImages((current) =>
                        current.map((item) =>
                          item.id === image.id
                            ? { ...item, caption: event.target.value }
                            : item,
                        ),
                      )
                    }
                    onBlur={() =>
                      updateImage(image, {
                        caption:
                          images.find((item) => item.id === image.id)?.caption ??
                          "",
                      })
                    }
                    placeholder="说明这张图值得注意的地方"
                  />
                  <div>
                    <button
                      onClick={() => moveImage(index, -1)}
                      disabled={index === 0}
                    >
                      ←
                    </button>
                    <button
                      onClick={() => moveImage(index, 1)}
                      disabled={index === images.length - 1}
                    >
                      →
                    </button>
                    <button
                      className="danger-text"
                      onClick={async () => {
                        await api(`/api/images/${image.id}`, {
                          method: "DELETE",
                        });
                        setImages((current) =>
                          current.filter((item) => item.id !== image.id),
                        );
                      }}
                    >
                      删除
                    </button>
                  </div>
                </figcaption>
              </figure>
            ))}
            {images.length < 10 && (
              <button
                className="image-uploader"
                onClick={() => fileRef.current?.click()}
              >
                <span>＋</span>
                <strong>添加参考图片</strong>
                <small>支持粘贴或上传，单张不超过 15 MB</small>
              </button>
            )}
          </div>
          <input
            ref={fileRef}
            className="sr-only"
            type="file"
            accept="image/*"
            multiple
            onChange={(event) => void uploadImages(event.target.files)}
          />
        </section>

        <div className="editor-footer">
          <label className="status-control">
            <span>状态</span>
            <select
              value={draft.status}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  status: event.target.value as "draft" | "complete",
                }))
              }
            >
              <option value="draft">草稿</option>
              <option value="complete">已完成</option>
            </select>
          </label>
          {entryId && !entryId.startsWith("sample-") && (
            <button
              className="danger-button"
              onClick={async () => {
                if (
                  confirm("确定删除这条记录吗？图片和分享链接也会被删除。")
                ) {
                  await api(`/api/entries/${entryId}`, {
                    method: "DELETE",
                  });
                  onDeleted(entryId);
                }
              }}
            >
              删除条目
            </button>
          )}
        </div>
      </div>

      <GamePicker
        open={gameDialog}
        onOpenChange={setGameDialog}
        games={games}
        selectedId={draft.gameId ?? undefined}
        onSelect={(game) => {
          onGameCreated(game);
          setDraft((current) => ({ ...current, gameId: game.id }));
          setGameDialog(false);
        }}
        onToast={onToast}
      />
      <Dialog.Root open={shareDialog} onOpenChange={setShareDialog}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="dialog-content">
            <Dialog.Title>只读分享链接</Dialog.Title>
            <Dialog.Description>
              拥有链接的人只能阅读这篇内容。重新生成链接会使旧链接失效。
            </Dialog.Description>
            <div className="share-link">
              <input readOnly value={sharePath} />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(sharePath);
                  onToast("链接已复制");
                }}
              >
                复制
              </button>
            </div>
            <div className="dialog-actions">
              <Dialog.Close asChild>
                <button className="secondary-button">关闭</button>
              </Dialog.Close>
              <button
                className="danger-text"
                onClick={async () => {
                  if (entryId) {
                    await api(`/api/shares?entryId=${entryId}`, {
                      method: "DELETE",
                    });
                  }
                  setSharePath("");
                  setShareDialog(false);
                  onToast("分享已撤销");
                }}
              >
                撤销分享
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

function GamePicker({
  open,
  onOpenChange,
  games,
  selectedId,
  onSelect,
  onToast,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  games: Game[];
  selectedId?: string;
  onSelect: (game: Game) => void;
  onToast: (message: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Game[]>(games);
  const [searching, setSearching] = useState(false);
  const search = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const result = await api<{ games: Array<Omit<Game, "id">> }>(
        `/api/games/search?q=${encodeURIComponent(query)}`,
      );
      setResults(
        result.games.map((game, index) => ({
          ...game,
          id: `search-${game.igdbId ?? index}`,
        })),
      );
    } catch (error) {
      onToast((error as Error).message);
    } finally {
      setSearching(false);
    }
  };
  const choose = async (game: Game) => {
    if (!game.id.startsWith("search-")) return onSelect(game);
    const result = await api<{ game: Game }>("/api/games", {
      method: "POST",
      body: JSON.stringify({
        ...game,
        id: undefined,
        isManual: !game.igdbId,
      }),
    });
    onSelect(result.game);
  };
  const createManual = async () => {
    if (!query.trim()) return;
    const result = await api<{ game: Game }>("/api/games", {
      method: "POST",
      body: JSON.stringify({ name: query, isManual: true }),
    });
    onSelect(result.game);
  };
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content game-dialog">
          <Dialog.Title>关联一款游戏</Dialog.Title>
          <Dialog.Description>
            搜索 IGDB，或创建自己的游戏档案。
          </Dialog.Description>
          <div className="dialog-search">
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void search();
              }}
              placeholder="输入游戏名称"
            />
            <button onClick={search}>
              {searching ? "搜索中…" : "搜索"}
            </button>
          </div>
          <div className="game-results">
            {results.map((game) => (
              <button
                key={game.id}
                className={selectedId === game.id ? "selected" : ""}
                onClick={() => void choose(game)}
              >
                {game.coverUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={game.coverUrl} alt="" />
                ) : (
                  <span className="game-placeholder">
                    {game.name.slice(0, 1)}
                  </span>
                )}
                <span>
                  <strong>{game.name}</strong>
                  <small>
                    {[...game.genres, ...game.platforms]
                      .slice(0, 3)
                      .join(" · ") || "自定义游戏"}
                  </small>
                </span>
                <b>›</b>
              </button>
            ))}
          </div>
          {query && (
            <button className="manual-game" onClick={createManual}>
              ＋ 创建“{query}”的手动档案
            </button>
          )}
          <Dialog.Close className="dialog-close" aria-label="关闭">
            ×
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function GameDetail({
  game,
  entries,
  navigate,
}: {
  game: Game;
  entries: Entry[];
  navigate: (
    view: View,
    options?: { entryId?: string; type?: EntryType },
  ) => void;
}) {
  return (
    <div className="page game-page">
      <header className="game-hero">
        {game.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={game.coverUrl} alt={`${game.name} 封面`} />
        ) : (
          <div className="large-game-placeholder">{game.name.slice(0, 1)}</div>
        )}
        <div>
          <p className="eyebrow">GAME ARCHIVE</p>
          <h1>{game.name}</h1>
          <p>{[...game.genres, ...game.platforms].join(" · ")}</p>
          {game.developer && <span>{game.developer}</span>}
        </div>
      </header>
      <section className="section-block">
        <div className="section-heading">
          <h2>相关记录</h2>
          <button onClick={() => navigate("editor", { type: "idea" })}>
            ＋ 添加灵感
          </button>
        </div>
        <div className="entry-list">
          {entries.map((entry) => (
            <EntryRow
              key={entry.id}
              entry={entry}
              onOpen={() => navigate("editor", { entryId: entry.id })}
            />
          ))}
          {!entries.length && (
            <p className="empty-state">还没有与这款游戏关联的记录。</p>
          )}
        </div>
      </section>
    </div>
  );
}

function Settings({
  entries,
  onToast,
}: {
  entries: Entry[];
  onToast: (message: string) => void;
}) {
  const [theme, setTheme] = useState<"system" | "light" | "dark">(() =>
    typeof localStorage === "undefined"
      ? "system"
      : ((localStorage.getItem("theme") as "system" | "light" | "dark") ??
        "system"),
  );
  const applyTheme = (next: "system" | "light" | "dark") => {
    setTheme(next);
    localStorage.setItem("theme", next);
    setDocumentTheme(next);
  };
  const exportLibrary = async () => {
    try {
      const data = await api<{
        entries: Entry[];
        games: Game[];
        exportedAt: string;
      }>("/api/export");
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      zip.file("library.json", JSON.stringify(data, null, 2));
      const notes = zip.folder("markdown");
      const imageFolder = zip.folder("images");
      for (const entry of data.entries) {
        const sections = entry.sections
          .map(
            (section) =>
              `## ${sectionLabels[section.kind] ?? section.kind}\n\n${section.content}`,
          )
          .join("\n\n");
        notes?.file(
          `${entry.title.replace(/[\\/:*?"<>|]/g, "-") || entry.id}.md`,
          `# ${entry.title}\n\n${entry.body}\n\n${sections}\n\n标签：${entry.tags.join("、")}`,
        );
        for (const image of entry.images) {
          const response = await fetch(`/api/images/${image.id}`);
          if (!response.ok) continue;
          const extension =
            image.fileName.split(".").pop()?.replace(/[^\w]/g, "") || "bin";
          imageFolder?.file(
            `${entry.id}/${String(image.position + 1).padStart(2, "0")}-${image.id}.${extension}`,
            await response.blob(),
          );
        }
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `gamefolio-backup-${new Date().toISOString().slice(0, 10)}.zip`;
      link.click();
      URL.revokeObjectURL(link.href);
      onToast("资料库备份已生成");
    } catch (error) {
      onToast((error as Error).message);
    }
  };
  return (
    <div className="page settings-page">
      <header className="page-header compact">
        <div>
          <p className="eyebrow">PREFERENCES & DATA</p>
          <h1>设置</h1>
          <p>让资料库更适合你的工作方式。</p>
        </div>
      </header>
      <section className="settings-group">
        <h2>外观</h2>
        <div className="settings-card">
          <div>
            <strong>显示模式</strong>
            <small>跟随系统，或固定使用亮色、深色</small>
          </div>
          <div className="segmented">
            {(["system", "light", "dark"] as const).map((value) => (
              <button
                key={value}
                className={theme === value ? "selected" : ""}
                onClick={() => applyTheme(value)}
              >
                {value === "system"
                  ? "自动"
                  : value === "light"
                    ? "亮色"
                    : "深色"}
              </button>
            ))}
          </div>
        </div>
      </section>
      <section className="settings-group">
        <h2>数据与备份</h2>
        <div className="settings-card">
          <div>
            <strong>导出完整资料库</strong>
            <small>
              包含 JSON、Markdown 与内容关系；当前共 {entries.length} 条记录
            </small>
          </div>
          <button className="secondary-button" onClick={exportLibrary}>
            导出 ZIP
          </button>
        </div>
      </section>
      <section className="settings-group">
        <h2>账号</h2>
        <div className="settings-card">
          <div>
            <strong>个人资料库</strong>
            <small>通过当前安全账户访问，所有写入均按用户隔离</small>
          </div>
          <a
            className="secondary-button"
            href="/signout-with-chatgpt?return_to=/"
          >
            退出登录
          </a>
        </div>
      </section>
    </div>
  );
}

function setDocumentTheme(theme: "system" | "light" | "dark") {
  document.documentElement.dataset.theme = theme;
}
