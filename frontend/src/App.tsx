import { useState, useEffect, useRef } from 'react';
import { Menu } from '@headlessui/react';
import { api } from './services/api';
import type { FeedItem, Feed } from './types';
import ImageWall from './components/ImageWall';
import ItemModal from './components/ItemModal';

function App() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [selectedItem, setSelectedItem] = useState<FeedItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [selectedFeed, setSelectedFeed] = useState<string>('');
  const [newFeedUrl, setNewFeedUrl] = useState('');
  const [showAddFeed, setShowAddFeed] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    return saved === 'true';
  });
  const [imageWidth, setImageWidth] = useState(() => {
    const saved = localStorage.getItem('imageWidth');
    return saved ? parseInt(saved) : 5; // Default to medium (5 columns)
  });
  const [feedImageWidths, setFeedImageWidths] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('feedImageWidths');
    return saved ? JSON.parse(saved) : {};
  });
  const [showWidthSlider, setShowWidthSlider] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [editingFeed, setEditingFeed] = useState<Feed | null>(null);
  const [editFeedUrl, setEditFeedUrl] = useState('');
  const [editFeedTitle, setEditFeedTitle] = useState('');
  const [viewedItems, setViewedItems] = useState<Set<string>>(new Set()); // 追踪已浏览的 items
  const batchMarkTimerRef = useRef<NodeJS.Timeout | null>(null); // 批量标记定时器
  const [feedUnreadFilters, setFeedUnreadFilters] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('feedUnreadFilters');
    return saved ? JSON.parse(saved) : {};
  });
  const [autoLoadMore, setAutoLoadMore] = useState(() => {
    const saved = localStorage.getItem('autoLoadMore');
    return saved === 'true';
  });
  const [itemsPerPage, setItemsPerPage] = useState(() => {
    const saved = localStorage.getItem('itemsPerPage');
    return saved ? parseInt(saved) : 20;
  });
  const [sortBy, setSortBy] = useState<'published' | 'created'>(() => {
    const saved = localStorage.getItem('sortBy');
    return (saved as 'published' | 'created') || 'published';
  });
  const loadMoreButtonRef = useRef<HTMLDivElement>(null);

  // Save sidebar state to localStorage
  useEffect(() => {
    localStorage.setItem('sidebarCollapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  // Save auto load more preference to localStorage
  useEffect(() => {
    localStorage.setItem('autoLoadMore', String(autoLoadMore));
  }, [autoLoadMore]);

  // Save items per page preference to localStorage
  useEffect(() => {
    localStorage.setItem('itemsPerPage', String(itemsPerPage));
  }, [itemsPerPage]);

  // Save items per page preference to localStorage
  useEffect(() => {
    localStorage.setItem('itemsPerPage', String(itemsPerPage));
  }, [itemsPerPage]);

  // Save image width preference to localStorage
  useEffect(() => {
    localStorage.setItem('imageWidth', String(imageWidth));
  }, [imageWidth]);

  // Save feed-specific image widths to localStorage
  useEffect(() => {
    localStorage.setItem('feedImageWidths', JSON.stringify(feedImageWidths));
  }, [feedImageWidths]);

  // Save unread filter settings to localStorage
  useEffect(() => {
    localStorage.setItem('feedUnreadFilters', JSON.stringify(feedUnreadFilters));
  }, [feedUnreadFilters]);

  // Get current image width (feed-specific or global)
  const getCurrentImageWidth = () => {
    if (selectedFeed && feedImageWidths[selectedFeed] !== undefined) {
      return feedImageWidths[selectedFeed];
    }
    return imageWidth;
  };

  const setCurrentImageWidth = (width: number) => {
    if (selectedFeed) {
      setFeedImageWidths(prev => ({ ...prev, [selectedFeed]: width }));
    } else {
      setImageWidth(width);
    }
  };

  const resetFeedImageWidth = () => {
    if (selectedFeed && feedImageWidths[selectedFeed] !== undefined) {
      setFeedImageWidths(prev => {
        const newWidths = { ...prev };
        delete newWidths[selectedFeed];
        return newWidths;
      });
    }
  };

  // Get current unread filter (default to false if not set)
  const getCurrentUnreadFilter = () => {
    const viewKey = selectedFeed || 'all';
    return feedUnreadFilters[viewKey] ?? false;
  };

  const setCurrentUnreadFilter = (value: boolean) => {
    const viewKey = selectedFeed || 'all';
    setFeedUnreadFilters(prev => ({ ...prev, [viewKey]: value }));
    setPage(1); // 重置页码
  };

  // Load feeds
  useEffect(() => {
    loadFeeds();
  }, []);

  // Load items
  useEffect(() => {
    const fetchItems = async (silent = false) => {
      try {
        if (!silent) {
          setIsLoading(true);
        }
        
        const currentUnreadFilter = getCurrentUnreadFilter();
        const response = await api.getItems({
          page,
          limit: itemsPerPage,
          feedId: selectedFeed || undefined,
          unreadOnly: currentUnreadFilter,
          sortBy: sortBy,
        });
        
        if (page === 1) {
          setItems(response.items);
        } else {
          setItems(prev => [...prev, ...response.items]);
        }
        
        setHasMore(response.hasMore);
      } catch (error) {
        console.error('Failed to load items:', error);
      } finally {
        if (!silent) {
          setIsLoading(false);
        }
      }
    };

    fetchItems();
    
    // Auto refresh items every 30 seconds (silent mode to avoid flashing)
    const interval = setInterval(() => {
      fetchItems(true); // Silent refresh
    }, 30000);
    
    return () => clearInterval(interval);
  }, [page, selectedFeed, refreshKey, feedUnreadFilters, itemsPerPage, sortBy]);

  // 批量标记已浏览的 items 为已读
  const batchMarkItemsAsRead = (itemIds: string[]) => {
    if (itemIds.length === 0) return;

    console.log(`准备标记 ${itemIds.length} 个浏览过的项目`);

    // 直接标记这些浏览过的 items
    api.markItemsAsRead(itemIds)
      .then((result) => {
        console.log(`成功标记 ${result.marked_count} 个项目为已读`);
        // 更新本地状态
        setItems(prev => prev.map(item => 
          itemIds.includes(item.id) ? { ...item, isUnread: false } : item
        ));
        loadFeeds(); // 刷新未读计数
      })
      .catch(err => console.error('Failed to mark items as read:', err));
  };

  // 处理单个 item 被浏览完成
  const handleItemViewed = (itemId: string) => {
    setViewedItems(prev => {
      const newSet = new Set(prev);
      newSet.add(itemId);

      // 清除之前的定时器
      if (batchMarkTimerRef.current) {
        clearTimeout(batchMarkTimerRef.current);
      }

      // 延迟 2 秒批量标记，避免频繁 API 调用
      batchMarkTimerRef.current = setTimeout(() => {
        batchMarkItemsAsRead(Array.from(newSet));
        setViewedItems(new Set()); // 清空已标记的
      }, 2000);

      return newSet;
    });
  };

  // 切换 feed 时重置浏览记录
  useEffect(() => {
    setViewedItems(new Set());
    if (batchMarkTimerRef.current) {
      clearTimeout(batchMarkTimerRef.current);
    }
  }, [selectedFeed]);

  const loadFeeds = async () => {
    try {
      const data = await api.getFeeds();
      setFeeds(data);
    } catch (error) {
      console.error('Failed to load feeds:', error);
    }
  };

  const triggerRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleItemClick = (item: FeedItem) => {
    setSelectedItem(item);
    setIsModalOpen(true);
    
    // 点击查看时标记为已读（支持全部视图和单个feed视图）
    if (item.isUnread) {
      api.markItemAsRead(item.id)
        .then(() => {
          // 更新本地状态
          setItems(prev => prev.map(i => 
            i.id === item.id ? { ...i, isUnread: false } : i
          ));
          loadFeeds(); // 刷新未读计数
        })
        .catch(err => console.error('Failed to mark item as read:', err));
    }
  };

  const handleMarkAllAsRead = async () => {
    if (selectedFeed) {
      // 标记当前feed的所有项为已读
      try {
        await api.markAllFeedAsRead(selectedFeed);
        setItems(prev => prev.map(item => ({ ...item, isUnread: false })));
        await loadFeeds(); // 刷新未读计数
      } catch (error) {
        console.error('Failed to mark all as read:', error);
      }
    } else {
      // 标记所有feed的所有项为已读
      try {
        const unreadItemIds = items.filter(item => item.isUnread).map(item => item.id);
        if (unreadItemIds.length > 0) {
          await api.markItemsAsRead(unreadItemIds);
          setItems(prev => prev.map(item => ({ ...item, isUnread: false })));
          await loadFeeds(); // 刷新未读计数
        }
      } catch (error) {
        console.error('Failed to mark all as read:', error);
      }
    }
  };

  const handleAddFeed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFeedUrl) return;

    try {
      await api.createFeed(newFeedUrl);
      setNewFeedUrl('');
      setShowAddFeed(false);
      await loadFeeds();
      setPage(1);
      triggerRefresh();
      
      // Refresh items after 3 seconds to get processed images
      setTimeout(() => {
        triggerRefresh();
      }, 3000);
    } catch (error) {
      console.error('Failed to add feed:', error);
      alert('添加订阅失败，请检查URL是否正确');
    }
  };

  const handleFeedFilter = (feedId: string) => {
    setSelectedFeed(feedId);
    setPage(1);
  };

  const loadMore = () => {
    setPage(prev => prev + 1);
  };

  // Auto load more when button comes into view
  useEffect(() => {
    if (!autoLoadMore || !hasMore || isLoading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoading) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    const currentRef = loadMoreButtonRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [autoLoadMore, hasMore, isLoading, page]);

  const handleDeleteFeed = async (feedId: string, feedTitle: string) => {
    if (!confirm(`确定要删除订阅 "${feedTitle}" 吗？这将同时删除该订阅下的所有内容。`)) {
      return;
    }

    try {
      await api.deleteFeed(feedId);
      await loadFeeds();
      
      // If currently viewing this feed, reset to all
      if (selectedFeed === feedId) {
        setSelectedFeed('');
        setPage(1);
      } else {
        triggerRefresh();
      }
    } catch (error) {
      console.error('Failed to delete feed:', error);
      alert('删除订阅失败，请重试');
    }
  };

  const handleEditFeed = (feed: Feed) => {
    setEditingFeed(feed);
    setEditFeedUrl(feed.url);
    setEditFeedTitle(feed.title);
  };

  const handleUpdateFeed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFeed || !editFeedUrl || !editFeedTitle) return;

    try {
      await api.updateFeed(editingFeed.id, { title: editFeedTitle, url: editFeedUrl });
      setEditingFeed(null);
      setEditFeedUrl('');
      setEditFeedTitle('');
      await loadFeeds();
      triggerRefresh();
    } catch (error) {
      console.error('Failed to update feed:', error);
      alert('更新订阅失败，请检查URL是否正确');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Left Sidebar */}
      <aside className={`bg-white border-r border-gray-200 flex flex-col h-screen sticky top-0 transition-all duration-300 ${
        sidebarCollapsed ? 'w-16' : 'w-64'
      }`}>
        {/* Sidebar Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          {!sidebarCollapsed && <h1 className="text-lg font-semibold text-gray-900">RSS 图片墙</h1>}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-2 hover:bg-gray-100 rounded-lg transition ml-auto"
            title={sidebarCollapsed ? '展开侧边栏' : '折叠侧边栏'}
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {sidebarCollapsed ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              )}
            </svg>
          </button>
        </div>

        {/* Feed List */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-2">
            {/* All Items */}
            <button
              onClick={() => handleFeedFilter('')}
              className={`w-full text-left px-3 py-2 rounded-lg mb-1 transition flex items-center justify-between group ${
                selectedFeed === ''
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
              title={sidebarCollapsed ? '全部' : ''}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M3 12v3c0 1.657 3.134 3 7 3s7-1.343 7-3v-3c0 1.657-3.134 3-7 3s-7-1.343-7-3z" />
                  <path d="M3 7v3c0 1.657 3.134 3 7 3s7-1.343 7-3V7c0 1.657-3.134 3-7 3S3 8.657 3 7z" />
                  <path d="M17 5c0 1.657-3.134 3-7 3S3 6.657 3 5s3.134-3 7-3 7 1.343 7 3z" />
                </svg>
                {!sidebarCollapsed && <span className="font-medium">全部</span>}
              </div>
              {!sidebarCollapsed && (() => {
                const totalUnread = feeds.reduce((sum, f) => sum + (f.unreadCount || 0), 0);
                return totalUnread > 0 ? (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    selectedFeed === '' ? 'bg-blue-500' : 'bg-red-500 text-white'
                  }`}>
                    {totalUnread}
                  </span>
                ) : null;
              })()}
            </button>

            {/* Feed Items */}
            <div className="mt-4">
              {!sidebarCollapsed && (
                <div className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  订阅列表
                </div>
              )}
              {feeds.map((feed) => (
                <button
                  key={feed.id}
                  onClick={() => handleFeedFilter(feed.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg mb-1 transition flex items-center justify-between ${
                    selectedFeed === feed.id
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                  title={sidebarCollapsed ? feed.title : ''}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {feed.favicon ? (
                      <img 
                        src={feed.favicon} 
                        alt="" 
                        className="w-4 h-4 flex-shrink-0 object-contain"
                        onError={(e) => {
                          // 如果favicon加载失败，隐藏图片并显示默认图标
                          e.currentTarget.style.display = 'none';
                          const parent = e.currentTarget.parentElement;
                          if (parent) {
                            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                            svg.setAttribute('class', 'w-4 h-4 flex-shrink-0');
                            svg.setAttribute('fill', 'currentColor');
                            svg.setAttribute('viewBox', '0 0 20 20');
                            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                            path.setAttribute('d', 'M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z');
                            svg.appendChild(path);
                            parent.insertBefore(svg, e.currentTarget);
                          }
                        }}
                      />
                    ) : (
                      <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
                      </svg>
                    )}
                    {!sidebarCollapsed && <span className="truncate text-sm">{feed.title}</span>}
                  </div>
                  {!sidebarCollapsed && feed.unreadCount !== undefined && feed.unreadCount > 0 && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ml-2 flex-shrink-0 ${
                      selectedFeed === feed.id ? 'bg-blue-500' : 'bg-red-500 text-white'
                    }`}>
                      {feed.unreadCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Add Feed Button */}
        <div className="p-2 border-t border-gray-200">
          <button
            onClick={() => setShowAddFeed(!showAddFeed)}
            className={`w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2 ${
              sidebarCollapsed ? 'justify-center px-0' : 'justify-center px-4'
            }`}
            title={sidebarCollapsed ? '添加订阅' : ''}
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            {!sidebarCollapsed && <span>添加订阅</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {selectedFeed 
                  ? feeds.find(f => f.id === selectedFeed)?.title 
                  : '全部内容'
                }
              </h2>
              <span className="text-sm text-gray-500">
                {items.length} 项
              </span>
            </div>
            
            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              {/* Image Width Control */}
              <div className="relative">
                <button
                  onClick={() => setShowWidthSlider(!showWidthSlider)}
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                  title="调整图片大小"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </button>
                
                {showWidthSlider && (
                  <div className="absolute right-0 mt-2 p-4 bg-white rounded-lg shadow-lg border border-gray-200 z-50 min-w-[280px]">
                    {/* 图片大小 */}
                    <div className="mb-4">
                      <div className="text-xs font-medium text-gray-700 mb-2">图片大小</div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-xs text-gray-500 whitespace-nowrap">大</span>
                        <input
                          type="range"
                          min="1"
                          max="10"
                          value={getCurrentImageWidth()}
                          onChange={(e) => setCurrentImageWidth(parseInt(e.target.value))}
                          className="flex-1 h-1.5 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                        <span className="text-xs text-gray-500 whitespace-nowrap">小</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-600">{getCurrentImageWidth()} 列</span>
                          <span className="text-xs text-gray-400">
                            {selectedFeed ? (feedImageWidths[selectedFeed] !== undefined ? '当前订阅' : '跟随全局') : '全局默认'}
                          </span>
                        </div>
                        {selectedFeed && feedImageWidths[selectedFeed] !== undefined && (
                          <button
                            onClick={resetFeedImageWidth}
                            className="text-xs text-blue-600 hover:text-blue-700"
                            title="重置为全局设置"
                          >
                            重置
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 分隔线 */}
                    <div className="border-t border-gray-200 my-4"></div>

                    {/* 每页显示项目数 */}
                    <div className="mb-4">
                      <div className="text-xs font-medium text-gray-700 mb-2">每页显示</div>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          min="10"
                          max="100"
                          step="10"
                          value={itemsPerPage}
                          onChange={(e) => setItemsPerPage(Math.max(10, Math.min(100, parseInt(e.target.value) || 20)))}
                          className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-600">项</span>
                      </div>
                    </div>

                    {/* 分隔线 */}
                    <div className="border-t border-gray-200 my-4"></div>

                    {/* 排序方式 */}
                    <div className="mb-4">
                      <div className="text-xs font-medium text-gray-700 mb-2">排序方式</div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setSortBy('published')}
                          className={`flex-1 px-3 py-1.5 text-xs rounded transition ${
                            sortBy === 'published'
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          发布时间
                        </button>
                        <button
                          onClick={() => setSortBy('created')}
                          className={`flex-1 px-3 py-1.5 text-xs rounded transition ${
                            sortBy === 'created'
                              ? 'bg-blue-600 text-white'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          抓取时间
                        </button>
                      </div>
                    </div>

                    {/* 分隔线 */}
                    <div className="border-t border-gray-200 my-4"></div>

                    {/* 自动加载 */}
                    <div>
                      <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={autoLoadMore}
                          onChange={(e) => setAutoLoadMore(e.target.checked)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span>自动加载更多</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Unread Filter Button */}
              <button
                onClick={() => setCurrentUnreadFilter(!getCurrentUnreadFilter())}
                className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition"
                title={getCurrentUnreadFilter() ? '显示全部' : '仅显示未读'}
              >
                {getCurrentUnreadFilter() ? (
                  <svg className="w-[18px] h-[18px]" fill="currentColor" viewBox="0 0 20 20">
                    <circle cx="10" cy="10" r="7" />
                  </svg>
                ) : (
                  <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 20 20">
                    <circle cx="10" cy="10" r="7" />
                  </svg>
                )}
              </button>
              
              <button
                onClick={() => triggerRefresh()}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                title="刷新"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              
              <Menu as="div" className="relative">
                <Menu.Button
                  className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                  title="更多操作"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                  </svg>
                </Menu.Button>
                
                <Menu.Items className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 focus:outline-none">
                  <Menu.Item>
                    {({ active }) => {
                      const hasUnread = selectedFeed 
                        ? (feeds.find(f => f.id === selectedFeed)?.unreadCount || 0) > 0
                        : items.some(item => item.isUnread);
                      return (
                        <button
                          onClick={handleMarkAllAsRead}
                          disabled={!hasUnread}
                          className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 ${
                            active ? 'bg-gray-50 text-gray-900' : 'text-gray-700'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          标记全部已读
                        </button>
                      );
                    }}
                  </Menu.Item>
                  {selectedFeed && (
                    <>
                      <Menu.Item>
                        {({ active }) => {
                          const currentFeed = feeds.find(f => f.id === selectedFeed);
                          return (
                            <button
                              onClick={() => currentFeed && handleEditFeed(currentFeed)}
                              className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 ${
                                active ? 'bg-gray-50 text-gray-900' : 'text-gray-700'
                              }`}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              编辑订阅
                            </button>
                          );
                        }}
                      </Menu.Item>
                      <Menu.Item>
                        {({ active }) => {
                          const currentFeed = feeds.find(f => f.id === selectedFeed);
                          return (
                            <button
                              onClick={() => currentFeed && handleDeleteFeed(currentFeed.id, currentFeed.title)}
                              className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 ${
                                active ? 'bg-red-50 text-red-700' : 'text-red-600'
                              }`}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              删除当前订阅
                            </button>
                          );
                        }}
                      </Menu.Item>
                    </>
                  )}
                </Menu.Items>
              </Menu>
            </div>
          </div>
        </header>

        {/* Add Feed Modal/Form */}
        {showAddFeed && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAddFeed(false)}>
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold mb-4">添加新订阅</h3>
              <form onSubmit={handleAddFeed} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    RSS 订阅地址
                  </label>
                  <input
                    type="url"
                    value={newFeedUrl}
                    onChange={(e) => setNewFeedUrl(e.target.value)}
                    placeholder="https://example.com/feed.xml"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    autoFocus
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowAddFeed(false)}
                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    添加
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Feed Modal */}
        {editingFeed && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setEditingFeed(null)}>
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold mb-4">编辑订阅</h3>
              <form onSubmit={handleUpdateFeed} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    订阅名称
                  </label>
                  <input
                    type="text"
                    value={editFeedTitle}
                    onChange={(e) => setEditFeedTitle(e.target.value)}
                    placeholder="订阅名称"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    RSS链接
                  </label>
                  <input
                    type="url"
                    value={editFeedUrl}
                    onChange={(e) => setEditFeedUrl(e.target.value)}
                    placeholder="https://example.com/feed.xml"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setEditingFeed(null)}
                    className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    保存
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Gallery Content */}
        <main className="flex-1 overflow-y-auto p-6">
          {isLoading && page === 1 ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-16">
              <svg className="mx-auto h-16 w-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <h3 className="mt-4 text-lg font-medium text-gray-900">暂无内容</h3>
              <p className="mt-2 text-gray-500">
                {feeds.length === 0 ? '请先添加RSS订阅源' : '该订阅源暂无内容'}
              </p>
            </div>
          ) : (
            <>
              <ImageWall 
                items={items} 
                onItemClick={handleItemClick} 
                columnsCount={getCurrentImageWidth()}
                onItemViewed={handleItemViewed}
              />
              
              {/* Load More Button */}
              {hasMore && (
                <div ref={loadMoreButtonRef} className="flex justify-center mt-8">
                  <button
                    onClick={loadMore}
                    disabled={isLoading}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition"
                  >
                    {isLoading ? '加载中...' : '加载更多'}
                  </button>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Modal */}
      <ItemModal
        item={selectedItem}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}

export default App;
