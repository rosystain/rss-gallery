import { useEffect, useRef } from 'react';
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
  const fullyVisibleItemsRef = useRef<Set<string>>(new Set()); // 追踪当前完全可见的卡片
  const observerRef = useRef<IntersectionObserver | null>(null);

  // 使用外部的viewedItems，如果没有则使用内部的
  const viewedItemsRef = useRef<Set<string>>(viewedItems || new Set());
  useEffect(() => {
    if (viewedItems) {
      viewedItemsRef.current = viewedItems;
    }
  }, [viewedItems]);

  useEffect(() => {
    if (!onItemViewed) return;

    // 断开之前的观察器
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    // 清空之前的可见状态
    fullyVisibleItemsRef.current.clear();

    // 创建 Intersection Observer
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const itemId = entry.target.getAttribute('data-item-id');
          if (!itemId) return;

          // 卡片完全可见（95%以上）
          if (entry.isIntersecting && entry.intersectionRatio >= 0.95) {
            console.log('Item fully visible:', itemId);
            fullyVisibleItemsRef.current.add(itemId);
          }
          // 卡片离开视口
          else if (!entry.isIntersecting && fullyVisibleItemsRef.current.has(itemId)) {
            // 检查是从顶部还是底部离开
            // boundingClientRect.top < 0 表示从顶部离开
            // boundingClientRect.top > rootBounds.bottom 表示从底部离开
            const rect = entry.boundingClientRect;
            const isLeavingFromTop = rect.bottom < 0;
            
            console.log('Item leaving:', itemId, 'from top:', isLeavingFromTop, 'rect.bottom:', rect.bottom);
            
            // 只在从顶部离开时标记已读
            if (isLeavingFromTop) {
              fullyVisibleItemsRef.current.delete(itemId);
              
              if (!viewedItemsRef.current.has(itemId)) {
                console.log('Marking item as viewed:', itemId);
                onItemViewed(itemId);
              }
            }
          }
        });
      },
      {
        threshold: [0, 0.5, 0.95, 1], // 多个阈值，精确追踪可见度
        rootMargin: '0px', // 精确的视口边界
      }
    );

    // 观察所有卡片
    const cards = document.querySelectorAll('[data-item-id]');
    console.log('Observing', cards.length, 'cards');
    cards.forEach((card) => observerRef.current?.observe(card));

    return () => {
      observerRef.current?.disconnect();
    };
  }, [items, onItemViewed]);

  // 当切换 feed 时重置浏览记录
  useEffect(() => {
    viewedItemsRef.current.clear();
    fullyVisibleItemsRef.current.clear();
  }, [items.length > 0 ? items[0]?.feedId : null]);
  // 1: 1 column (largest), 5: 5 columns (medium/default), 10: 10 columns (smallest)
  const breakpointColumns = {
    default: columnsCount,
    1536: Math.max(1, columnsCount - 1), // 2xl: reduce by 1
    1280: Math.max(1, columnsCount - 1), // xl: reduce by 1
    1024: Math.max(1, columnsCount - 2), // lg: reduce by 2
    768: Math.max(1, columnsCount - 3),  // md: reduce by 3
    640: 1,                               // sm: always 1
  };

  return (
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
  );
}
