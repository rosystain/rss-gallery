import { useEffect, useRef, useMemo } from 'react';
import Masonry from 'react-masonry-css';
import type { FeedItem } from '../types';

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
}

export default function ImageWall({ items, onItemClick, columnsCount = 5, onItemViewed, viewedItems }: ImageWallProps) {
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
            {item.thumbnailImage ? (
              <img
                src={item.thumbnailImage}
                alt={item.title}
                className="w-full h-auto max-h-[200%] object-contain group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
                style={{ display: 'block' }}
              />
            ) : item.coverImage ? (
              <img
                src={item.coverImage}
                alt={item.title}
                className="w-full h-auto max-h-[200%] object-contain group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
                style={{ display: 'block' }}
              />
            ) : (
              <div className="w-full aspect-[4/3] flex items-center justify-center bg-gradient-to-br from-blue-100 to-purple-100">
                <svg className="w-16 h-16 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                </svg>
              </div>
            )}
            
            {/* Hover Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
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
