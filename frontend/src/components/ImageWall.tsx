import { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import Masonry from 'react-masonry-css';
import type { FeedItem, CustomIntegration } from '../types';
import { api } from '../services/api';
import { getCustomIntegrationsAsync, executeIntegration, IntegrationIconComponent } from './IntegrationSettings';

// 悬浮标记已读的延迟时间（毫秒）
const HOVER_READ_DELAY = 1500;

// 复制成功提示的显示时间（毫秒）
const COPY_TOAST_DURATION = 2000;

// 解码 HTML 实体
function decodeHtmlEntities(text: string): string {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
}

// 清理 HTML 内容：移除标签并解码实体
function stripHtml(html: string): string {
  const withoutTags = html.replace(/<[^>]*>/g, '');
  return decodeHtmlEntities(withoutTags);
}

// 解析分类字段（可能是JSON数组或逗号分隔的字符串）
function parseCategories(categories: string): string[] {
  if (!categories) return [];
  
  // 尝试解析为 JSON 数组
  try {
    const parsed = JSON.parse(categories);
    if (Array.isArray(parsed)) {
      return parsed.map(c => String(c).trim()).filter(Boolean);
    }
  } catch {
    // 不是 JSON，按逗号分隔处理
  }
  
  // 按逗号分隔处理
  return categories.split(',').map(c => c.trim()).filter(Boolean);
}

// 格式化相对时间
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) {
    return '刚刚';
  }
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes}分钟前`;
  }
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours}小时前`;
  }
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) {
    return '昨天';
  }
  if (diffInDays === 2) {
    return '前天';
  }
  if (diffInDays < 7) {
    return `${diffInDays}天前`;
  }
  
  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) {
    return `${diffInWeeks}周前`;
  }
  
  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    return `${diffInMonths}个月前`;
  }
  
  const diffInYears = Math.floor(diffInDays / 365);
  return `${diffInYears}年前`;
}

interface ImageWallProps {
  items: FeedItem[];
  onItemClick: (item: FeedItem) => void;
  columnsCount?: number;
  onItemViewed?: (itemId: string) => void; // 当卡片完整浏览后的回调
  viewedItems?: Set<string>; // 从外部传入的已浏览项目集合
  onItemUpdated?: (itemId: string, updates: Partial<FeedItem>) => void; // 当条目更新时的回调
  onItemHoverRead?: (itemId: string) => void; // 当鼠标悬浮足够长时间后的回调
  onAddExecutionHistory?: (entry: {
    id: string;
    type: 'success' | 'error';
    integrationName: string;
    message: string;
    detail?: string;
    timestamp: Date;
  }) => void; // 添加执行历史记录的回调
  refreshIntegrationsTrigger?: number; // 用于触发刷新集成列表
}

