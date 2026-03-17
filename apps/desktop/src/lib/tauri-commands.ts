import { invoke } from '@tauri-apps/api/core';
import type {
  UnifiedMod,
  SearchModsParams,
  GetModDetailsParams,
  GetModVersionsParams,
  DownloadModParams,
  ModVersion,
} from '../types/tauri';

export async function searchMods(params: SearchModsParams): Promise<UnifiedMod[]> {
  return await invoke('search_mods', {
    query: params.query,
    source: params.source || 'modrinth',
    projectType: params.project_type,
    facets: params.facets,
    index: params.index,
    gameVersion: params.game_version,
    loader: params.loader,
    limit: params.limit || 20,
    offset: params.offset || 0,
  });
}

export async function getModDetails(params: GetModDetailsParams): Promise<UnifiedMod> {
  return await invoke('get_mod_details', {
    modId: params.mod_id,
    source: params.source,
  });
}

export async function getModVersions(params: GetModVersionsParams): Promise<ModVersion[]> {
  return await invoke('get_mod_versions', {
    modId: params.mod_id,
    source: params.source,
    loaders: params.loaders,
    gameVersions: params.game_versions,
  });
}

export async function downloadMod(params: DownloadModParams): Promise<string> {
  return await invoke('download_mod', {
    downloadUrl: params.download_url,
    filename: params.filename,
    destination: params.destination,
  });
}

// Minecraft Launcher Commands
export async function getMinecraftVersions(): Promise<string[]> {
  return await invoke('get_minecraft_versions');
}

export async function downloadMinecraftVersion(version: string): Promise<string> {
  return await invoke('download_minecraft_version', { version });
}

export async function launchMinecraft(
  version: string,
  username: string,
  uuid: string,
  accessToken: string
): Promise<string> {
  return await invoke('launch_minecraft', {
    version,
    username,
    uuid,
    accessToken,
  });
}

export async function getLimenConfig(): Promise<string> {
  return await invoke('get_limen_config');
}

export async function getAppVersion(): Promise<string> {
  return await invoke('get_app_version');
}

import { getSkinOverride } from './skinCache';

export async function fetchSkinTexture(uuid: string): Promise<string> {
  const override = getSkinOverride(uuid);
  if (override) return override;
  return await invoke('fetch_skin_texture', { uuid });
}

export async function detectSkinModel(uuid: string): Promise<'steve' | 'alex'> {
  return await invoke('detect_skin_model', { uuid });
}

export async function uploadSkinFromFile(
  accessToken: string,
  userUuid: string,
  filePath: string,
  model: 'steve' | 'alex'
): Promise<string> {
  const variant = model === 'alex' ? 'slim' : 'classic';
  return await invoke('upload_skin_from_file', {
    accessToken,
    userUuid,
    filePath,
    model: variant,
  });
}

export async function uploadSkin(
  accessToken: string,
  userUuid: string,
  sourceUuid: string,
  model: 'steve' | 'alex'
): Promise<string> {
  const variant = model === 'alex' ? 'slim' : 'classic';
  return await invoke('upload_skin', {
    accessToken,
    userUuid,
    sourceUuid,
    model: variant,
  });
}

export async function getCurrentSkinUrl(uuid: string): Promise<string | null> {
  return await invoke('get_current_skin_url', { uuid });
}

export async function readLocalSkinFile(filePath: string): Promise<string> {
  return await invoke('read_local_skin_file', { filePath });
}

// Microsoft Authentication Commands
export async function getMicrosoftLoginUrl(): Promise<string> {
  return await invoke('get_microsoft_login_url');
}

export async function openMicrosoftLogin(): Promise<void> {
  return await invoke('open_microsoft_login');
}

export async function authenticateMicrosoft(authCode: string): Promise<any> {
  return await invoke('authenticate_microsoft', { authCode });
}

export async function refreshMicrosoftToken(): Promise<any> {
  return await invoke('refresh_microsoft_token');
}

export async function getCurrentProfile(): Promise<any> {
  return await invoke('get_current_profile');
}

export async function checkAndRefreshToken(): Promise<any> {
  return await invoke('check_and_refresh_token');
}

export async function logout(): Promise<void> {
  return await invoke('logout');
}

// Mod Loader Commands
export async function getFabricVersions(): Promise<import('../types/tauri').LoaderVersion[]> {
  return await invoke('get_fabric_versions');
}

export async function getFabricVersionsForGame(gameVersion: string): Promise<import('../types/tauri').LoaderInfo[]> {
  return await invoke('get_fabric_versions_for_game', { gameVersion });
}

export async function getQuiltVersions(): Promise<import('../types/tauri').LoaderVersion[]> {
  return await invoke('get_quilt_versions');
}

export async function getQuiltVersionsForGame(gameVersion: string): Promise<import('../types/tauri').LoaderInfo[]> {
  return await invoke('get_quilt_versions_for_game', { gameVersion });
}

export async function getForgeVersions(gameVersion: string): Promise<string[]> {
  return await invoke('get_forge_versions', { gameVersion });
}

export async function getNeoforgeVersions(): Promise<string[]> {
  return await invoke('get_neoforge_versions');
}


// Fabric Loader Installation
export async function installFabricLoader(gameVersion: string, loaderVersion: string): Promise<string> {
  return await invoke('install_fabric_loader', { gameVersion, loaderVersion });
}

