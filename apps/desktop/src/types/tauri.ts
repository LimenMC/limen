export interface GalleryImage {
  url: string;
  raw_url: string | null;
  featured: boolean;
  title: string | null;
  description: string | null;
  created: string;
  ordering: number;
}

export interface UnifiedMod {
  id: string;
  name: string;
  description: string;
  body: string | null;
  author: string;
  downloads: number;
  followers: number | null;
  icon_url: string | null;
  source: string;
  categories: string[];
  versions: string[];
  date_created: string;
  date_modified: string;
  gallery: GalleryImage[];
  game_versions: string[];
  loaders: string[];
  issues_url: string | null;
  source_url: string | null;
  wiki_url: string | null;
  discord_url: string | null;
  project_type?: string;
  players_online?: number;
  supported_versions?: string[];
  recommended_version?: string;
}

export interface SearchModsParams {
  query: string;
  source?: string;
  project_type?: string;
  facets?: string;
  index?: string;
  game_version?: string;
  loader?: string;
  limit?: number;
  offset?: number;
}

export interface GetModDetailsParams {
  mod_id: string;
  source: string;
}

export interface GetModVersionsParams {
  mod_id: string;
  source: string;
  loaders?: string[];
  game_versions?: string[];
}

export interface ModVersion {
  id: string;
  project_id: string;
  name: string;
  version_number: string;
  changelog: string | null;
  date_published: string;
  downloads: number;
  version_type: string;
  files: ModFile[];
  game_versions: string[];
  loaders: string[];
}

export interface ModFile {
  url: string;
  filename: string;
  primary: boolean;
  size: number;
  file_type: string | null;
}

export interface DownloadModParams {
  download_url: string;
  filename: string;
  destination: string;
}

export interface MinecraftVersion {
  id: string;
  type: string;
  releaseTime: string;
}

export interface LoaderVersion {
  version: string;
  stable: boolean;
}

export interface LoaderInfo {
  loader: LoaderVersion;
}
