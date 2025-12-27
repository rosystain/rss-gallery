import { Dialog, Transition } from '@headlessui/react';
import { Fragment, useState, useEffect, useCallback, useRef } from 'react';
import type { FeedItem, CustomIntegration, PresetIntegration } from '../types';
import { api } from '../services/api';
import { getCustomIntegrationsAsync, executeIntegration, IntegrationIconComponent, getPresetActions, executePresetAction, isHentaiAssistantFavoriteCompatible } from './IntegrationSettings';

// 复制成功提示的显示时间（毫秒）
const COPY_TOAST_DURATION = 2000;

interface ItemModalProps {
  item: FeedItem | null;
  isOpen: boolean;
  onClose: () => void;
  onItemUpdated?: (itemId: string, updates: Partial<FeedItem>) => void;
  onAddExecutionHistory?: (entry: {
    id: string;
    type: 'success' | 'error';
    integrationName: string;
    message: string;
    detail?: string;
    timestamp: Date;
  }) => void;
  refreshIntegrationsTrigger?: number;
}

export default function ItemModal({ item, isOpen, onClose, onItemUpdated, onAddExecutionHistory, refreshIntegrationsTrigger }: ItemModalProps) {
  const [copied, setCopied] = useState(false);
  const [customIntegrations, setCustomIntegrations] = useState<CustomIntegration[]>([]);
  const [presetActions, setPresetActions] = useState<PresetIntegration[]>([]);
  const [executingIntegration, setExecutingIntegration] = useState<string | null>(null);
  const [executingPreset, setExecutingPreset] = useState<string | null>(null);
  const [addingToFavorite, setAddingToFavorite] = useState(false);
  const [isFavoriting, setIsFavoriting] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  // 处理图片尺寸：给大图片添加全宽样式，小图片保持默认
  useEffect(() => {
    const contentEl = contentRef.current;
    if (!contentEl || !isOpen) return;

    const images = contentEl.querySelectorAll('img');

    images.forEach((img) => {
      // 等待图片加载完成
      const handleImageLoad = () => {
        // 获取图片的原始尺寸
        const naturalWidth = img.naturalWidth;

        // 如果图片原始宽度 >= 600px，认为是大图，应用全宽样式
        if (naturalWidth >= 600) {
          img.style.maxWidth = 'none';
          img.style.width = 'calc(100% + 48px)';
          img.style.marginLeft = '-24px';
          img.style.marginRight = '-24px';
        } else {
          // 小图片保持默认样式
          img.style.maxWidth = '100%';
          img.style.width = 'auto';
          img.style.marginLeft = '0';
          img.style.marginRight = '0';
        }
      };

      if (img.complete) {
        handleImageLoad();
      } else {
        img.addEventListener('load', handleImageLoad);
      }
    });
  }, [item, isOpen]);

  // 加载自定义集成列表
  const loadIntegrations = useCallback(async () => {
    try {
      const integrations = await getCustomIntegrationsAsync();
      setCustomIntegrations(integrations);
    } catch (err) {
      console.error('Failed to load integrations:', err);
    }
  }, []);

  useEffect(() => {
    loadIntegrations();
  }, [loadIntegrations, refreshIntegrationsTrigger]);

  // 加载预设集成 actions
  useEffect(() => {
    if (!item?.link) {
      setPresetActions([]);
      return;
    }

    // 从 API 获取预设集成配置
    const loadPresetActions = async () => {
      try {
        const presets = await api.getPresetIntegrations();
        const availableActions = getPresetActions(presets, item.link);
        setPresetActions(availableActions);
      } catch (err) {
        console.error('Failed to load preset actions:', err);
      }
    };

    loadPresetActions();
  }, [item?.link, refreshIntegrationsTrigger]);

  // 根据 item 所属 feed 的 enabledIntegrations 过滤集成列表
  const filteredIntegrations = (() => {
    const itemEnabledIntegrations = item?.feed?.enabledIntegrations;
    if (itemEnabledIntegrations === undefined || itemEnabledIntegrations === null || itemEnabledIntegrations.length === 0) {
      // 未设置或空数组表示不显示任何集成
      return [];
    }
    return customIntegrations.filter(integration => itemEnabledIntegrations.includes(integration.id));
  })();

  // 处理复制链接
  const handleCopyLink = useCallback(() => {
    if (item?.link) {
      navigator.clipboard.writeText(item.link).then(() => {
        setCopied(true);
        setTimeout(() => {
          setCopied(false);
        }, COPY_TOAST_DURATION);
      }).catch(err => {
        console.error('Failed to copy link:', err);
      });
    }
  }, [item?.link]);

  // 处理收藏切换
  const handleToggleFavorite = useCallback(async () => {
    if (!item) return;

    setIsFavoriting(true);

    // 乐观更新：立即更新UI
    const newFavoriteState = !item.isFavorite;
    onItemUpdated?.(item.id, { isFavorite: newFavoriteState });

    try {
      const result = await api.toggleFavorite(item.id);
      // API 返回的状态应该与我们的乐观更新一致
      if (result.success && result.is_favorite !== newFavoriteState) {
        // 如果不一致，使用服务器返回的状态
        onItemUpdated?.(item.id, { isFavorite: result.is_favorite });
      }
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
      // 失败时回滚
      onItemUpdated?.(item.id, { isFavorite: item.isFavorite });
    } finally {
      setIsFavoriting(false);
    }
  }, [item, onItemUpdated]);

  // 处理集成执行
  const handleExecuteIntegration = useCallback(async (integration: CustomIntegration) => {
    if (!item) return;

    setExecutingIntegration(integration.id);

    try {
      const result = await executeIntegration(integration, {
        url: item.link || '',
        title: item.title || '',
      });

      // 只有 Webhook 类型才记录历史
      if (integration.type === 'webhook') {
        const historyEntry = {
          id: `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          type: result.success ? 'success' as const : 'error' as const,
          integrationName: integration.name,
          message: result.success ? `${integration.name} 执行成功` : `${integration.name} 执行失败`,
          detail: result.success
            ? (result.response
              ? (typeof result.response === 'string'
                ? result.response
                : JSON.stringify(result.response, null, 2))
              : undefined)
            : result.message,
          timestamp: new Date(),
        };

        onAddExecutionHistory?.(historyEntry);
      }
    } catch (error) {
      if (integration.type === 'webhook') {
        const errorMessage = error instanceof Error ? error.message : '未知错误';
        const historyEntry = {
          id: `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          type: 'error' as const,
          integrationName: integration.name,
          message: `${integration.name} 执行失败`,
          detail: errorMessage,
          timestamp: new Date(),
        };

        onAddExecutionHistory?.(historyEntry);
      }
    }

    setTimeout(() => {
      setExecutingIntegration(null);
    }, 1000);
  }, [item, onAddExecutionHistory]);

  // 处理预设集成 action 执行
  const handleExecutePresetAction = useCallback(async (preset: PresetIntegration) => {
    if (!item) return;

    setExecutingPreset(preset.id);

    try {
      const result = await executePresetAction(preset, {
        url: item.link || '',
        title: item.title || '',
      });

      const historyEntry = {
        id: `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        type: result.success ? 'success' as const : 'error' as const,
        integrationName: preset.name || preset.id,
        message: result.success ? `${preset.name || preset.id} 执行成功` : `${preset.name || preset.id} 执行失败`,
        detail: result.success
          ? (result.response
            ? (typeof result.response === 'string'
              ? result.response
              : JSON.stringify(result.response, null, 2))
            : undefined)
          : result.message,
        timestamp: new Date(),
      };

      onAddExecutionHistory?.(historyEntry);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      const historyEntry = {
        id: `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        type: 'error' as const,
        integrationName: preset.name || preset.id,
        message: `${preset.name || preset.id} 执行失败`,
        detail: errorMessage,
        timestamp: new Date(),
      };

      onAddExecutionHistory?.(historyEntry);
    }

    setTimeout(() => {
      setExecutingPreset(null);
    }, 1000);
  }, [item, onAddExecutionHistory]);

  // 处理添加到收藏夹
  const handleAddToFavorite = useCallback(async (preset: PresetIntegration) => {
    if (!item) return;

    if (!preset.apiUrl || !preset.defaultFavcat) {
      alert('请先在设置中配置收藏夹');
      return;
    }

    setAddingToFavorite(true);

    try {
      const result = await api.addToHentaiAssistantFavorite(
        preset.apiUrl,
        item.link || '',
        preset.defaultFavcat,
        preset.defaultNote
      );

      const historyEntry = {
        id: `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        type: result.success ? 'success' as const : 'error' as const,
        integrationName: `${preset.name || preset.id} - 收藏`,
        message: result.success ? '添加到收藏夹成功' : '添加到收藏夹失败',
        detail: result.message,
        timestamp: new Date(),
      };

      onAddExecutionHistory?.(historyEntry);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      const historyEntry = {
        id: `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        type: 'error' as const,
        integrationName: `${preset.name || preset.id} - 收藏`,
        message: '添加到收藏夹失败',
        detail: errorMessage,
        timestamp: new Date(),
      };

      onAddExecutionHistory?.(historyEntry);
    }

    setTimeout(() => {
      setAddingToFavorite(false);
    }, 1000);
  }, [item, onAddExecutionHistory]);

  if (!item) return null;

  const categories = item.categories ? JSON.parse(item.categories) : [];

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose} static>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-75" aria-hidden="true" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full md:max-w-4xl lg:max-w-5xl xl:max-w-6xl h-screen md:h-[95vh] md:rounded-2xl transform overflow-hidden bg-white dark:bg-dark-card shadow-xl transition-all flex flex-col">
                {/* Close Button */}
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 z-10 text-gray-400 hover:text-gray-600 dark:hover:text-dark-text bg-white dark:bg-dark-hover rounded-full p-2 transition shadow-md"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto">
                  {/* Content with padding */}
                  <div className="px-6 pb-6">
                    {/* Title */}
                    <div className="pt-6 pb-4">
                      <Dialog.Title className="text-2xl font-bold text-gray-900 dark:text-dark-text">
                        {item.title}
                      </Dialog.Title>
                    </div>

                    {/* Meta Info */}
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-dark-text-secondary mb-6 pb-4 border-b border-gray-200 dark:border-dark-border">
                      {/* Left side: Author, Date, Feed */}
                      <div className="flex flex-wrap items-center gap-4 flex-1">
                        {item.author && (
                          <div className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                            </svg>
                            <span>{item.author}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                          </svg>
                          <span>{new Date(item.publishedAt).toLocaleDateString('zh-CN')}</span>
                        </div>
                        {item.feed && (
                          <div className="flex items-center gap-1">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
                            </svg>
                            <span>{item.feed.title}</span>
                          </div>
                        )}
                      </div>

                      {/* Right side: Share & Actions Toolbar */}
                      <div className="flex items-center gap-1">
                        {/* Preset Actions */}
                        {presetActions.map((preset) => (
                          <div key={preset.id} className="flex gap-1">
                            {/* 推送下载按钮 */}
                            <button
                              onClick={() => handleExecutePresetAction(preset)}
                              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-hover transition text-gray-500 dark:text-dark-text-secondary hover:text-gray-700 dark:hover:text-dark-text"
                              title={preset.id === 'hentai-assistant' ? '推送到 Hentai Assistant' : preset.name}
                            >
                              {executingPreset === preset.id ? (
                                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                              ) : preset.icon === 'hentai-assistant' ? (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                              ) : (
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                              )}
                            </button>

                            {/* 添加到收藏夹按钮（仅 Hentai Assistant 且配置了收藏夹且 URL 匹配 E-Hentai 域名） */}
                            {preset.id === 'hentai-assistant' && preset.defaultFavcat && item.link && isHentaiAssistantFavoriteCompatible(item.link) && (
                              <button
                                onClick={() => handleAddToFavorite(preset)}
                                className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-hover transition text-gray-500 dark:text-dark-text-secondary hover:text-gray-700 dark:hover:text-dark-text"
                                title="添加到 E-Hentai 收藏夹"
                              >
                                {addingToFavorite ? (
                                  <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                  </svg>
                                ) : (
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                                  </svg>
                                )}
                              </button>
                            )}
                          </div>
                        ))}

                        {/* Custom Integrations */}
                        {filteredIntegrations.map((integration) => (
                          <button
                            key={integration.id}
                            onClick={() => handleExecuteIntegration(integration)}
                            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-hover transition text-gray-500 dark:text-dark-text-secondary hover:text-gray-700 dark:hover:text-dark-text"
                            title={integration.name}
                          >
                            {executingIntegration === integration.id ? (
                              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                            ) : integration.icon ? (
                              <IntegrationIconComponent icon={integration.icon} className="w-5 h-5" />
                            ) : integration.type === 'url' ? (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            ) : (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            )}
                          </button>
                        ))}

                        {/* Favorite Button */}
                        <button
                          onClick={handleToggleFavorite}
                          disabled={isFavoriting}
                          title={item.isFavorite ? "取消收藏" : "收藏"}
                          className={`p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-hover transition-all text-gray-500 dark:text-dark-text-secondary hover:text-gray-700 dark:hover:text-dark-text ${isFavoriting ? 'scale-110' : ''
                            }`}
                        >
                          {isFavoriting ? (
                            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          ) : item.isFavorite ? (
                            <svg className="w-5 h-5 text-yellow-500 fill-yellow-500 transition-all duration-300 ease-out" fill="currentColor" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5 transition-all duration-300 ease-out" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                            </svg>
                          )}
                        </button>

                        {/* Copy Link Button */}
                        <button
                          onClick={handleCopyLink}
                          title="复制链接"
                          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-dark-hover transition text-gray-500 dark:text-dark-text-secondary hover:text-gray-700 dark:hover:text-dark-text"
                        >
                          {copied ? (
                            <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Categories */}
                    {categories.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-4">
                        {categories.map((cat: string, idx: number) => (
                          <span
                            key={idx}
                            className="px-3 py-1 bg-gray-100 dark:bg-dark-hover text-gray-700 dark:text-dark-text-secondary text-xs rounded-full"
                          >
                            {cat}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Content */}
                    <div
                      ref={contentRef}
                      className="prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-dark-text mb-6 [&_img]:h-auto [&_img]:object-contain"
                      dangerouslySetInnerHTML={{ __html: item.content || item.description || '' }}
                    />

                    {/* View Original Link */}
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-gray-700 dark:bg-dark-border text-white rounded-lg hover:bg-gray-800 dark:hover:bg-gray-600 transition"
                    >
                      <span>查看原文</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>

    </Transition>
  );
}
