/* eslint-disable no-console,@typescript-eslint/no-explicit-any */

'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import PageLayout from '@/components/PageLayout';

interface IptvSource {
  index: number;
  name: string;
}

interface IptvChannel {
  name: string;
  logo?: string;
  group?: string;
  url: string;
}

interface ChannelGroup {
  group: string;
  channels: IptvChannel[];
}

/** 轻量直播播放器：ArtPlayer + hls.js */
function LivePlayer({ url }: { url: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const artRef = useRef<any>(null);

  useEffect(() => {
    let mounted = true;
    let art: any = null;

    (async () => {      try {
        const [{ default: Artplayer }, { default: Hls }] = await Promise.all([
          import('artplayer'),
          import('hls.js'),
        ]);
        if (!mounted || !containerRef.current) return;

        art = new Artplayer({
          container: containerRef.current,
          url,
          type: 'm3u8',
          autoplay: true,
          muted: false,
          volume: 0.8,
          isLive: true,
          pip: true,
          autoSize: true,
          autoMini: false,
          screenshot: false,
          setting: true,
          flip: true,
          playbackRate: false,
          aspectRatio: false,
          fullscreen: true,
          fullscreenWeb: true,
          miniProgressBar: true,
          customType: {
            m3u8: function (video: HTMLVideoElement, src: string) {
              const videoAny = video as any;
              if (videoAny.hls) {
                videoAny.hls.destroy();
              }
              if (Hls.isSupported()) {
                const hls = new Hls({ enableWorker: true });
                hls.loadSource(src);
                hls.attachMedia(video);
                videoAny.hls = hls;
              } else if (
                video.canPlayType('application/vnd.apple.mpegurl')
              ) {
                video.src = src;
              }
            },
          },
        });
        artRef.current = art;
      } catch (err) {
        console.error('直播播放器初始化失败:', err);
      }
    })();

    return () => {
      mounted = false;
      if (artRef.current) {
        try {
          const videoAny = artRef.current.video as any;
          if (videoAny?.hls) videoAny.hls.destroy();
          artRef.current.destroy();
        } catch {
          /* 忽略销毁错误 */
        }
        artRef.current = null;
      }
    };
  }, [url]);

  return <div ref={containerRef} className='w-full aspect-video bg-black rounded-xl overflow-hidden' />;
}

function LivePageClient() {
  const [sources, setSources] = useState<IptvSource[]>([]);
  const [sourceIndex, setSourceIndex] = useState(0);
  const [groups, setGroups] = useState<ChannelGroup[]>([]);
  const [total, setTotal] = useState(0);
  const [activeGroup, setActiveGroup] = useState<string>('');
  const [activeChannel, setActiveChannel] = useState<IptvChannel | null>(null);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 加载订阅源列表
  useEffect(() => {
    fetch('/api/iptv/sources')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setSources(data);
      })
      .catch(() => setSources([]));
  }, []);

  // 加载频道列表
  const loadChannels = useCallback(async (idx: number) => {
    setLoading(true);
    setError('');
    setGroups([]);
    setActiveChannel(null);
    setActiveGroup('');
    try {
      const resp = await fetch(`/api/iptv/channels?source=${idx}`);
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || '加载失败');
      setGroups(data.groups || []);
      setTotal(data.total || 0);
      const firstGroup = (data.groups || [])[0];
      if (firstGroup) {
        setActiveGroup(firstGroup.group);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '频道列表加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (sources.length > 0) loadChannels(sourceIndex);
  }, [sources, sourceIndex, loadChannels]);

  const visibleChannels = useMemo(() => {
    const group = groups.find((g) => g.group === activeGroup);
    const list = group ? group.channels : [];
    const kw = keyword.trim().toLowerCase();
    if (!kw) return list;
    return list.filter((c) => c.name.toLowerCase().includes(kw));
  }, [groups, activeGroup, keyword]);

  // 切换订阅源时重置搜索
  const handleSourceChange = (idx: number) => {
    setSourceIndex(idx);
    setKeyword('');
  };

  return (
    <PageLayout activePath='/live'>
      <div className='px-4 sm:px-10 py-4 sm:py-8'>
        <div className='mb-4 sm:mb-6 flex flex-wrap items-center gap-3'>
          <h1 className='text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-200'>
            直播
          </h1>
          {sources.length > 1 && (
            <div className='flex gap-2 overflow-x-auto'>
              {sources.map((s) => (
                <button
                  key={s.index}
                  onClick={() => handleSourceChange(s.index)}
                  className={`px-3 py-1.5 text-sm rounded-full whitespace-nowrap transition-colors ${
                    s.index === sourceIndex
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-200/70 dark:bg-gray-700/60 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {sources.length === 0 && !loading && (
          <div className='text-center text-gray-500 py-16'>
            暂无可用的直播源，请前往管理面板 → 直播源配置添加
          </div>
        )}

        {error && (
          <div className='text-center text-red-500 py-8'>{error}</div>
        )}

        {(groups.length > 0 || loading) && (
          <div className='grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6'>
            {/* 播放器 */}
            <div className='lg:col-span-2'>
              {activeChannel ? (
                <div>
                  <LivePlayer
                    key={activeChannel.url}
                    url={activeChannel.url}
                  />
                  <div className='mt-3 flex items-center gap-2'>
                    <span className='inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'>
                      LIVE
                    </span>
                    <span className='text-base font-medium text-gray-800 dark:text-gray-200'>
                      {activeChannel.name}
                    </span>
                  </div>
                </div>
              ) : (
                <div className='w-full aspect-video bg-black rounded-xl flex items-center justify-center'>
                  <span className='text-gray-400 text-sm'>
                    {loading ? '频道加载中…' : '从右侧选择一个频道开始播放'}
                  </span>
                </div>
              )}
            </div>

            {/* 频道列表 */}
            <div className='bg-white/60 dark:bg-gray-800/40 rounded-2xl border border-gray-200/30 dark:border-gray-700/30 backdrop-blur-sm p-4 flex flex-col max-h-[70vh]'>
              <input
                type='text'
                placeholder='搜索频道…'
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className='mb-3 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100'
              />
              <div className='flex gap-2 overflow-x-auto pb-2 mb-2 scrollbar-hide'>
                {groups.map((g) => (
                  <button
                    key={g.group}
                    onClick={() => setActiveGroup(g.group)}
                    className={`px-3 py-1 text-xs rounded-full whitespace-nowrap transition-colors ${
                      g.group === activeGroup
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-200/70 dark:bg-gray-700/60 text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {g.group} ({g.channels.length})
                  </button>
                ))}
              </div>
              <div className='overflow-y-auto flex-1 -mx-1 px-1'>
                {loading ? (
                  <div className='text-center text-gray-500 py-8 text-sm'>
                    加载中…
                  </div>
                ) : visibleChannels.length === 0 ? (
                  <div className='text-center text-gray-500 py-8 text-sm'>
                    没有找到频道
                  </div>
                ) : (
                  visibleChannels.map((ch) => (
                    <button
                      key={`${ch.group}-${ch.name}-${ch.url}`}
                      onClick={() => setActiveChannel(ch)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors mb-1 ${
                        activeChannel?.url === ch.url
                          ? 'bg-green-600/15 text-green-700 dark:text-green-300 font-medium'
                          : 'hover:bg-gray-200/60 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {ch.logo ? (
                        <img
                          src={ch.logo}
                          alt=''
                          className='w-6 h-6 rounded object-contain bg-white shrink-0'
                          loading='lazy'
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display =
                              'none';
                          }}
                        />
                      ) : (
                        <span className='w-6 h-6 rounded bg-gray-300/60 dark:bg-gray-600/60 flex items-center justify-center text-[10px] shrink-0'>
                          {ch.name.slice(0, 1)}
                        </span>
                      )}
                      <span className='truncate'>{ch.name}</span>
                    </button>
                  ))
                )}
              </div>
              <div className='pt-2 text-xs text-gray-400'>
                共 {total} 个频道
              </div>
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
}

export default function LivePage() {
  return (
    <Suspense>
      <LivePageClient />
    </Suspense>
  );
}
