/* eslint-disable no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';
import {
  fetchIptvChannels,
  getEffectiveIptvSources,
  groupChannels,
} from '@/lib/iptv';

export const runtime = 'edge';

/**
 * 获取指定订阅源的频道列表。
 * GET /api/iptv/channels?source=0
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sourceParam = searchParams.get('source') || '0';
  const sourceIndex = Number.parseInt(sourceParam, 10);

  if (Number.isNaN(sourceIndex) || sourceIndex < 0) {
    return NextResponse.json({ error: '参数错误' }, { status: 400 });
  }

  try {
    const config = await getConfig();
    const enabledSources = getEffectiveIptvSources(
      config.IptvSources
    ).filter((s) => !s.disabled);
    const source = enabledSources[sourceIndex];
    if (!source) {
      return NextResponse.json({ error: '订阅源不存在' }, { status: 404 });
    }

    const channels = await fetchIptvChannels(source.url);
    const groups = groupChannels(channels);

    return NextResponse.json(
      {
        source: source.name,
        total: channels.length,
        groups,
      },
      {
        headers: { 'Cache-Control': 'public, max-age=300' },
      }
    );
  } catch (error) {
    console.error('获取 IPTV 频道列表失败:', error);
    return NextResponse.json(
      { error: '获取频道列表失败', details: (error as Error).message },
      { status: 500 }
    );
  }
}
