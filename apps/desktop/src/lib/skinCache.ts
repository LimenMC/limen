const STORAGE_PREFIX = 'limen-skin-v2:';
const MAX_CACHE_SIZE = 200;
const MAX_CACHE_SIZE_BYTES = 10 * 1024 * 1024;

interface CacheEntry {
  data: string;
  lastAccess: number;
  size: number;
}

class LRUSkinCache {
  private cache = new Map<string, CacheEntry>();
  private totalSize = 0;

  get(key: string): string | null {
    const entry = this.cache.get(key);
    if (entry) {
      entry.lastAccess = Date.now();
      return entry.data;
    }
    return null;
  }

  set(key: string, data: string): void {
    const size = data.length * 2;
    
    while (
      (this.totalSize + size > MAX_CACHE_SIZE_BYTES || this.cache.size >= MAX_CACHE_SIZE) &&
      this.cache.size > 0
    ) {
      this.evictLRU();
    }
    
    const existing = this.cache.get(key);
    if (existing) {
      this.totalSize -= existing.size;
      this.cache.delete(key);
    }
    
    this.cache.set(key, {
      data,
      lastAccess: Date.now(),
      size,
    });
    this.totalSize += size;
  }

  delete(key: string): void {
    const entry = this.cache.get(key);
    if (entry) {
      this.totalSize -= entry.size;
      this.cache.delete(key);
    }
  }

  clear(): void {
    this.cache.clear();
    this.totalSize = 0;
  }

  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccess < oldestTime) {
        oldestTime = entry.lastAccess;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.delete(oldestKey);
    }
  }
}

const memoryCache = new LRUSkinCache();

try {
    const allKeys = Object.keys(localStorage);
    allKeys.forEach(k => {
        if (k.startsWith('limen-skin:') && !k.startsWith('limen-skin-v')) {
            localStorage.removeItem(k);
        }
    });
} catch {}

export function getCachedSkin(key: string): string | null {
    const mem = memoryCache.get(key);
    if (mem) return mem;

    try {
        const stored = localStorage.getItem(`${STORAGE_PREFIX}${key}`);
        if (stored) {
            memoryCache.set(key, stored);
            return stored;
        }
    } catch {}

    return null;
}

export function setSkinOverride(uuid: string, base64: string): void {
    const overrideKey = `override:${uuid}`;
    memoryCache.set(overrideKey, base64);
    try {
        localStorage.setItem(`${STORAGE_PREFIX}${overrideKey}`, base64);
    } catch {}
}

export function getSkinOverride(uuid: string): string | null {
    const overrideKey = `override:${uuid}`;
    const mem = memoryCache.get(overrideKey);
    if (mem) return mem;

    try {
        const stored = localStorage.getItem(`${STORAGE_PREFIX}${overrideKey}`);
        if (stored) {
            memoryCache.set(overrideKey, stored);
            return stored;
        }
    } catch {}

    return null;
}

export function setCachedSkin(key: string, dataUrl: string): void {
    memoryCache.set(key, dataUrl);
    try {
        localStorage.setItem(`${STORAGE_PREFIX}${key}`, dataUrl);
    } catch {}
}

export function invalidateSkin(uuid: string): void {
    const keys = [`card:${uuid}`, `head:${uuid}`];
    keys.forEach(k => {
        memoryCache.delete(k);
        try { localStorage.removeItem(`${STORAGE_PREFIX}${k}`); } catch {}
    });
}

export function invalidateAllSkins(): void {
    memoryCache.clear();
    try {
        const allKeys = Object.keys(localStorage);
        allKeys.forEach(k => {
            if (k.startsWith(STORAGE_PREFIX)) {
                localStorage.removeItem(k);
            }
        });
    } catch {}
}
