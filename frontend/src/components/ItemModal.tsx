import { Dialog, Transition } from '@headlessui/react';
import { Fragment, useState, useEffect, useCallback } from 'react';
import type { FeedItem, CustomIntegration } from '../types';
import { getCustomIntegrationsAsync, executeIntegration, IntegrationIconComponent } from './IntegrationSettings';

// 复制成功提示的显示时间（毫秒）
const COPY_TOAST_DURATION = 2000;

interface ItemModalProps {
  item: FeedItem | null;
  isOpen: boolean;
  onClose: () => void;
  onAddExecutionHistory?: (entry: {
    id: string;
    type: 'success' | 'error';
    integrationName: string;
    message: string;
    detail?: string;
    timestamp: Date;
  }) => void;
  refreshIntegrationsTrigger?: number;
  enabledIntegrations?: string[] | null;
}

export default function ItemModal({ item, isOpen, onClose, onAddExecutionHistory, refreshIntegrationsTrigger, enabledIntegrations }: ItemModalProps) {
  const [copied, setCopied] = useState(false);
  const [customIntegrations, setCustomIntegrations] = useState<CustomIntegration[]>([]);
  const [executingIntegration, setExecutingIntegration] = useState<string | null>(null);

  // 加载自定义扩展列表
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

  // 根据当前订阅的 enabledIntegrations 过滤扩展列表
  const filteredIntegrations = (() => {
    if (enabledIntegrations === null || enabledIntegrations === undefined) {
      return customIntegrations;
    }
    return customIntegrations.filter(integration => enabledIntegrations.includes(integration.id));
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

  // 处理扩展执行
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
    }, 500);
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
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-7xl mx-4 transform overflow-hidden rounded-2xl bg-white dark:bg-dark-card shadow-xl transition-all">
                {/* Content */}
                <div className="p-6 max-h-[80vh] overflow-y-auto">
                  {/* Close Button */}
                  <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-dark-text bg-white dark:bg-dark-hover rounded-full p-2 transition shadow-md"
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

                  {/* Title */}
                  <Dialog.Title className="text-2xl font-bold text-gray-900 dark:text-dark-text mb-4">
                    {item.title}
                  </Dialog.Title>

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
                    className="prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-dark-text mb-6"
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
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