// 单个图片卡片组件，处理加载失败和重试逻辑
function ImageCard({ item, onRetry }: { item: FeedItem; onRetry: (itemId: string) => Promise<string | null> }) {
  const [imageState, setImageState] = useState<'loading' | 'loaded' | 'error' | 'retrying'>('loading');
  const [currentSrc, setCurrentSrc] = useState(item.thumbnailImage || item.coverImage);
  const [retryCount, setRetryCount] = useState(0);

  // 当 item 更新时重置状态
  useEffect(() => {
    const newSrc = item.thumbnailImage || item.coverImage;
    if (newSrc !== currentSrc) {
      setCurrentSrc(newSrc);
      setImageState('loading');
    }
  }, [item.thumbnailImage, item.coverImage]);

  const handleImageError = useCallback(() => {
    setImageState('error');
  }, []);

  const handleImageLoad = useCallback(() => {
    setImageState('loaded');
  }, []);

  const handleRetryClick = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation(); // 阻止触发卡片点击
    if (imageState === 'retrying' || retryCount >= 3) return;
    
    setImageState('retrying');
    setRetryCount(prev => prev + 1);
    
    try {
      const newThumbnail = await onRetry(item.id);
      if (newThumbnail) {
        setCurrentSrc(newThumbnail);
        setImageState('loading'); // 重新加载新图片
      } else {
        setImageState('error');
      }
    } catch {
      setImageState('error');
    }
  }, [imageState, retryCount, item.id, onRetry]);

  if (!currentSrc) {
    // 无图片 URL
    return (
      <div className="w-full aspect-[4/3] flex items-center justify-center bg-gradient-to-br from-blue-100 to-purple-100 dark:from-neutral-700 dark:to-neutral-800">
        <svg className="w-16 h-16 text-gray-400 dark:text-neutral-500" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
        </svg>
      </div>
    );
  }

  if (imageState === 'error') {
    // 加载失败，显示重试按钮
    return (
      <div 
        className="w-full aspect-[4/3] flex flex-col items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 dark:from-neutral-700 dark:to-neutral-800 cursor-pointer hover:from-gray-200 hover:to-gray-300 dark:hover:from-neutral-600 dark:hover:to-neutral-700 transition-colors"
        onClick={handleRetryClick}
      >
        <svg className="w-12 h-12 text-gray-400 dark:text-neutral-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        <span className="text-sm text-gray-500 dark:text-neutral-400">
          {retryCount >= 3 ? '重试次数已达上限' : '点击重新加载'}
        </span>
      </div>
    );
  }

  if (imageState === 'retrying') {
    // 重试中
    return (
      <div className="w-full aspect-[4/3] flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 dark:from-neutral-700 dark:to-neutral-800">
        <svg className="w-10 h-10 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span className="text-sm text-blue-500 dark:text-blue-400 mt-2">加载中...</span>
      </div>
    );
  }

  // 正常显示图片
  return (
    <img
      src={currentSrc}
      alt={item.title}
      className="w-full h-auto max-h-[200%] object-contain group-hover:scale-105 transition-transform duration-300"
      loading="lazy"
      style={{ display: 'block' }}
      onLoad={handleImageLoad}
      onError={handleImageError}
    />
  );
}

