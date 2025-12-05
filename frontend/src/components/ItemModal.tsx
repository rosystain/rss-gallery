import { Dialog, Transition } from '@headlessui/react';
import { Fragment, useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { FeedItem, CustomIntegration } from '../types';
import { getCustomIntegrationsAsync, executeIntegration, IntegrationIconComponent } from './IntegrationSettings';

// 复制成功提示的显示时间（毫秒）
const COPY_TOAST_DURATION = 2000;

// 图片信息类型
interface ImageInfo {
  src: string;
  alt: string;
}

// 图片画册查看器组件
interface ImageViewerProps {
  images: ImageInfo[];
  initialIndex: number;
  onClose: () => void;
}

function ImageViewer({ images, initialIndex, onClose }: ImageViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  
  const currentImage = images[currentIndex];
  const hasMultiple = images.length > 1;

  const goToPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  }, [images.length]);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  }, [images.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        goToPrev();
      } else if (e.key === 'ArrowRight') {
        goToNext();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, goToPrev, goToNext]);

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-black bg-opacity-90 flex items-center justify-center"
      onClick={onClose}
    >
      {/* 关闭按钮 */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="absolute top-4 right-4 text-white hover:text-gray-300 bg-black bg-opacity-50 rounded-full p-2 transition z-10"
      >
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* 上一张按钮 */}
      {hasMultiple && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            goToPrev();
          }}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 bg-black bg-opacity-50 hover:bg-opacity-70 rounded-full p-3 transition z-10"
        >
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* 下一张按钮 */}
      {hasMultiple && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            goToNext();
          }}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 bg-black bg-opacity-50 hover:bg-opacity-70 rounded-full p-3 transition z-10"
        >
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}
      
      {/* 图片 */}
      <img
        src={currentImage.src}
        alt={currentImage.alt}
        className="max-w-[90vw] max-h-[85vh] object-contain"
        onClick={(e) => e.stopPropagation()}
      />

      {/* 页码指示器 */}
      {hasMultiple && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black bg-opacity-50 px-4 py-2 rounded-full">
          <span className="text-white text-sm">
            {currentIndex + 1} / {images.length}
          </span>
        </div>
      )}
    </div>,
    document.body
  );
}

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
}

export default function ItemModal({ item, isOpen, onClose, onAddExecutionHistory, refreshIntegrationsTrigger }: ItemModalProps) {
  const [copied, setCopied] = useState(false);
  const [customIntegrations, setCustomIntegrations] = useState<CustomIntegration[]>([]);
  const [executingIntegration, setExecutingIntegration] = useState<string | null>(null);
  const [viewerState, setViewerState] = useState<{ images: ImageInfo[]; initialIndex: number } | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // 从内容中提取所有图片
  const extractImages = useCallback((): ImageInfo[] => {
    const contentEl = contentRef.current;
    if (!contentEl) return [];
    
    const images: ImageInfo[] = [];
    const imgElements = contentEl.querySelectorAll('img');
    
    imgElements.forEach((img) => {
      // 检查图片是否被链接包裹
      const parentLink = img.closest('a');
      const src = parentLink?.href || img.src;
      
      // 过滤掉太小的图片（可能是图标/emoji）
      if (src && !images.some(i => i.src === src)) {
        images.push({ src, alt: img.alt || '' });
      }
    });
    
    return images;
  }, []);

  // 处理内容区域的图片点击
  useEffect(() => {
    const contentEl = contentRef.current;
    if (!contentEl || !isOpen) return;

    const handleClick = (e: Event) => {
      const target = e.target as HTMLElement;
      let clickedImgSrc: string | null = null;
      
      // 检查点击的是否是图片
      if (target.tagName === 'IMG') {
        e.preventDefault();
        e.stopPropagation();
        const img = target as HTMLImageElement;
        const parentLink = img.closest('a');
        clickedImgSrc = parentLink?.href || img.src;
      }
      // 检查点击的是否是包含图片的链接
      else if (target.tagName === 'A') {
        const link = target as HTMLAnchorElement;
        const img = link.querySelector('img');
        if (img) {
          e.preventDefault();
          e.stopPropagation();
          clickedImgSrc = link.href || img.src;
        }
      }

      if (clickedImgSrc) {
        const allImages = extractImages();
        const initialIndex = allImages.findIndex(img => img.src === clickedImgSrc);
        setViewerState({
          images: allImages,
          initialIndex: initialIndex >= 0 ? initialIndex : 0
        });
      }
    };

    contentEl.addEventListener('click', handleClick);
    return () => contentEl.removeEventListener('click', handleClick);
  }, [isOpen, item, extractImages]);

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
                    ref={contentRef}
                    className="prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-dark-text mb-6 [&_img]:cursor-zoom-in"
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

      {/* 图片画册查看器 */}
      {viewerState && viewerState.images.length > 0 && (
        <ImageViewer
          images={viewerState.images}
          initialIndex={viewerState.initialIndex}
          onClose={() => setViewerState(null)}
        />
      )}
    </Transition>
  );
}
