/* IPTV 订阅源解析与缓存 */

export interface IptvChannel {
  name: string;
  logo?: string;
  group?: string;
  url: string;
}

export interface IptvSourceEntry {
  name: string;
  url: string;
  from: 'config' | 'custom';
  disabled?: boolean;
}

/**
 * 内置默认订阅源：当用户从未配置过任何直播源时生效，
 * 不依赖 config.json 合并逻辑，任何存储模式下都可用。
 */
export const DEFAULT_IPTV_SOURCES: IptvSourceEntry[] = [
  {
    name: 'IPTV-org 中国',
    url: 'https://iptv-org.github.io/iptv/countries/cn.m3u',
    from: 'config',
  },
];

/**
 * 计算实际生效的订阅源列表。
 * 用户配置过（哪怕全部停用）就尊重用户配置；从未配置过则用内置默认源。
 */
export function getEffectiveIptvSources(
  configured?: IptvSourceEntry[]
): IptvSourceEntry[] {
  if (configured && configured.length > 0) return configured;
  return DEFAULT_IPTV_SOURCES.map((s) => ({ ...s }));
}

/**
 * 解析 M3U / M3U8 播放列表文本，提取频道列表。
 * 支持 #EXTINF 行中的 tvg-logo / group-title 属性。
 */
export function parseM3U(text: string): IptvChannel[] {
  const channels: IptvChannel[] = [];
  const lines = text.split(/\r?\n/);

  let pending: { name: string; logo?: string; group?: string } | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith('#EXTINF')) {
      // #EXTINF:-1 tvg-logo="..." group-title="...",频道名
      const logoMatch = line.match(/tvg-logo="([^"]*)"/i);
      const groupMatch = line.match(/group-title="([^"]*)"/i);
      const commaIdx = line.lastIndexOf(',');
      const name =
        commaIdx >= 0 ? line.slice(commaIdx + 1).trim() : '未知频道';
      pending = {
        name: name || '未知频道',
        logo: logoMatch?.[1]?.trim() || undefined,
        group: groupMatch?.[1]?.trim() || undefined,
      };
    } else if (line.startsWith('#')) {
      // 其他注释行：若上一行是 EXTINF 但没有 URL，丢弃 pending
      continue;
    } else if (pending) {
      // URL 行（http/https）
      if (/^https?:\/\//i.test(line)) {
        channels.push({
          name: pending.name,
          logo: pending.logo,
          group: pending.group,
          url: line,
        });
      }
      pending = null;
    }
  }

  return channels;
}

// 内存缓存：订阅源 URL -> { 过期时间, 频道列表 }
const channelsCache = new Map<string, { expireAt: number; channels: IptvChannel[] }>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 分钟

/**
 * 拉取并解析 IPTV 订阅源，带 30 分钟内存缓存。
 */
export async function fetchIptvChannels(url: string): Promise<IptvChannel[]> {
  const now = Date.now();
  const cached = channelsCache.get(url);
  if (cached && cached.expireAt > now) {
    return cached.channels;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 20000);

  try {
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      },
    });
    if (!resp.ok) {
      throw new Error(`订阅源请求失败: HTTP ${resp.status}`);
    }
    const text = await resp.text();
    const channels = parseM3U(text);
    channelsCache.set(url, { expireAt: now + CACHE_TTL_MS, channels });
    return channels;
  } finally {
    clearTimeout(timeoutId);
  }
}

/** 按分组整理频道，保留原顺序 */
export function groupChannels(
  channels: IptvChannel[]
): { group: string; channels: IptvChannel[] }[] {
  const map = new Map<string, IptvChannel[]>();
  for (const ch of channels) {
    const g = ch.group || '未分组';
    if (!map.has(g)) map.set(g, []);
    map.get(g)!.push(ch);
  }
  return Array.from(map.entries()).map(([group, list]) => ({
    group,
    channels: list,
  }));
}
