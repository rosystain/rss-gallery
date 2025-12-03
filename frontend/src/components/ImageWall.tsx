import { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import Masonry from 'react-masonry-css';
import type { FeedItem } from '../types';
import { api } from '../services/api';

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
      <div className="w-full aspect-[4/3] flex items-center justify-center bg-gradient-to-br from-blue-100 to-purple-100">
        <svg className="w-16 h-16 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
        </svg>
      </div>
    );
  }

  if (imageState === 'error') {
    // 加载失败，显示重试按钮
    return (
      <div 
        className="w-full aspect-[4/3] flex flex-col items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 cursor-pointer hover:from-gray-200 hover:to-gray-300 transition-colors"
        onClick={handleRetryClick}
      >
        <svg className="w-12 h-12 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        <span className="text-sm text-gray-500">
          {retryCount >= 3 ? '重试次数已达上限' : '点击重新加载'}
        </span>
      </div>
    );
  }

  if (imageState === 'retrying') {
    // 重试中
    return (
      <div className="w-full aspect-[4/3] flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
        <svg className="w-10 h-10 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span className="text-sm text-blue-500 mt-2">加载中...</span>
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

export default function ImageWall({ items, onItemClick, columnsCount = 5, onItemViewed, viewedItems, onItemUpdated }: ImageWallProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewedItemsRef = useRef<Set<string>>(viewedItems || new Set());
  
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
            className="mb-4 cursor-pointer group relative overflow-hidden rounded-lg shadow-md hover:shadow-xl transition-shadow bg-white"
          >
          {/* Image */}
          <div className="relative bg-gray-200 overflow-hidden">
            <ImageCard item={item} onRetry={handleImageRetry} />
            
            {/* Hover Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
          </div>

          {/* Content */}
          <div className="p-4">
            <h3 className={`font-semibold line-clamp-2 mb-2 group-hover:text-blue-600 transition-colors ${
              item.isUnread ? 'text-gray-900' : 'text-[#afafaf]'
            }`}>
              {item.title}
            </h3>
            
            {/* Meta Info */}
            <div className="flex items-center gap-2 text-xs text-gray-500">
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
              <p className="mt-2 text-sm text-gray-600 line-clamp-2">
                {item.description.replace(/<[^>]*>/g, '')}
              </p>
            )}
          </div>
        </div>
      ))}
      </Masonry>
    </div>
  );
}