// Launch with Mod Loader
export async function launchWithLoader(
  gameVersion: string,
  loader: string,
  loaderVersion: string,
  username: string,
  uuid: string,
  accessToken: string,
  profileId?: string,
  profileName?: string
): Promise<string> {
  return await invoke('launch_with_loader', {
    gameVersion,
    loader,
    loaderVersion,
    username,
    uuid,
    accessToken,
    profileId,
    profileName,
  });
}


// Process tracking
export async function getCurrentSession(): Promise<any> {
  return await invoke('get_current_session');
}

export async function isGamePlaying(): Promise<boolean> {
  return await invoke('is_game_playing');
}

export async function getPlayDuration(): Promise<number | null> {
  return await invoke('get_play_duration');
}

export async function endGameSession(): Promise<void> {
  return await invoke('end_game_session');
}

export async function enableDiscordRpc(): Promise<void> {
  return await invoke('enable_discord_rpc');
}

export async function disableDiscordRpc(): Promise<void> {
  return await invoke('disable_discord_rpc');
}

export async function updateDiscordActivity(activityType: string, details?: string): Promise<void> {
  return await invoke('update_discord_activity', { activityType, details });
}

// Archive Commands
export async function archiveProfile(
  profileId: string,
  profileName: string,
  version: string,
  loader: string,
  loaderVersion: string,
  icon?: string
): Promise<string> {
  return await invoke('archive_profile', {
    profileId,
    profileName,
    version,
    loader,
    loaderVersion,
    icon,
  });
}

export async function exportProfileMrpack(
  profileId: string,
  profileName: string,
  version: string,
  loader: string,
  loaderVersion: string,
  exportPath: string,
  icon?: string
): Promise<string> {
  return await invoke('export_profile_mrpack', {
    profileId,
    profileName,
    version,
    loader,
    loaderVersion,
    exportPath,
    icon,
  });
}

export async function getArchivedProfiles(): Promise<any[]> {
  return await invoke('get_archived_profiles');
}

export async function restoreProfile(profileId: string): Promise<any> {
  return await invoke('restore_profile', { profileId });
}

export async function deleteArchivedProfile(profileId: string): Promise<void> {
  return await invoke('delete_archived_profile', { profileId });
}

export async function installModpack(
  modpackId: string,
  modpackName: string,
  profileId: string
): Promise<{ message: string; installed_mods: any[] }> {
  return await invoke('install_modpack', {
    modpackId,
    modpackName,
    profileId,
  });
}

export async function scanProfileMods(profileId: string): Promise<any[]> {
  return await invoke('scan_profile_mods', { profileId });
}


// Java Management Commands
export interface JavaInstallation {
  version: number;
  path: string;
  is_custom: boolean;
}

export async function getJavaInstallations(): Promise<JavaInstallation[]> {
  return await invoke('get_java_installations');
}

export async function setCustomJavaPath(version: number, path: string): Promise<void> {
  return await invoke('set_custom_java_path', { version, path });
}

export async function resetJavaPath(version: number): Promise<void> {
  return await invoke('reset_java_path', { version });
}

// App Settings Commands
export interface AppSettings {
  language: string;
  discord_rpc_enabled: boolean;
}

export interface MinecraftProfile {
  id: string;
  name: string;
  version: string;
  loader: string;
  loader_version: string;
  icon?: string;
  last_played?: number;
}

export interface CustomSkin {
  uuid: string;
  name: string;
  texture_data: string;
}

export async function getAppSettings(): Promise<AppSettings> {
  return await invoke('get_app_settings');
}

export async function saveAppSettings(settings: AppSettings): Promise<void> {
  return await invoke('save_app_settings', { settings });
}

export async function getMinecraftProfiles(): Promise<MinecraftProfile[]> {
  return await invoke('get_minecraft_profiles');
}

export async function saveMinecraftProfiles(profiles: MinecraftProfile[]): Promise<void> {
  return await invoke('save_minecraft_profiles', { profiles });
}

export async function getCustomSkins(): Promise<CustomSkin[]> {
  return await invoke('get_custom_skins');
}

export async function saveCustomSkins(skins: CustomSkin[]): Promise<void> {
  return await invoke('save_custom_skins', { skins });
}

export async function getProfileMods(profileId: string): Promise<any[]> {
  return await invoke('get_profile_mods', { profileId });
}

export async function saveProfileMods(profileId: string, mods: any[]): Promise<void> {
  return await invoke('save_profile_mods', { profileId, mods });
}

export async function removeMod(profileId: string, modId: string, filename: string): Promise<void> {
  return await invoke('remove_mod', { profileId, modId, filename });
}

export async function scanInstalledMods(profileId: string): Promise<any[]> {
  return await invoke('scan_installed_mods', { profileId });
}

export async function getSystemMemory(): Promise<number> {
  return await invoke('get_system_memory');
}

export async function getJavaMemory(): Promise<number> {
  return await invoke('get_java_memory');
}

export async function saveJavaMemory(memoryMb: number): Promise<void> {
  return await invoke('save_java_memory', { memoryMb });
}

// Update checker
export interface UpdateInfo {
  available: boolean;
  current_version: string;
  latest_version: string;
  download_url?: string;
  release_notes?: string;
}

export async function checkForUpdates(): Promise<UpdateInfo> {
  return await invoke('check_for_updates');
}

export async function downloadUpdate(downloadUrl: string): Promise<string> {
  return await invoke('download_update', { downloadUrl });
}
