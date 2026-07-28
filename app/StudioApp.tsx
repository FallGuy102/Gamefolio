"use client";

import * as Dialog from "@radix-ui/react-dialog";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
} from "motion/react";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleCheck,
  Cloud,
  CloudOff,
  Download,
  FileText,
  Gamepad2,
  House,
  ImagePlus,
  LibraryBig,
  Lightbulb,
  LogOut,
  Pencil,
  Palette,
  Plus,
  Search,
  Settings as SettingsIcon,
  Share2,
  SlidersHorizontal,
  Sparkles,
  Star,
  Tags,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Entry, EntryImage, EntryInput, EntryType, Game, ReviewSection } from "./lib/types";
import { listOfflineDrafts, removeOfflineDraft, saveOfflineDraft } from "./lib/offline";

type View = "home" | "library" | "detail" | "editor" | "game" | "settings";
type SyncState = "saved" | "saving" | "offline" | "conflict" | "error";
type LibraryFilter = "all" | EntryType | "favorite";
type NavigateOptions = {
  entryId?: string;
  gameId?: string;
  type?: EntryType;
  filter?: LibraryFilter;
  replace?: boolean;
};

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

const designThemes = [
  "核心玩法",
  "关卡设计",
  "叙事设计",
  "视觉与交互",
  "音频设计",
  "数值与经济",
  "玩家心理",
];

const emptyInput = (type: EntryType = "idea"): EntryInput => ({
  type,
  title: "",
  body: "",
  gameId: null,
  designTheme: "",
  status: "complete",
  favorite: false,
  tags: [],
  sections: type === "review" ? reviewTemplate.map((section) => ({ ...section })) : [],
});

