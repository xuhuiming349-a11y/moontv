/* eslint-disable no-console */

import { NextResponse } from 'next/server';

import { getConfig } from '@/lib/config';
import { getEffectiveIptvSources } from '@/lib/iptv';

export const runtime = 'edge';

/**
 * 获取已启用的 IPTV 订阅源列表（仅返回名称，不暴露完整 URL）。
 */
export async function GET() {
  try {
    const config = await getConfig();
    const sources = getEffectiveIptvSources(config.IptvSources)
      .map((s, index) => ({
        index,
        name: s.name,
        disabled: !!s.disabled,
      }))
      .filter((s) => !s.disabled);

    return NextResponse.json(sources, {
      headers: { 'Cache-Control': 'public, max-age=300' },
    });
  } catch (error) {
    console.error('获取 IPTV 订阅源失败:', error);
    return NextResponse.json(
      { error: '获取 IPTV 订阅源失败' },
      { status: 500 }
    );
  }
}