export default function ImageWall({ items, onItemClick, columnsCount = 5, onItemViewed, viewedItems, onItemUpdated, onItemHoverRead, onAddExecutionHistory, refreshIntegrationsTrigger }: ImageWallProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewedItemsRef = useRef<Set<string>>(viewedItems || new Set());
  const hoverTimerRef = useRef<Map<string, NodeJS.Timeout>>(new Map()); // 存储每个item的悬浮定时器
  const hoverReadItemsRef = useRef<Set<string>>(new Set()); // 已通过悬浮标记为已读的items
  const [copiedItemId, setCopiedItemId] = useState<string | null>(null); // 显示复制成功提示的item
  const [customIntegrations, setCustomIntegrations] = useState<CustomIntegration[]>([]); // 自定义扩展列表
  const [executingIntegration, setExecutingIntegration] = useState<string | null>(null); // 正在执行的扩展 ID
  const [favoritingItemId, setFavoritingItemId] = useState<string | null>(null); // 正在切换收藏状态的 item ID
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string; detail?: string } | null>(null); // Toast 通知
  const [toastExpanded, setToastExpanded] = useState(false); // Toast 是否展开
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null); // Toast 自动关闭定时器
  
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
  
  // 根据 item 的 feed 设置获取该 item 应该显示的集成列表
  const getItemIntegrations = useCallback((item: FeedItem): CustomIntegration[] => {
    // 获取该 item 所属 feed 的 enabledIntegrations
    const itemEnabledIntegrations = item.feed?.enabledIntegrations;
    
    if (itemEnabledIntegrations === undefined) {
      // feed 信息不完整，不显示任何集成
      return [];
    }
    if (itemEnabledIntegrations === null || itemEnabledIntegrations.length === 0) {
      // null 或空数组表示未启用任何集成
      return [];
    }
    // 过滤出启用的集成
    return customIntegrations.filter(integration => itemEnabledIntegrations.includes(integration.id));
  }, [customIntegrations]);
  
  // 生成稳定的 items ID 列表
  const itemIds = useMemo(() => items.map(item => item.id).join(','), [items]);

  // 同步外部 viewedItems
  useEffect(() => {
    if (viewedItems) {
      viewedItemsRef.current = viewedItems;
    }
  }, [viewedItems]);

  // 滚动追踪逻辑
  useEffect(() => {
    if (!onItemViewed) return;

    // 初始化保护期：500ms 内不检查
    let isInitializing = true;
    const initTimer = setTimeout(() => {
      isInitializing = false;
    }, 500);

    // 检查哪些卡片已被"看过"
    const checkViewedItems = () => {
      if (isInitializing) return;
      
      // 获取当前滚动位置（视口顶部相对于文档的位置）
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      // 水位线：视口顶部位置 + 一点缓冲（用户至少看过视口高度的 20%）
      const waterline = scrollTop + window.innerHeight * 0.2;
      
      // 检查所有卡片
      const cards = document.querySelectorAll('[data-item-id]');
      cards.forEach((card) => {
        const itemId = card.getAttribute('data-item-id');
        if (!itemId) return;
        
        // 已经标记过的跳过
        if (viewedItemsRef.current.has(itemId)) return;
        
        // 获取卡片位置（相对于文档）
        const rect = card.getBoundingClientRect();
        const cardBottom = rect.bottom + scrollTop; // 卡片底部相对于文档的位置
        
        // 如果卡片底部在水位线之上，说明用户已经滚过这张卡片
        if (cardBottom < waterline) {
          onItemViewed(itemId);
        }
      });
    };

    // 使用 throttle 的滚动监听（每 200ms 最多执行一次）
    let lastCheck = 0;
    const throttledCheck = () => {
      const now = Date.now();
      if (now - lastCheck >= 200) {
        lastCheck = now;
        checkViewedItems();
      }
    };

    // 监听滚动事件
    window.addEventListener('scroll', throttledCheck, { passive: true });
    
    // 组件挂载后也检查一次（处理页面已经滚动的情况）
    const mountCheck = setTimeout(() => {
      checkViewedItems();
    }, 600); // 等初始化保护期结束后再检查

    return () => {
      clearTimeout(initTimer);
      clearTimeout(mountCheck);
      window.removeEventListener('scroll', throttledCheck);
    };
  }, [itemIds, onItemViewed]);

  // 处理图片重试
  const handleImageRetry = useCallback(async (itemId: string): Promise<string | null> => {
    try {
      const result = await api.refreshItemImage(itemId);
      if (result.success && result.thumbnail_image) {
        // 通知父组件更新
        onItemUpdated?.(itemId, { thumbnailImage: result.thumbnail_image });
        return result.thumbnail_image;
      }
      return null;
    } catch (error) {
      console.error('Failed to refresh image:', error);
      return null;
    }
  }, [onItemUpdated]);

  // 处理鼠标悬浮开始
  const handleMouseEnter = useCallback((item: FeedItem) => {
    // 如果已经是已读状态或已通过悬浮标记过，跳过
    if (!item.isUnread || hoverReadItemsRef.current.has(item.id)) {
      return;
    }

    // 清除可能存在的旧定时器
    const existingTimer = hoverTimerRef.current.get(item.id);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // 设置新的定时器
    const timer = setTimeout(() => {
      hoverReadItemsRef.current.add(item.id);
      hoverTimerRef.current.delete(item.id);
      onItemHoverRead?.(item.id);
    }, HOVER_READ_DELAY);

    hoverTimerRef.current.set(item.id, timer);
  }, [onItemHoverRead]);

  // 处理鼠标悬浮结束
  const handleMouseLeave = useCallback((itemId: string) => {
    const timer = hoverTimerRef.current.get(itemId);
    if (timer) {
      clearTimeout(timer);
      hoverTimerRef.current.delete(itemId);
    }
  }, []);

  // 组件卸载时清除所有定时器
  useEffect(() => {
    return () => {
      hoverTimerRef.current.forEach(timer => clearTimeout(timer));
      hoverTimerRef.current.clear();
    };
  }, []);

  // 处理分享（复制链接）
  const handleShare = useCallback((e: React.MouseEvent, item: FeedItem) => {
    e.stopPropagation(); // 阻止触发卡片点击
    
    if (item.link) {
      navigator.clipboard.writeText(item.link).then(() => {
        setCopiedItemId(item.id);
        setTimeout(() => {
          setCopiedItemId(null);
        }, COPY_TOAST_DURATION);
      }).catch(err => {
        console.error('Failed to copy link:', err);
      });
    }
  }, []);

  // 处理收藏切换
  const handleToggleFavorite = useCallback(async (e: React.MouseEvent, item: FeedItem) => {
    e.stopPropagation(); // 阻止触发卡片点击
    
    setFavoritingItemId(item.id);
    
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
      setFavoritingItemId(null);
    }
  }, [onItemUpdated]);

  // 处理扩展执行
  const handleExecuteIntegration = useCallback(async (e: React.MouseEvent, item: FeedItem, integration: CustomIntegration) => {
    e.stopPropagation(); // 阻止触发卡片点击
    
    setExecutingIntegration(integration.id);
    
    // 清除之前的定时器
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    
    try {
      const result = await executeIntegration(integration, {
        url: item.link || '',
        title: item.title || '',
      });
      
      // 只有 Webhook 类型才记录历史和显示 toast
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
        
        // 通过回调添加到历史记录
        onAddExecutionHistory?.(historyEntry);
        
        setToast({ 
          type: historyEntry.type, 
          message: historyEntry.message,
          detail: historyEntry.detail
        });
        setToastExpanded(false);
        
        // 5秒后自动关闭（仅在未展开时）
        toastTimerRef.current = setTimeout(() => {
          setToast(prev => {
            // 只有在未展开时才自动关闭
            if (!toastExpanded) {
              return null;
            }
            return prev;
          });
        }, 5000);
      }
    } catch (error) {
      // 只有 Webhook 类型才记录错误历史和显示 toast
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
        
        // 通过回调添加到历史记录
        onAddExecutionHistory?.(historyEntry);
        
        setToast({ 
          type: 'error', 
          message: historyEntry.message,
          detail: errorMessage
        });
        setToastExpanded(false);
        
        toastTimerRef.current = setTimeout(() => {
          if (!toastExpanded) {
            setToast(null);
          }
        }, 5000);
      }
    }
    
    setTimeout(() => {
      setExecutingIntegration(null);
    }, 500);
  }, [toastExpanded, onAddExecutionHistory]);
  
  // 展开 Toast 时停止自动关闭
  const handleExpandToast = useCallback(() => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setToastExpanded(true);
  }, []);
  
  // 关闭 Toast
  const handleCloseToast = useCallback(() => {
    setToast(null);
    setToastExpanded(false);
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
  }, []);

  // 1: 1 column (largest), 5: 5 columns (medium/default), 10: 10 columns (smallest)
  const breakpointColumns = {
    default: columnsCount,
    1536: Math.max(1, columnsCount - 1),
    1280: Math.max(1, columnsCount - 1),
    1024: Math.max(1, columnsCount - 2),
    768: Math.max(1, columnsCount - 3),
    640: 1,
  };

  return (
    <div ref={containerRef}>
      {/* Toast 通知 */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 max-w-md">
          <div className={`rounded-lg shadow-lg overflow-hidden ${
            toast.type === 'success' 
              ? 'bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800' 
              : 'bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800'
          }`}>
            {/* 折叠状态 */}
            <div className="flex items-center gap-3 p-3">
              {toast.type === 'success' ? (
                <svg className="w-5 h-5 text-green-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              <span className={`text-sm font-medium flex-1 ${
                toast.type === 'success' 
                  ? 'text-green-800 dark:text-green-200' 
                  : 'text-red-800 dark:text-red-200'
              }`}>
                {toast.message}
              </span>
              <div className="flex items-center gap-1">
                {toast.detail && !toastExpanded && (
                  <button 
                    onClick={handleExpandToast}
                    className={`p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 ${
                      toast.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    }`}
                    title="查看详情"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                )}
                {toastExpanded && (
                  <button 
                    onClick={() => setToastExpanded(false)}
                    className={`p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 ${
                      toast.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    }`}
                    title="收起"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                )}
                <button 
                  onClick={handleCloseToast}
                  className={`p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 ${
                    toast.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  }`}
                  title="关闭"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* 展开的详情 */}
            {toastExpanded && toast.detail && (
              <div className={`border-t px-3 pb-3 ${
                toast.type === 'success'
                  ? 'border-green-200 dark:border-green-800'
                  : 'border-red-200 dark:border-red-800'
              }`}>
                <pre className={`mt-2 text-xs overflow-auto max-h-48 p-2 rounded whitespace-pre-wrap break-all ${
                  toast.type === 'success'
                    ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
                    : 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
                }`}>
                  {toast.detail}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
      
      <Masonry
        breakpointCols={breakpointColumns}
        className="flex -ml-4 w-auto"
        columnClassName="pl-4 bg-clip-padding"
      >
        {items.map((item) => (
          <div
            key={item.id}
            data-item-id={item.id}
            onClick={() => onItemClick(item)}
            onMouseEnter={() => handleMouseEnter(item)}
            onMouseLeave={() => handleMouseLeave(item.id)}
            className="mb-4 cursor-pointer group relative overflow-hidden rounded-lg shadow-md hover:shadow-xl transition-shadow bg-white dark:bg-dark-card"
          >
          {/* Image */}
          <div className="relative bg-gray-200 dark:bg-neutral-700 overflow-hidden">
            <ImageCard item={item} onRetry={handleImageRetry} />
            
            {/* Hover Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            
            {/* Hover Toolbar */}
            <div className="absolute bottom-0 right-0 left-0 flex justify-end gap-1 px-2 py-1.5 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
              {/* Custom Integrations */}
              {getItemIntegrations(item).map((integration) => (
                <button
                  key={integration.id}
                  onClick={(e) => handleExecuteIntegration(e, item, integration)}
                  className="p-1.5 hover:bg-white/20 text-white rounded-lg transition-colors"
                  title={integration.name}
                >
                  {executingIntegration === integration.id ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : integration.icon ? (
                    <IntegrationIconComponent icon={integration.icon} className="w-4 h-4" />
                  ) : integration.type === 'url' ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  )}
                </button>
              ))}
              
              {/* Favorite Button */}
              <button
                onClick={(e) => handleToggleFavorite(e, item)}
                disabled={favoritingItemId === item.id}
                className={`p-1.5 hover:bg-white/20 text-white rounded-lg transition-all ${
                  favoritingItemId === item.id ? 'scale-110' : ''
                }`}
                title={item.isFavorite ? "取消收藏" : "收藏"}
              >
                {favoritingItemId === item.id ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : item.isFavorite ? (
                  <svg className="w-4 h-4 text-yellow-400 fill-yellow-400 transition-all duration-300 ease-out" fill="currentColor" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 transition-all duration-300 ease-out" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                  </svg>
                )}
              </button>
              
              {/* Share Button */}
              <button
                onClick={(e) => handleShare(e, item)}
                className="p-1.5 hover:bg-white/20 text-white rounded-lg transition-colors"
                title="复制链接"
              >
                {copiedItemId === item.id ? (
                  <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-4">
            <h3 className={`font-semibold line-clamp-2 mb-2 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors ${
              item.isUnread ? 'text-gray-900 dark:text-dark-text' : 'text-[#afafaf] dark:text-neutral-500'
            }`}>
              {item.title}
            </h3>
            
            {/* Meta Info */}
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-dark-text-secondary">
              {item.feed && (
                <span className="flex items-center gap-1.5 min-w-0 flex-1">
                  {item.feed.favicon ? (
                    <img 
                      src={item.feed.favicon} 
                      alt="" 
                      className="w-3.5 h-3.5 flex-shrink-0 object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : (
                    <svg className="w-3.5 h-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
                    </svg>
                  )}
                  <span className="truncate">{item.feed.title}</span>
                </span>
              )}
              <span className="flex-shrink-0">•</span>
              <span className="flex-shrink-0">{formatRelativeTime(item.publishedAt)}</span>
            </div>

            {/* Description */}
            {item.description && (
              <p className="mt-2 text-sm text-gray-600 dark:text-dark-text-secondary line-clamp-2">
                {stripHtml(item.description)}
              </p>
            )}

            {/* Categories */}
            {item.categories && (() => {
              const cats = parseCategories(item.categories);
              return cats.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {cats.slice(0, 10).map((category, index) => (
                    <span
                      key={index}
                      className="inline-block px-2 py-0.5 text-xs bg-gray-100 dark:bg-dark-hover text-gray-600 dark:text-dark-text-secondary rounded-full hover:bg-gray-200 dark:hover:bg-dark-border transition-colors"
                    >
                      {category}
                    </span>
                  ))}
                </div>
              ) : null;
            })()}
          </div>
        </div>
      ))}
      </Masonry>
    </div>
  );
}