const parseLibraryFilter = (search: string): LibraryFilter => {
  const filter = new URLSearchParams(search).get("filter");
  return filter === "idea" || filter === "review" || filter === "favorite"
    ? filter
    : "all";
};

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

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);
  return matches;
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
  const [entries, setEntries] = useState<Entry[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [selectedEntryId, setSelectedEntryId] = useState(initialEntryId);
  const [selectedGameId, setSelectedGameId] = useState(initialGameId);
  const [editorSessionKey, setEditorSessionKey] = useState(
    initialEntryId ?? "new",
  );
  const [libraryFilter, setLibraryFilter] = useState<LibraryFilter>("all");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);
  const [navigationDirection, setNavigationDirection] = useState(1);
  const [online, setOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const reduceMotion = useReducedMotion();
  const usesPushTransition =
    view === "detail" || view === "editor" || view === "game";

  const loadData = useCallback(async () => {
    try {
      const [entryData, gameData] = await Promise.all([
        api<{ entries: Entry[] }>("/api/entries"),
        api<{ games: Game[] }>("/api/games"),
      ]);
      setEntries(entryData.entries);
      setGames(gameData.games);
    } catch (error) {
      setEntries([]);
      setGames([]);
      setToast(
        `${(error as Error).message}。请确认 Supabase 数据库脚本已成功运行。`,
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const syncOfflineDrafts = useCallback(async () => {
    if (!navigator.onLine) return;
    const drafts = await listOfflineDrafts().catch(() => []);
    for (const draft of drafts) {
      if (draft.key.startsWith("conflict:")) continue;
      try {
        await api(draft.entryId ? `/api/entries/${draft.entryId}` : "/api/entries", {
          method: draft.entryId ? "PATCH" : "POST",
          body: JSON.stringify(draft.payload),
        });
        await removeOfflineDraft(draft.key);
      } catch (error) {
        if ((error as Error & { status?: number }).status === 409) {
          await saveOfflineDraft({
            ...draft,
            key: `conflict:${draft.entryId ?? "new"}:${Date.now()}`,
          });
          await removeOfflineDraft(draft.key);
          setToast("发现跨设备修改，离线版本已保留，请打开条目处理");
        }
        break;
      }
    }
  }, []);

  useEffect(() => {
    const bootstrap = window.setTimeout(() => {
      void syncOfflineDrafts().finally(loadData);
    }, 0);
    const onOnline = () => {
      setOnline(true);
      void syncOfflineDrafts().finally(loadData);
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
    const syncViewFromUrl = () => {
      const path = window.location.pathname;
      setNavigationDirection(-1);
      if (path === "/") {
        setView("home");
        setSelectedEntryId(undefined);
      } else if (path === "/library") {
        setView("library");
        setSelectedEntryId(undefined);
        setLibraryFilter(parseLibraryFilter(window.location.search));
      } else if (path === "/settings") {
        setView("settings");
        setSelectedEntryId(undefined);
      } else if (path.startsWith("/entries/")) {
        setView(path === "/entries/new" ? "editor" : "detail");
        const id = path.split("/")[2];
        setSelectedEntryId(id === "new" ? undefined : id);
        setEditorSessionKey(id === "new" ? "new" : id);
      } else if (path.startsWith("/games/")) {
        setView("game");
        setSelectedGameId(path.split("/")[2]);
      }
    };
    if (typeof window.history.state?.gamefolioDepth !== "number") {
      window.history.replaceState(
        { ...window.history.state, gamefolioDepth: 0 },
        "",
        window.location.href,
      );
    }
    syncViewFromUrl();
    window.addEventListener("popstate", syncViewFromUrl);
    return () => window.removeEventListener("popstate", syncViewFromUrl);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const navigate = (
    next: View,
    options?: NavigateOptions,
  ) => {
    setNavigationDirection(1);
    setView(next);
    setSelectedEntryId(options?.entryId);
    setSelectedGameId(options?.gameId);
    let path = "/";
    if (next === "library") {
      const filter = options?.filter ?? "all";
      setLibraryFilter(filter);
      path = filter === "all" ? "/library" : `/library?filter=${filter}`;
    }
    if (next === "settings") path = "/settings";
    if (next === "detail" || next === "editor") {
      setEditorSessionKey(options?.entryId ?? "new");
      path = options?.entryId
        ? `/entries/${options.entryId}`
        : `/entries/new?type=${options?.type ?? "idea"}`;
    }
    if (next === "game" && options?.gameId) path = `/games/${options.gameId}`;
    const depth = Number(window.history.state?.gamefolioDepth ?? 0);
    const state = { gamefolioDepth: options?.replace ? depth : depth + 1 };
    if (options?.replace) {
      window.history.replaceState(state, "", path);
    } else {
      window.history.pushState(state, "", path);
    }
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  const navigateBack = () => {
    const depth = Number(window.history.state?.gamefolioDepth ?? 0);
    if (depth > 0) {
      setNavigationDirection(-1);
      window.history.back();
      return;
    }
    navigate("library", { replace: true });
  };

  const selectedEntry = entries.find((entry) => entry.id === selectedEntryId);
  const selectedGame = games.find((game) => game.id === selectedGameId);
  const showsCollectionPane =
    Boolean(selectedEntryId) && editorSessionKey !== "new";

  const toggleFavorite = async (entry: Entry) => {
    const favorite = !entry.favorite;
    setEntries((current) =>
      current.map((item) =>
        item.id === entry.id ? { ...item, favorite } : item,
      ),
    );
    try {
      const result = await api<{ entry: Entry }>(`/api/entries/${entry.id}`, {
        method: "PATCH",
        body: JSON.stringify({ ...entry, favorite }),
      });
      setEntries((current) =>
        current.map((item) =>
          item.id === result.entry.id ? result.entry : item,
        ),
      );
    } catch {
      setEntries((current) =>
        current.map((item) =>
          item.id === entry.id ? entry : item,
        ),
      );
      await loadData();
      setToast("收藏状态暂未同步");
    }
  };

  const renderEditor = () => (
    <Editor
      key={editorSessionKey}
      entry={selectedEntry}
      defaultType={
        typeof location !== "undefined" &&
        new URLSearchParams(location.search).get("type") === "review"
          ? "review"
          : "idea"
      }
      games={games}
      online={online}
      initialEditing={view === "editor"}
      onModeChange={(editing) => setView(editing ? "editor" : "detail")}
      onBack={navigateBack}
      onSaved={(savedEntry) => {
        setEntries((current) => [
          savedEntry,
          ...current.filter((item) => item.id !== savedEntry.id),
        ]);
        setSelectedEntryId(savedEntry.id);
        const depth = Number(window.history.state?.gamefolioDepth ?? 0);
        window.history.replaceState(
          { gamefolioDepth: depth },
          "",
          `/entries/${savedEntry.id}`,
        );
      }}
      onDeleted={(id) => {
        setEntries((current) => current.filter((entry) => entry.id !== id));
        navigate("library", { replace: true });
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
  );

  return (
    <div className={`app-root view-${view}`}>
      <aside className="sidebar">
        <button
          className="brand"
          onClick={() => navigate("home")}
          aria-label="返回首页"
        >
          <span className="brand-mark"><Sparkles size={18} strokeWidth={2.2} /></span>
          <span>
            <strong>Gamefolio</strong>
            <small>游戏设计灵感库</small>
          </span>
        </button>
        <nav className="primary-nav" aria-label="主要导航">
          <NavButton
            active={view === "home"}
            icon={House}
            label="今日"
            onClick={() => navigate("home")}
          />
          <NavButton
            active={view === "library" || view === "detail" || view === "editor"}
            icon={LibraryBig}
            label="资料库"
            onClick={() => navigate("library")}
          />
          <NavButton
            active={view === "settings"}
            icon={SettingsIcon}
            label="设置"
            onClick={() => navigate("settings")}
          />
        </nav>
        <button className="sidebar-compose" onClick={() => setComposeOpen(true)}>
          <Plus size={17} />
          新建记录
        </button>
        <div className="sidebar-section">
          <p>快速筛选</p>
          <button
            className={view === "library" && libraryFilter === "idea" ? "selected" : ""}
            aria-pressed={view === "library" && libraryFilter === "idea"}
            onClick={() =>
              navigate("library", { filter: "idea", replace: view === "library" })
            }
          >
            <Lightbulb size={16} />
            灵感
          </button>
          <button
            className={view === "library" && libraryFilter === "review" ? "selected" : ""}
            aria-pressed={view === "library" && libraryFilter === "review"}
            onClick={() =>
              navigate("library", { filter: "review", replace: view === "library" })
            }
          >
            <Gamepad2 size={16} />
            游戏复盘
          </button>
          <button
            className={view === "library" && libraryFilter === "favorite" ? "selected" : ""}
            aria-pressed={view === "library" && libraryFilter === "favorite"}
            onClick={() =>
              navigate("library", {
                filter: "favorite",
                replace: view === "library",
              })
            }
          >
            <Star size={16} />
            已收藏
          </button>
        </div>
        <div className="sync-card">
          {online ? <Cloud size={17} /> : <CloudOff size={17} />}
          <div>
            <strong>{online ? "云端已连接" : "当前离线"}</strong>
            <small>{online ? "内容会自动同步" : "文字草稿保存在设备上"}</small>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            className="view-stage"
            key={
              view === "detail" || view === "editor"
                ? `entry-${editorSessionKey}`
                : view
            }
            initial={
              reduceMotion || !usesPushTransition
                ? { opacity: 0 }
                : { opacity: 0, x: navigationDirection * 18 }
            }
            animate={{ opacity: 1, x: 0 }}
            exit={
              reduceMotion || !usesPushTransition
                ? { opacity: 0 }
                : { opacity: 0, x: navigationDirection * -12 }
            }
            transition={
              reduceMotion || !usesPushTransition
                ? { duration: reduceMotion ? 0.08 : 0.14, ease: "easeOut" }
                : { type: "spring", bounce: 0, duration: 0.36 }
            }
          >
        {view === "home" && (
          <Dashboard entries={entries} loading={loading} navigate={navigate} />
        )}
        {view === "library" && (
          <Library
            entries={entries}
            filter={libraryFilter}
            onFilterChange={(filter) =>
              navigate("library", { filter, replace: true })
            }
            navigate={navigate}
            onFavorite={toggleFavorite}
          />
        )}
        {(view === "detail" || view === "editor") && selectedEntryId && loading && !selectedEntry && (
          <div className="page detail-loading" role="status">
            正在载入条目…
          </div>
        )}
        {(view === "detail" || view === "editor") && selectedEntryId && !loading && !selectedEntry && (
          <div className="page detail-loading">
            <strong>没有找到这条记录</strong>
            <button className="secondary-button" onClick={() => navigate("library")}>
              返回资料库
            </button>
          </div>
        )}
        {(view === "detail" || view === "editor") && (!selectedEntryId || selectedEntry) && (
          <div
            className={`library-workspace ${
              showsCollectionPane ? "has-collection" : ""
            }`}
          >
            {showsCollectionPane && (
              <div className="collection-pane">
                <Library
                  compact
                  entries={entries}
                  filter={libraryFilter}
                  onFilterChange={setLibraryFilter}
                  selectedEntryId={selectedEntryId}
                  navigate={navigate}
                  onFavorite={toggleFavorite}
                />
              </div>
            )}
            <div className="detail-pane">{renderEditor()}</div>
          </div>
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
          </motion.div>
        </AnimatePresence>
      </main>

      <nav className="bottom-nav" aria-label="移动端导航">
        <NavButton
          active={view === "home"}
          icon={House}
          label="今日"
          onClick={() => navigate("home")}
        />
        <NavButton
          active={view === "library" || view === "detail" || view === "editor"}
          icon={LibraryBig}
          label="资料库"
          onClick={() => navigate("library")}
        />
        <NavButton
          active={view === "settings"}
          icon={SettingsIcon}
          label="设置"
          onClick={() => navigate("settings")}
        />
      </nav>
      <button
        className="mobile-compose"
        onClick={() => setComposeOpen(true)}
        aria-label="新建记录"
      >
        <Pencil size={21} />
      </button>
      <ComposeSheet
        open={composeOpen}
        onOpenChange={setComposeOpen}
        onChoose={(type) => {
          setComposeOpen(false);
          navigate("editor", { type });
        }}
      />
      <PwaEdgeBack
        enabled={view === "detail" || view === "editor" || view === "game"}
        onBack={navigateBack}
      />
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

function PwaEdgeBack({
  enabled,
  onBack,
}: {
  enabled: boolean;
  onBack: () => void;
}) {
  const x = useMotionValue(0);
  const [standalone, setStandalone] = useState(false);
  const dragRef = useRef<{ start: number; last: number; time: number; velocity: number } | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(display-mode: standalone)");
    const update = () =>
      setStandalone(
        media.matches ||
          Boolean((navigator as Navigator & { standalone?: boolean }).standalone),
      );
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  if (!enabled || !standalone) return null;

  return (
    <div
      className="pwa-edge-back"
      aria-hidden="true"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        dragRef.current = {
          start: event.clientX,
          last: event.clientX,
          time: performance.now(),
          velocity: 0,
        };
      }}
      onPointerMove={(event) => {
        const drag = dragRef.current;
        if (!drag) return;
        const now = performance.now();
        const deltaTime = Math.max(1, now - drag.time);
        drag.velocity = ((event.clientX - drag.last) / deltaTime) * 1000;
        drag.last = event.clientX;
        drag.time = now;
        const distance = Math.max(0, event.clientX - drag.start);
        x.set((distance * 180 * 0.55) / (180 + 0.55 * distance));
      }}
      onPointerUp={() => {
        const drag = dragRef.current;
        dragRef.current = null;
        if (!drag) return;
        const projected = x.get() + drag.velocity * 0.12;
        if (projected > 62) {
          animate(x, 90, {
            type: "spring",
            bounce: 0,
            duration: 0.22,
            onComplete: onBack,
          });
        } else {
          animate(x, 0, { type: "spring", bounce: 0, duration: 0.32 });
        }
      }}
      onPointerCancel={() => {
        dragRef.current = null;
        animate(x, 0, { type: "spring", bounce: 0, duration: 0.3 });
      }}
    >
      <motion.span style={{ x }}>
        <ChevronRight size={18} />
      </motion.span>
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
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  const Icon = icon;
  return (
    <button className={active ? "active" : ""} onClick={onClick}>
      <span aria-hidden="true"><Icon size={19} strokeWidth={active ? 2.35 : 1.9} /></span>
      {label}
    </button>
  );
}

function ComposeSheet({
  open,
  onOpenChange,
  onChoose,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChoose: (type: EntryType) => void;
}) {
  const reduceMotion = useReducedMotion();
  const mobile = useMediaQuery("(max-width: 767px)");
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal forceMount>
        <AnimatePresence>
          {open && (
            <>
              <Dialog.Overlay asChild forceMount>
                <motion.div
                  className="dialog-overlay compose-overlay"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reduceMotion ? 0.12 : 0.2 }}
                />
              </Dialog.Overlay>
              <Dialog.Content asChild forceMount>
                <motion.div
                  className="compose-sheet"
                  initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 36, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 48, scale: 0.98 }}
                  transition={{ type: "spring", bounce: 0, duration: 0.36 }}
                  drag={mobile && !reduceMotion ? "y" : false}
                  dragConstraints={{ top: 0, bottom: 0 }}
                  dragElastic={{ top: 0.04, bottom: 0.6 }}
                  onDragEnd={(_, info) => {
                    const projected = info.offset.y + info.velocity.y * 0.16;
                    if (projected > 120) onOpenChange(false);
                  }}
                >
                  <div className="sheet-grabber" aria-hidden="true" />
                  <Dialog.Title>新建记录</Dialog.Title>
                  <Dialog.Description>选择最适合此刻想法的记录方式。</Dialog.Description>
                  <div className="compose-options">
                    <button onClick={() => onChoose("idea")}>
                      <span className="compose-option-icon idea"><Lightbulb size={22} /></span>
                      <span>
                        <strong>记录灵感</strong>
                        <small>快速保存机制、画面、声音或叙事想法</small>
                      </span>
                      <ChevronRight size={18} />
                    </button>
                    <button onClick={() => onChoose("review")}>
                      <span className="compose-option-icon review"><Gamepad2 size={22} /></span>
                      <span>
                        <strong>游戏复盘</strong>
                        <small>整理亮点、问题以及值得借鉴的设计</small>
                      </span>
                      <ChevronRight size={18} />
                    </button>
                  </div>
                  <Dialog.Close className="sheet-cancel">取消</Dialog.Close>
                </motion.div>
              </Dialog.Content>
            </>
          )}
        </AnimatePresence>
      </Dialog.Portal>
    </Dialog.Root>
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
    options?: NavigateOptions,
  ) => void;
}) {
  const recent = entries.slice(0, 4);
  const drafts = entries.filter((entry) => entry.status === "draft").length;
  return (
    <div className="page dashboard-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">今天</p>
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
          <span className="capture-icon"><Lightbulb size={21} /></span>
          <span>
            <strong>记录一个灵感</strong>
            <small>机制、画面、声音，先记下来再整理</small>
          </span>
          <span className="arrow"><ChevronRight size={19} /></span>
        </button>
        <button
          className="capture-card review-card"
          onClick={() => navigate("editor", { type: "review" })}
        >
          <span className="capture-icon"><Gamepad2 size={21} /></span>
          <span>
            <strong>开始游戏复盘</strong>
            <small>把体验拆成亮点、问题与可借鉴设计</small>
          </span>
          <span className="arrow"><ChevronRight size={19} /></span>
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
            <p className="eyebrow">最近</p>
            <h2>最近记录</h2>
          </div>
          <button onClick={() => navigate("library")}>
            查看全部 <ChevronRight size={14} />
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
                  navigate("detail", { entryId: entry.id })
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
  selected = false,
}: {
  entry: Entry;
  onOpen: () => void;
  onFavorite?: () => void;
  selected?: boolean;
}) {
  return (
    <article
      className={`entry-row ${selected ? "selected" : ""}`}
      onClick={onOpen}
      aria-current={selected ? "page" : undefined}
    >
      <div className={`entry-symbol ${entry.type}`}>
        {entry.type === "idea" ? <Lightbulb size={19} /> : <Gamepad2 size={19} />}
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
          <Star size={18} fill={entry.favorite ? "currentColor" : "none"} />
        </button>
      )}
    </article>
  );
}

function Library({
  entries,
  filter,
  onFilterChange,
  navigate,
  onFavorite,
  compact = false,
  selectedEntryId,
}: {
  entries: Entry[];
  filter: LibraryFilter;
  onFilterChange: (filter: LibraryFilter) => void;
  navigate: (view: View, options?: NavigateOptions) => void;
  onFavorite: (entry: Entry) => void;
  compact?: boolean;
  selectedEntryId?: string;
}) {
  const [query, setQuery] = useState("");
  const filtered = entries.filter((entry) => {
    const matchesFilter =
      filter === "all" ||
      (filter === "favorite" ? entry.favorite : entry.type === filter);
    const haystack =
      `${entry.title} ${entry.body} ${entry.designTheme ?? ""} ${entry.tags.join(" ")} ${entry.game?.name ?? ""}`.toLowerCase();
    return matchesFilter && haystack.includes(query.toLowerCase());
  });
  return (
    <div className={`page library-page ${compact ? "compact-library" : ""}`}>
      <header className="page-header compact">
        <div>
          <p className="eyebrow">浏览</p>
          <h1>资料库</h1>
          <p>所有灵感与复盘，都在这里建立联系。</p>
        </div>
        <button
          className="primary-button"
          onClick={() => navigate("editor", { type: "idea" })}
        >
          <Plus size={16} /> 新建记录
        </button>
      </header>
      <div className="library-toolbar">
        <label className="search-box">
          <span><Search size={17} /></span>
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
              aria-pressed={filter === value}
              onClick={() => onFilterChange(value)}
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
              selected={entry.id === selectedEntryId}
              onOpen={() =>
                navigate("detail", { entryId: entry.id })
              }
              onFavorite={
                compact && entry.id === selectedEntryId
                  ? undefined
                  : () => onFavorite(entry)
              }
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
  initialEditing,
  onModeChange,
  onBack,
  onSaved,
  onDeleted,
  onGameCreated,
  onToast,
}: {
  entry?: Entry;
  defaultType: EntryType;
  games: Game[];
  online: boolean;
  initialEditing: boolean;
  onModeChange: (editing: boolean) => void;
  onBack: () => void;
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
  const [editing, setEditing] = useState(initialEditing || !entry);
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
  const entryIdRef = useRef(entry?.id);
  const versionRef = useRef(entry?.version);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const conflictRef = useRef(false);
  const onSavedRef = useRef(onSaved);
  const onToastRef = useRef(onToast);
  const offlineKeyRef = useRef(
    entry?.id ? `entry:${entry.id}` : `new:${crypto.randomUUID()}`,
  );
  const fileRef = useRef<HTMLInputElement>(null);
  const mobile = useMediaQuery("(max-width: 767px)");
  const reduceMotion = useReducedMotion();

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
  const payloadRef = useRef(payload);

  useEffect(() => {
    onSavedRef.current = onSaved;
    onToastRef.current = onToast;
    payloadRef.current = payload;
  }, [onSaved, onToast, payload]);

  const save = useCallback(
    (quiet = false): Promise<Entry | undefined> => {
      if (conflictRef.current) {
        if (!quiet) {
          onToastRef.current("这份本地修改存在版本冲突，请返回后重新打开条目");
        }
        return Promise.resolve(undefined);
      }
      const snapshot = payloadRef.current;
      if (!snapshot.title.trim() && !snapshot.body.trim()) {
        return Promise.resolve(undefined);
      }

      const task = saveQueueRef.current.then(async () => {
        const persistedEntryId = entryIdRef.current;
        const requestPayload: EntryInput = {
          ...snapshot,
          version: versionRef.current,
        };
        setSyncState(online ? "saving" : "offline");

        if (!online) {
          await saveOfflineDraft({
            key: persistedEntryId
              ? `entry:${persistedEntryId}`
              : offlineKeyRef.current,
            entryId: persistedEntryId,
            payload: requestPayload,
            savedAt: new Date().toISOString(),
          });
          if (!quiet) onToastRef.current("已保存到本机，联网后会自动同步");
          return undefined;
        }

        try {
          const result = await api<{ entry: Entry }>(
            persistedEntryId
              ? `/api/entries/${persistedEntryId}`
              : "/api/entries",
            {
              method: persistedEntryId ? "PATCH" : "POST",
              body: JSON.stringify(requestPayload),
            },
          );
          entryIdRef.current = result.entry.id;
          versionRef.current = result.entry.version;
          offlineKeyRef.current = `entry:${result.entry.id}`;
          setEntryId(result.entry.id);
          setDraft((current) => ({
            ...current,
            version: result.entry.version,
          }));
          conflictRef.current = false;
          setSyncState("saved");
          onSavedRef.current(result.entry);
          if (!quiet) onToastRef.current("已保存");
          return result.entry;
        } catch (error) {
          const typed = error as Error & { status?: number };
          if (typed.status === 409) {
            conflictRef.current = true;
            setSyncState("conflict");
            await saveOfflineDraft({
              key: `conflict:${persistedEntryId ?? "new"}:${Date.now()}`,
              entryId: persistedEntryId,
              payload: requestPayload,
              savedAt: new Date().toISOString(),
            });
            onToastRef.current("检测到版本冲突，本地修改已保留");
          } else {
            setSyncState("error");
            await saveOfflineDraft({
              key: persistedEntryId
                ? `entry:${persistedEntryId}`
                : offlineKeyRef.current,
              entryId: persistedEntryId,
              payload: requestPayload,
              savedAt: new Date().toISOString(),
            }).catch(() => undefined);
            if (!quiet) onToastRef.current(typed.message);
          }
          return undefined;
        }
      });

      saveQueueRef.current = task.then(
        () => undefined,
        () => undefined,
      );
      return task;
    },
    [online],
  );

  useEffect(() => {
    window.clearTimeout(saveTimer.current);
    if (!editing) return;
    if (!payload.title.trim() && !payload.body.trim()) return;
    saveTimer.current = window.setTimeout(() => void save(true), 1400);
    return () => window.clearTimeout(saveTimer.current);
  }, [
    payload.title,
    payload.body,
    payload.designTheme,
    payload.favorite,
    tagText,
    editing,
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
    let targetId = entryIdRef.current;
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
    let targetId = entryIdRef.current;
    if (!targetId) targetId = (await save())?.id;
    if (!targetId) return;
    const result = await api<{ path: string }>("/api/shares", {
      method: "POST",
      body: JSON.stringify({ entryId: targetId }),
    });
    setSharePath(`${location.origin}${result.path}`);
    setShareDialog(true);
  };

  const copyShareLink = async () => {
    let targetId = entryIdRef.current;
    if (!targetId) {
      targetId = (await save(true))?.id;
    }
    if (!targetId) return;
    const result = await api<{ path: string }>("/api/shares", {
      method: "POST",
      body: JSON.stringify({ entryId: targetId }),
    });
    const url = `${location.origin}${result.path}`;
    await navigator.clipboard.writeText(url);
    onToast("只读分享链接已复制");
  };

  const regenerateShare = async () => {
    const targetId = entryIdRef.current;
    if (!targetId) return;
    await api(`/api/shares?entryId=${targetId}`, { method: "DELETE" });
    const result = await api<{ path: string }>("/api/shares", {
      method: "POST",
      body: JSON.stringify({ entryId: targetId }),
    });
    setSharePath(`${location.origin}${result.path}`);
    onToast("已生成新的分享链接，旧链接已失效");
  };

  if (!editing && entryId) {
    return (
      <div className="page editor-page detail-page">
        <header className="editor-header">
          <button className="back-button" onClick={onBack} aria-label="返回资料库">
            <ChevronLeft size={22} />
          </button>
          <div className="detail-type-pill">
            {draft.type === "idea" ? <><Lightbulb size={14} /> 灵感</> : <><Gamepad2 size={14} /> 游戏复盘</>}
          </div>
          <div className="editor-actions">
            <button className="secondary-button" onClick={() => void copyShareLink()}>
              <Share2 size={15} /> 分享
            </button>
            <button
              className="primary-button"
              onClick={() => {
                setEditing(true);
                onModeChange(true);
              }}
            >
              <Pencil size={15} />
              编辑
            </button>
          </div>
        </header>

        <article className="editor-canvas detail-canvas">
          <p className="entry-kicker">
            {draft.type === "idea" ? "设计灵感" : "游戏复盘"}
          </p>
          <h1 className="detail-title">{draft.title || "未命名灵感"}</h1>
          {draft.body && <p className="detail-lead">{draft.body}</p>}

          {(selectedGame || draft.designTheme || payload.tags?.length) && (
            <section className="metadata-panel detail-metadata" aria-label="分类信息">
              {selectedGame && (
                <div>
                  <small>关联游戏</small>
                  <strong>{selectedGame.name}</strong>
                </div>
              )}
              {draft.designTheme && (
                <div>
                  <small>设计主题</small>
                  <strong>{draft.designTheme}</strong>
                </div>
              )}
              {!!payload.tags?.length && (
                <div className="wide-field">
                  <small>标签</small>
                  <div className="detail-tags">
                    {payload.tags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {!!draft.sections?.filter((section) => section.content.trim()).length && (
            <section className="detail-sections">
              <div className="content-divider">
                <span>复盘笔记</span>
                <small>{draft.sections.filter((section) => section.content.trim()).length} 个部分</small>
              </div>
              {draft.sections
                .filter((section) => section.content.trim())
                .map((section, index) => (
                  <section className="detail-section" key={section.kind}>
                    <p>
                      <b>{String(index + 1).padStart(2, "0")}</b>
                      {sectionLabels[section.kind] ?? section.kind}
                    </p>
                    <div>{section.content}</div>
                  </section>
                ))}
            </section>
          )}

          {!!images.length && (
            <section className="image-section">
              <div className="content-divider">
                <span>图片资料</span>
                <small>{images.length} 张</small>
              </div>
              <div className="image-grid detail-images">
                {images.map((image) => (
                  <figure className="image-card" key={image.id}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image.url} alt={image.caption || image.fileName} />
                    {image.caption && <figcaption>{image.caption}</figcaption>}
                  </figure>
                ))}
              </div>
            </section>
          )}

          <footer className="detail-footer">
            <span className={`detail-status ${draft.status}`}>
              {draft.status === "complete" ? <><CircleCheck size={14} /> 已完成</> : <><FileText size={14} /> 草稿</>}
            </span>
            <small>最后更新于 {entry ? formatDate(entry.updatedAt) : "刚刚"}</small>
          </footer>
        </article>
      </div>
    );
  }

  return (
    <div className="page editor-page">
      <header className="editor-header">
        <button
          className="back-button"
          onClick={async () => {
            await save(true);
            onBack();
          }}
          aria-label="返回"
        >
          <ChevronLeft size={22} />
        </button>
        <div className="type-switch">
          <button
            className={draft.type === "idea" ? "selected" : ""}
            onClick={() => changeType("idea")}
          >
            <Lightbulb size={14} /> 灵感
          </button>
          <button
            className={draft.type === "review" ? "selected" : ""}
            onClick={() => changeType("review")}
          >
            <Gamepad2 size={14} /> 游戏复盘
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
            <Star size={18} fill={draft.favorite ? "currentColor" : "none"} />
          </button>
          <button className="secondary-button" onClick={createShare}>
            <Share2 size={15} /> 分享
          </button>
          <button
            className="primary-button"
            onClick={async () => {
              const saved = await save();
              if (saved) {
                setEditing(false);
                onModeChange(false);
              }
            }}
          >
            <Check size={16} /> 完成
          </button>
        </div>
      </header>

      <div className="editor-canvas">
        <p className="entry-kicker">
          {draft.type === "idea" ? "设计灵感" : "游戏复盘"}
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
          aria-expanded={advanced}
        >
          <span className="advanced-toggle-copy">
            <span className="advanced-toggle-icon">
              <SlidersHorizontal size={16} />
            </span>
            <span>
              <strong>分类信息</strong>
              <small>关联游戏、设计主题和标签</small>
            </span>
          </span>
          {advanced ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
        </button>
        {advanced && (
          <motion.section
            className="classification-panel"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", bounce: 0, duration: 0.28 }}
          >
            <button
              className="classification-row game-classification"
              onClick={() => setGameDialog(true)}
            >
              <span className="classification-icon">
                <Gamepad2 size={17} />
              </span>
              <span className="classification-copy">
                <small>关联游戏</small>
                <strong>{selectedGame?.name ?? "选择或创建游戏"}</strong>
              </span>
              <ChevronRight size={17} />
            </button>
            <div className="theme-classification">
              <div className="classification-heading">
                <span className="classification-icon">
                  <Palette size={17} />
                </span>
                <span className="classification-copy">
                  <small>设计主题</small>
                  <strong>{draft.designTheme || "未选择"}</strong>
                </span>
              </div>
              <div
                className="theme-options"
                role="group"
                aria-label="选择设计主题"
              >
                {designThemes.map((theme) => (
                  <button
                    type="button"
                    className={`theme-option ${
                      draft.designTheme === theme ? "selected" : ""
                    }`}
                    aria-pressed={draft.designTheme === theme}
                    key={theme}
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        designTheme:
                          current.designTheme === theme ? "" : theme,
                      }))
                    }
                  >
                    {theme}
                  </button>
                ))}
              </div>
            </div>
            <label className="classification-row tags-classification">
              <span className="classification-icon">
                <Tags size={17} />
              </span>
              <span className="classification-copy">
                <small>标签</small>
                <input
                  value={tagText}
                  onChange={(event) => setTagText(event.target.value)}
                  placeholder="探索，反馈，节奏"
                />
              </span>
            </label>
          </motion.section>
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
                      aria-label="向前移动图片"
                    >
                      <ChevronUp size={15} />
                    </button>
                    <button
                      onClick={() => moveImage(index, 1)}
                      disabled={index === images.length - 1}
                      aria-label="向后移动图片"
                    >
                      <ChevronDown size={15} />
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
                      <Trash2 size={14} /> 删除
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
                <span><ImagePlus size={19} /></span>
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
          <div className="status-control">
            <span>状态</span>
            <div className="status-slider" role="group" aria-label="条目状态">
              <button
                type="button"
                className={draft.status === "complete" ? "selected" : ""}
                aria-pressed={draft.status === "complete"}
                onClick={() =>
                  setDraft((current) => ({ ...current, status: "complete" }))
                }
              >
                {draft.status === "complete" && (
                  <motion.span
                    className="status-slider-thumb"
                    layoutId="entry-status-slider"
                    transition={
                      reduceMotion
                        ? { duration: 0.08 }
                        : { type: "spring", bounce: 0, duration: 0.34 }
                    }
                  />
                )}
                <span className="status-slider-label">
                  <CircleCheck size={14} />
                  已完成
                </span>
              </button>
              <button
                type="button"
                className={draft.status === "draft" ? "selected" : ""}
                aria-pressed={draft.status === "draft"}
                onClick={() =>
                  setDraft((current) => ({ ...current, status: "draft" }))
                }
              >
                {draft.status === "draft" && (
                  <motion.span
                    className="status-slider-thumb"
                    layoutId="entry-status-slider"
                    transition={
                      reduceMotion
                        ? { duration: 0.08 }
                        : { type: "spring", bounce: 0, duration: 0.34 }
                    }
                  />
                )}
                <span className="status-slider-label">
                  <FileText size={14} />
                  草稿
                </span>
              </button>
            </div>
          </div>
          {entryId && (
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
          <Dialog.Overlay asChild>
            <motion.div
              className="dialog-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            />
          </Dialog.Overlay>
          <Dialog.Content asChild>
            <motion.div
              className="dialog-content"
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: mobile ? 34 : 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", bounce: 0, duration: 0.34 }}
              drag={mobile && !reduceMotion ? "y" : false}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0.03, bottom: 0.55 }}
              onDragEnd={(_, info) => {
                if (info.offset.y + info.velocity.y * 0.16 > 120) {
                  setShareDialog(false);
                }
              }}
            >
            <div className="sheet-grabber" aria-hidden="true" />
            <Dialog.Title>只读分享链接</Dialog.Title>
            <Dialog.Description>
              拥有链接的人只能阅读这篇内容。再次打开分享会保持当前链接不变。
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
                className="secondary-button"
                onClick={() => void regenerateShare()}
              >
                重新生成链接
              </button>
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
            </motion.div>
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
  const [creating, setCreating] = useState(false);
  const mobile = useMediaQuery("(max-width: 767px)");
  const reduceMotion = useReducedMotion();
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
    const name = query.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      const result = await api<{ game: Game }>("/api/games", {
        method: "POST",
        body: JSON.stringify({ name, isManual: true }),
      });
      onSelect(result.game);
      setQuery("");
      onToast(`已创建并关联《${result.game.name}》`);
    } catch (error) {
      onToast((error as Error).message || "创建游戏档案失败");
    } finally {
      setCreating(false);
    }
  };
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay asChild>
          <motion.div
            className="dialog-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          />
        </Dialog.Overlay>
        <Dialog.Content asChild>
          <motion.div
            className="dialog-content game-dialog"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: mobile ? 42 : 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", bounce: 0, duration: 0.34 }}
            drag={mobile && !reduceMotion ? "y" : false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.03, bottom: 0.55 }}
            onDragEnd={(_, info) => {
              if (info.offset.y + info.velocity.y * 0.16 > 140) {
                onOpenChange(false);
              }
            }}
          >
          <div className="sheet-grabber" aria-hidden="true" />
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
            <button
              type="button"
              className="manual-game"
              onClick={() => void createManual()}
              disabled={creating}
            >
              {creating ? "正在创建…" : `创建“${query.trim()}”的手动档案`}
            </button>
          )}
          <Dialog.Close className="dialog-close" aria-label="关闭">
            <X size={17} />
          </Dialog.Close>
          </motion.div>
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
    options?: NavigateOptions,
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
          <p className="eyebrow">游戏档案</p>
          <h1>{game.name}</h1>
          <p>{[...game.genres, ...game.platforms].join(" · ")}</p>
          {game.developer && <span>{game.developer}</span>}
        </div>
      </header>
      <section className="section-block">
        <div className="section-heading">
          <h2>相关记录</h2>
          <button onClick={() => navigate("editor", { type: "idea" })}>
            <Plus size={15} /> 添加灵感
          </button>
        </div>
        <div className="entry-list">
          {entries.map((entry) => (
            <EntryRow
              key={entry.id}
              entry={entry}
              onOpen={() => navigate("detail", { entryId: entry.id })}
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
          <p className="eyebrow">偏好与数据</p>
          <h1>设置</h1>
          <p>让资料库更适合你的工作方式。</p>
        </div>
      </header>
      <section className="settings-group">
        <h2>外观</h2>
        <div className="settings-card">
          <div className="settings-leading">
            <span className="settings-icon"><SettingsIcon size={18} /></span>
            <span>
              <strong>显示模式</strong>
              <small>跟随系统，或固定使用亮色、深色</small>
            </span>
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
          <div className="settings-leading">
            <span className="settings-icon"><Download size={18} /></span>
            <span>
              <strong>导出完整资料库</strong>
              <small>
                包含 JSON、Markdown 与内容关系；当前共 {entries.length} 条记录
              </small>
            </span>
          </div>
          <button className="secondary-button" onClick={exportLibrary}>
            <Download size={15} /> 导出 ZIP
          </button>
        </div>
      </section>
      <section className="settings-group">
        <h2>账号</h2>
        <div className="settings-card">
          <div className="settings-leading">
            <span className="settings-icon"><Cloud size={18} /></span>
            <span>
              <strong>个人资料库</strong>
              <small>通过当前安全账户访问，所有写入均按用户隔离</small>
            </span>
          </div>
          <form action="/auth/signout" method="post">
            <button className="secondary-button" type="submit">
              <LogOut size={15} /> 退出登录
            </button>
          </form>
        </div>
      </section>
    </div>
  );
}

function setDocumentTheme(theme: "system" | "light" | "dark") {
  document.documentElement.dataset.theme = theme;
}
