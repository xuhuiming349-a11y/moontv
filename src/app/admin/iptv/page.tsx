/* eslint-disable no-console,@typescript-eslint/no-explicit-any */

'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useState } from 'react';

import PageLayout from '@/components/PageLayout';

interface IptvSource {
  name: string;
  url: string;
  disabled?: boolean;
  from: 'config' | 'custom';
}

function IptvManager({ refreshKey }: { refreshKey: number }) {
  const [sources, setSources] = useState<IptvSource[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSource, setNewSource] = useState({ name: '', url: '' });
  const [loading, setLoading] = useState(true);

  const fetchSources = useCallback(async () => {
    try {
      const resp = await fetch('/api/admin/iptv');
      if (!resp.ok) return;
      const data = await resp.json();
      if (Array.isArray(data)) setSources(data);
    } catch (err) {
      console.error('获取直播源失败:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSources();
  }, [fetchSources, refreshKey]);

  const callIptvApi = async (body: Record<string, any>) => {
    const resp = await fetch('/api/admin/iptv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const data = await resp.json().catch(() => ({}));
      throw new Error(data.error || `操作失败: ${resp.status}`);
    }
    await fetchSources();
  };

  const [errorMsg, setErrorMsg] = useState('');

  const handleAdd = async () => {
    if (!newSource.name.trim() || !newSource.url.trim()) return;
    try {
      await callIptvApi({
        action: 'add',
        name: newSource.name.trim(),
        url: newSource.url.trim(),
      });
      setNewSource({ name: '', url: '' });
      setShowAddForm(false);
      setErrorMsg('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '操作失败');
    }
  };

  const handleToggle = async (url: string, disabled?: boolean) => {
    try {
      await callIptvApi({ action: disabled ? 'enable' : 'disable', url });
      setErrorMsg('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '操作失败');
    }
  };

  const handleDelete = async (url: string) => {
    try {
      await callIptvApi({ action: 'delete', url });
      setErrorMsg('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '操作失败');
    }
  };

  return (
    <div className='space-y-4'>
      <div className='flex items-center justify-between'>
        <h4 className='text-sm font-medium text-gray-700 dark:text-gray-300'>
          直播源列表
          <span className='ml-2 text-xs text-gray-500 dark:text-gray-400'>
            （支持标准 M3U / M3U8 订阅地址）
          </span>
        </h4>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className='px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors'
        >
          {showAddForm ? '取消' : '添加直播源'}
        </button>
      </div>

      {errorMsg && (
        <div className='px-4 py-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg'>
          {errorMsg}
        </div>
      )}

      {showAddForm && (
        <div className='p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 space-y-4'>
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
            <input
              type='text'
              placeholder='名称（如：IPTV 中国）'
              value={newSource.name}
              onChange={(e) =>
                setNewSource((prev) => ({ ...prev, name: e.target.value }))
              }
              className='px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
            />
            <input
              type='text'
              placeholder='订阅地址（http(s)://…/*.m3u）'
              value={newSource.url}
              onChange={(e) =>
                setNewSource((prev) => ({ ...prev, url: e.target.value }))
              }
              className='px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
            />
          </div>
          <div className='flex justify-end'>
            <button
              onClick={handleAdd}
              disabled={!newSource.name.trim() || !newSource.url.trim()}
              className='w-full sm:w-auto px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg transition-colors'
            >
              添加
            </button>
          </div>
        </div>
      )}

      <div className='border border-gray-200 dark:border-gray-700 rounded-lg overflow-x-auto'>
        <table className='w-full text-sm'>
          <thead className='bg-gray-50 dark:bg-gray-900'>
            <tr>
              <th className='px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300'>
                名称
              </th>
              <th className='px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300'>
                订阅地址
              </th>
              <th className='px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300'>
                来源
              </th>
              <th className='px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300'>
                状态
              </th>
              <th className='px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300'>
                操作
              </th>
            </tr>
          </thead>
          <tbody>
            {sources.map((source) => (
              <tr
                key={source.url}
                className='border-t border-gray-200 dark:border-gray-700'
              >
                <td className='px-4 py-2 text-gray-900 dark:text-gray-100'>
                  {source.name}
                </td>
                <td className='px-4 py-2 text-gray-500 dark:text-gray-400 max-w-[16rem] truncate'>
                  {source.url}
                </td>
                <td className='px-4 py-2'>
                  <span
                    className={`px-2 py-0.5 rounded text-xs ${
                      source.from === 'config'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                        : 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                    }`}
                  >
                    {source.from === 'config' ? '配置文件' : '手动添加'}
                  </span>
                </td>
                <td className='px-4 py-2'>
                  <span
                    className={`px-2 py-0.5 rounded text-xs ${
                      source.disabled
                        ? 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                        : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                    }`}
                  >
                    {source.disabled ? '已停用' : '启用中'}
                  </span>
                </td>
                <td className='px-4 py-2 whitespace-nowrap'>
                  <button
                    onClick={() => handleToggle(source.url, source.disabled)}
                    className='mr-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 text-xs'
                  >
                    {source.disabled ? '启用' : '停用'}
                  </button>
                  {source.from !== 'config' && (
                    <button
                      onClick={() => handleDelete(source.url)}
                      className='text-red-600 hover:text-red-800 dark:text-red-400 text-xs'
                    >
                      删除
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!loading && sources.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className='px-4 py-8 text-center text-gray-500 dark:text-gray-400'
                >
                  暂无直播源，点击右上角添加
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {loading && (
        <div className='text-center text-gray-500 py-4 text-sm'>加载中…</div>
      )}
    </div>
  );
}

function AdminIptvPageClient() {
  const [role, setRole] = useState<'owner' | 'admin' | null>(null);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const resp = await fetch('/api/admin/config');
        if (!resp.ok) {
          setDenied(true);
          return;
        }
        const data = (await resp.json()) as { Role: 'owner' | 'admin' };
        if (data.Role !== 'owner' && data.Role !== 'admin') {
          setDenied(true);
          return;
        }
        setRole(data.Role);
      } catch {
        setDenied(true);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <PageLayout activePath='/admin/iptv'>
      <div className='px-4 sm:px-10 py-4 sm:py-8'>
        <div className='mb-6 flex items-center justify-between'>
          <div>
            <h1 className='text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-200'>
              直播源配置
            </h1>
            <p className='text-sm text-gray-600 dark:text-gray-400 mt-1'>
              管理 IPTV 订阅源，直播页会展示已启用的订阅源中的频道
            </p>
          </div>
          <Link
            href='/admin'
            className='px-3 py-1.5 text-sm rounded-lg bg-gray-200/70 dark:bg-gray-700/60 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors'
          >
            返回管理面板
          </Link>
        </div>

        {loading ? (
          <div className='text-center text-gray-500 py-16'>加载中…</div>
        ) : denied || !role ? (
          <div className='text-center text-gray-500 py-16'>
            无权限访问，请先以管理员身份登录
          </div>
        ) : (
          <div className='rounded-xl shadow-sm bg-white/80 backdrop-blur-md dark:bg-gray-800/50 dark:ring-1 dark:ring-gray-700 px-6 py-4'>
            <IptvManager refreshKey={0} />
          </div>
        )}
      </div>
    </PageLayout>
  );
}

export default function AdminIptvPage() {
  return (
    <Suspense>
      <AdminIptvPageClient />
    </Suspense>
  );
}
