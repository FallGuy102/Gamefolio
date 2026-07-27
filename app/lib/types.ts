export type EntryType = "idea" | "review";
export type EntryStatus = "draft" | "complete";

export type ReviewSection = {
  id?: string;
  kind: string;
  label?: string;
  content: string;
  position: number;
};

export type EntryImage = {
  id: string;
  entryId: string;
  fileName: string;
  contentType: string;
  size: number;
  caption: string;
  position: number;
  url?: string;
};

export type Game = {
  id: string;
  igdbId?: number | null;
  name: string;
  coverUrl?: string | null;
  genres: string[];
  platforms: string[];
  developer?: string | null;
  isManual?: boolean;
};

export type Entry = {
  id: string;
  type: EntryType;
  title: string;
  body: string;
  gameId?: string | null;
  game?: Game | null;
  designTheme?: string | null;
  status: EntryStatus;
  favorite: boolean;
  version: number;
  tags: string[];
  sections: ReviewSection[];
  images: EntryImage[];
  createdAt: string;
  updatedAt: string;
};

export type EntryInput = Pick<Entry, "type" | "title" | "body" | "status" | "favorite"> & {
  gameId?: string | null;
  designTheme?: string | null;
  tags?: string[];
  sections?: ReviewSection[];
  version?: number;
};
