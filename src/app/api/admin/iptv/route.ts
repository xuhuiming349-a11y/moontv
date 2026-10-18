/* eslint-disable @typescript-eslint/no-explicit-any,no-console */

import { NextRequest, NextResponse } from 'next/server';

import { getAuthInfoFromCookie } from '@/lib/auth';
import { getConfig, mergeIptvSources } from '@/lib/config';
import { getStorage } from '@/lib/db';
import { DEFAULT_IPTV_SOURCES, getEffectiveIptvSources } from '@/lib/iptv';
import { IStorage } from '@/lib/types';

export const runtime = 'edge';

// 支持的操作类型
type Action = 'add' | 'disable' | 'enable' | 'delete';

interface BaseBody {
  action?: Action;
}

export async function GET(request: NextRequest) {
  try {
    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const adminConfig = await getConfig();
    mergeIptvSources(adminConfig);
    // 返回生效列表（含从未配置时的内置默认源），仅展示不落库
    return NextResponse.json(getEffectiveIptvSources(adminConfig.IptvSources), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('获取 IPTV 订阅源失败:', error);
    return NextResponse.json(
      { error: '获取失败', details: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const storageType = process.env.NEXT_PUBLIC_STORAGE_TYPE || 'localstorage';
  if (storageType === 'localstorage') {
    return NextResponse.json(
      {
        error: '不支持本地存储进行管理员配置',
      },
      { status: 400 }
    );
  }

  try {
    const body = (await request.json()) as BaseBody & Record<string, any>;
    const { action } = body;

    const authInfo = getAuthInfoFromCookie(request);
    if (!authInfo || !authInfo.username) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const username = authInfo.username;

    // 基础校验
    const ACTIONS: Action[] = ['add', 'disable', 'enable', 'delete'];
    if (!username || !action || !ACTIONS.includes(action)) {
      return NextResponse.json({ error: '参数格式错误' }, { status: 400 });
    }

    // 获取配置与存储
    const adminConfig = await getConfig();
    const storage: IStorage | null = getStorage();

    // 权限与身份校验
    if (username !== process.env.USERNAME) {
      const userEntry = adminConfig.UserConfig.Users.find(
        (u) => u.username === username
      );
      if (!userEntry || userEntry.role !== 'admin' || userEntry.banned) {
        return NextResponse.json({ error: '权限不足' }, { status: 401 });
      }
    }

    if (!adminConfig.IptvSources) {
      adminConfig.IptvSources = [];
    }

    // 把内置默认源物化进配置（仅补充缺失项），使停用/启用等操作可作用于默认源
    for (const def of DEFAULT_IPTV_SOURCES) {
      if (!adminConfig.IptvSources.some((s) => s.url === def.url)) {
        adminConfig.IptvSources.push({ ...def });
      }
    }

    switch (action) {
      case 'add': {
        const { name, url } = body as { name?: string; url?: string };
        if (!name || !url) {
          return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
        }
        if (!/^https?:\/\//i.test(url)) {
          return NextResponse.json(
            { error: '订阅地址必须以 http(s):// 开头' },
            { status: 400 }
          );
        }
        if (adminConfig.IptvSources.some((s) => s.url === url)) {
          return NextResponse.json({ error: '该订阅源已存在' }, { status: 400 });
        }
        adminConfig.IptvSources.push({
          name,
          url,
          from: 'custom',
          disabled: false,
        });
        break;
      }
      case 'disable': {
        const { url } = body as { url?: string };
        if (!url)
          return NextResponse.json({ error: '缺少 url 参数' }, { status: 400 });
        const entry = adminConfig.IptvSources.find((s) => s.url === url);
        if (!entry)
          return NextResponse.json({ error: '订阅源不存在' }, { status: 404 });
        entry.disabled = true;
        break;
      }
      case 'enable': {
        const { url } = body as { url?: string };
        if (!url)
          return NextResponse.json({ error: '缺少 url 参数' }, { status: 400 });
        const entry = adminConfig.IptvSources.find((s) => s.url === url);
        if (!entry)
          return NextResponse.json({ error: '订阅源不存在' }, { status: 404 });
        entry.disabled = false;
        break;
      }
      case 'delete': {
        const { url } = body as { url?: string };
        if (!url)
          return NextResponse.json({ error: '缺少 url 参数' }, { status: 400 });
        const idx = adminConfig.IptvSources.findIndex((s) => s.url === url);
        if (idx === -1)
          return NextResponse.json({ error: '订阅源不存在' }, { status: 404 });
        const entry = adminConfig.IptvSources[idx];
        if (entry.from === 'config') {
          return NextResponse.json(
            { error: '该订阅源来自配置文件，不可删除（可停用）' },
            { status: 400 }
          );
        }
        adminConfig.IptvSources.splice(idx, 1);
        break;
      }
      default:
        return NextResponse.json({ error: '未知操作' }, { status: 400 });
    }

    // 持久化到存储
    if (storage && typeof (storage as any).setAdminConfig === 'function') {
      await (storage as any).setAdminConfig(adminConfig);
    }

    return NextResponse.json(
      { ok: true },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error) {
    console.error('IPTV 订阅源管理操作失败:', error);
    return NextResponse.json(
      {
        error: 'IPTV 订阅源管理操作失败',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
