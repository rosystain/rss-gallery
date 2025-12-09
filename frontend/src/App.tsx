import { useState, useEffect, useRef } from 'react';
import { Menu } from '@headlessui/react';
import { api } from './services/api';
import type { FeedItem, Feed, CustomIntegration } from './types';
import ImageWall from './components/ImageWall';
import ItemModal from './components/ItemModal';
import ThemeToggle from './components/ThemeToggle';
import IntegrationSettings, { getCustomIntegrationsAsync, IntegrationIconComponent } from './components/IntegrationSettings';

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
  const [newFeedEnabledIntegrations, setNewFeedEnabledIntegrations] = useState<string[] | null>(null);
  const [newFeedAvailableIntegrations, setNewFeedAvailableIntegrations] = useState<CustomIntegration[]>([]);
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
  const [editFeedEnabledIntegrations, setEditFeedEnabledIntegrations] = useState<string[] | null>(null);
  const [availableIntegrations, setAvailableIntegrations] = useState<CustomIntegration[]>([]);
  const [viewedItems, setViewedItems] = useState<Set<string>>(new Set()); // 追踪已浏览的 items
  const batchMarkTimerRef = useRef<NodeJS.Timeout | null>(null); // 批量标记定时器
  const pendingMarkItemsRef = useRef<Set<string>>(new Set()); // 追踪待标记的项目（用于避免闭包问题）
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
  const [showIntegrationSettings, setShowIntegrationSettings] = useState(false);
  const [executionHistory, setExecutionHistory] = useState<Array<{
    id: string;
    type: 'success' | 'error';
    integrationName: string;
    message: string;
    detail?: string;
    timestamp: Date;
  }>>([]);
  const [integrationsRefreshTrigger, setIntegrationsRefreshTrigger] = useState(0);
  const loadMoreButtonRef = useRef<HTMLDivElement>(null);
  const fetchVersionRef = useRef(0); // 用于追踪请求版本，避免竞态条件

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
    // 增加版本号
    fetchVersionRef.current += 1;
    const currentVersion = fetchVersionRef.current;
    
    const fetchItems = async (silent = false, isRefresh = false) => {
      try {
        if (!silent) {
          setIsLoading(true);
        }
        
        const currentUnreadFilter = getCurrentUnreadFilter();
        // 静默刷新时只请求第一页
        const requestPage = isRefresh ? 1 : page;
        
        let response;
        if (selectedFeed === 'favorites') {
          // 获取收藏列表
          response = await api.getFavorites({
            page: requestPage,
            limit: itemsPerPage,
            sortBy: sortBy,
          });
        } else {
          response = await api.getItems({
            page: requestPage,
            limit: itemsPerPage,
            feedId: selectedFeed || undefined,
            unreadOnly: currentUnreadFilter,
            sortBy: sortBy,
          });
        }
        
        // 检查版本号，如果已过期则忽略响应
        if (currentVersion !== fetchVersionRef.current) {
          return;
        }
        
        if (isRefresh) {
          // 静默刷新：只更新现有数据中匹配的项目状态，不改变列表
          setItems(prev => {
            const newItemsMap = new Map(response.items.map(item => [item.id, item]));
            let hasChanges = false;
            const updated = prev.map(item => {
              const newItem = newItemsMap.get(item.id);
              // 如果新数据中有该项目，检查状态是否变化
              if (newItem && newItem.isUnread !== item.isUnread) {
                hasChanges = true;
                return { ...item, isUnread: newItem.isUnread };
              }
              return item;
            });
            // 只有在有变化时才返回新数组，避免不必要的重新渲染
            return hasChanges ? updated : prev;
          });
        } else if (page === 1) {
          setItems(response.items);
          setHasMore(response.hasMore);
        } else {
          // 翻页加载：去重后追加
          setItems(prev => {
            const existingIds = new Set(prev.map(item => item.id));
            const newItems = response.items.filter(item => !existingIds.has(item.id));
            return [...prev, ...newItems];
          });
          setHasMore(response.hasMore);
        }
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
      fetchItems(true, true); // Silent refresh, only update states
    }, 30000);
    
    return () => clearInterval(interval);
  }, [page, selectedFeed, refreshKey, feedUnreadFilters, itemsPerPage, sortBy]);

  // 批量标记已浏览的 items 为已读
  const batchMarkItemsAsRead = (itemIds: string[]) => {
    if (itemIds.length === 0) return;

    console.log(`准备标记 ${itemIds.length} 个浏览过的项目`);

    // 清除已提交的项目
    itemIds.forEach(id => pendingMarkItemsRef.current.delete(id));

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

  // 立即提交所有待标记的项目
  const flushPendingMarkItems = () => {
    if (batchMarkTimerRef.current) {
      clearTimeout(batchMarkTimerRef.current);
      batchMarkTimerRef.current = null;
    }
    const pendingIds = Array.from(pendingMarkItemsRef.current);
    if (pendingIds.length > 0) {
      batchMarkItemsAsRead(pendingIds);
    }
    // 注意：不要清空 viewedItems，切换 feed 时会重置
  };

  // 处理单个 item 被浏览完成
  const handleItemViewed = (itemId: string) => {
    // 使用 ref 来追踪待标记项目，避免闭包问题
    pendingMarkItemsRef.current.add(itemId);
    
    setViewedItems(prev => {
      const newSet = new Set(prev);
      newSet.add(itemId);
      return newSet;
    });

    // 清除之前的定时器
    if (batchMarkTimerRef.current) {
      clearTimeout(batchMarkTimerRef.current);
    }

    // 延迟 2 秒批量标记，避免频繁 API 调用
    batchMarkTimerRef.current = setTimeout(() => {
      const pendingIds = Array.from(pendingMarkItemsRef.current);
      if (pendingIds.length > 0) {
        batchMarkItemsAsRead(pendingIds);
      }
      // 注意：不要清空 viewedItems，否则会导致 ImageWall 重复检测
    }, 2000);
  };

  // 处理鼠标悬浮足够长时间后标记已读
  const handleItemHoverRead = (itemId: string) => {
    // 复用 handleItemViewed 的逻辑
    handleItemViewed(itemId);
  };

  // 切换 feed 时先提交待标记项目，再重置浏览记录
  useEffect(() => {
    // 先提交当前待标记的项目
    flushPendingMarkItems();
    // 重置所有记录（切换 feed 时可以安全清空）
    pendingMarkItemsRef.current = new Set();
    setViewedItems(new Set());
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

  const handleItemUpdated = (itemId: string, updates: Partial<FeedItem>) => {
    setItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, ...updates } : item
    ));
    // 如果是当前选中的项目，也更新它
    if (selectedItem && selectedItem.id === itemId) {
      setSelectedItem(prev => prev ? { ...prev, ...updates } : null);
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
      const result = await api.createFeed(newFeedUrl, undefined, newFeedEnabledIntegrations);
      setNewFeedUrl('');
      setShowAddFeed(false);
      setNewFeedEnabledIntegrations(null);
      setNewFeedAvailableIntegrations([]);
      await loadFeeds();
      setPage(1);
      triggerRefresh();
      
      // 如果有警告信息，显示给用户
      if (result.warning) {
        alert(result.warning);
      }
      
      // Refresh items after 3 seconds to get processed images
      setTimeout(() => {
        triggerRefresh();
      }, 3000);
    } catch (error) {
      console.error('Failed to add feed:', error);
      // 提取并显示后端返回的具体错误信息
      let errorMessage = '添加订阅失败，请检查URL是否正确';
      if (error instanceof Error) {
        const match = error.message.match(/API Error \(\d+\): (.+)/);
        if (match) {
          try {
            const detail = JSON.parse(match[1]);
            if (detail.detail) {
              // 翻译常见错误信息
              if (detail.detail === 'Feed URL already exists') {
                errorMessage = '该订阅地址已存在';
              } else {
                errorMessage = detail.detail;
              }
            }
          } catch {
            // 如果不是 JSON，直接使用错误信息
            if (match[1].includes('Feed URL already exists')) {
              errorMessage = '该订阅地址已存在';
            }
          }
        }
      }
      alert(errorMessage);
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

  const handleEditFeed = async (feed: Feed) => {
    setEditingFeed(feed);
    setEditFeedUrl(feed.url);
    setEditFeedTitle(feed.title);
    setEditFeedEnabledIntegrations(feed.enabledIntegrations ?? []);
    
    // 加载可用的集成列表
    try {
      const integrations = await getCustomIntegrationsAsync();
      setAvailableIntegrations(integrations);
    } catch (error) {
      console.error('Failed to load integrations:', error);
      setAvailableIntegrations([]);
    }
  };

  const handleUpdateFeed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFeed || !editFeedUrl || !editFeedTitle) return;

    try {
      await api.updateFeed(editingFeed.id, { 
        title: editFeedTitle, 
        url: editFeedUrl,
        enabledIntegrations: editFeedEnabledIntegrations
      });
      setEditingFeed(null);
      setEditFeedUrl('');
      setEditFeedTitle('');
      setEditFeedEnabledIntegrations(null);
      setAvailableIntegrations([]);
      await loadFeeds();
      triggerRefresh();
    } catch (error) {
      console.error('Failed to update feed:', error);
      alert('更新订阅失败，请检查URL是否正确');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg flex">
      {/* Left Sidebar */}
      <aside className={`bg-white dark:bg-dark-card border-r border-gray-200 dark:border-dark-border flex flex-col h-screen sticky top-0 transition-all duration-300 ${
        sidebarCollapsed ? 'w-16' : 'w-64'
      }`}>
        {/* Sidebar Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-dark-border flex items-center justify-between">
          {!sidebarCollapsed && <h1 className="text-lg font-semibold text-gray-900 dark:text-dark-text">RSS 图片墙</h1>}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-dark-hover rounded-lg transition ml-auto"
            title={sidebarCollapsed ? '展开侧边栏' : '折叠侧边栏'}
          >
            <svg className="w-5 h-5 text-gray-600 dark:text-dark-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                  ? 'bg-gray-200 dark:bg-dark-hover text-gray-900 dark:text-dark-text'
                  : 'text-gray-700 dark:text-dark-text hover:bg-gray-100 dark:hover:bg-dark-hover'
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
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-400 dark:bg-gray-600 text-white">
                    {totalUnread}
                  </span>
                ) : null;
              })()}
            </button>

            {/* Favorites */}
            <button
              onClick={() => handleFeedFilter('favorites')}
              className={`w-full text-left px-3 py-2 rounded-lg mb-1 transition flex items-center justify-between group ${
                selectedFeed === 'favorites'
                  ? 'bg-gray-200 dark:bg-dark-hover text-gray-900 dark:text-dark-text'
                  : 'text-gray-700 dark:text-dark-text hover:bg-gray-100 dark:hover:bg-dark-hover'
              }`}
              title={sidebarCollapsed ? '收藏' : ''}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <svg className="w-5 h-5 flex-shrink-0" fill={selectedFeed === 'favorites' ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
                {!sidebarCollapsed && <span className="font-medium">收藏</span>}
              </div>
            </button>

            {/* Feed Items */}
            <div className="mt-4">
              {!sidebarCollapsed && (
                <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-dark-text-secondary uppercase tracking-wider">
                  订阅列表
                </div>
              )}
              {feeds.map((feed) => (
                <button
                  key={feed.id}
                  onClick={() => handleFeedFilter(feed.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg mb-1 transition flex items-center justify-between ${
                    selectedFeed === feed.id
                      ? 'bg-gray-200 dark:bg-dark-hover text-gray-900 dark:text-dark-text'
                      : 'text-gray-700 dark:text-dark-text hover:bg-gray-100 dark:hover:bg-dark-hover'
                  }`}
                  title={sidebarCollapsed ? feed.title : (feed.lastFetchError ? `⚠️ 抓取失败: ${feed.lastFetchError}` : '')}
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
                    {/* 抓取失败时显示黄色感叹号 */}
                    {feed.lastFetchError && (
                      <span 
                        className="flex-shrink-0" 
                        title={`抓取失败: ${feed.lastFetchError}`}
                      >
                        <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </span>
                    )}
                  </div>
                  {!sidebarCollapsed && feed.unreadCount !== undefined && feed.unreadCount > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full ml-2 flex-shrink-0 bg-gray-400 dark:bg-gray-600 text-white">
                      {feed.unreadCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Add Feed Button */}
        <div className="p-2 border-t border-gray-200 dark:border-dark-border">
          <button
            onClick={async () => {
              setShowAddFeed(!showAddFeed);
              if (!showAddFeed) {
                // 打开对话框时加载集成列表
                try {
                  const integrations = await getCustomIntegrationsAsync();
                  setNewFeedAvailableIntegrations(integrations);
                  setNewFeedEnabledIntegrations([]); // 默认全部不启用
                } catch (error) {
                  console.error('Failed to load integrations:', error);
                  setNewFeedAvailableIntegrations([]);
                }
              }
            }}
            className={`w-full py-2 bg-gray-200 dark:bg-dark-hover text-gray-700 dark:text-dark-text rounded-lg hover:bg-gray-300 dark:hover:bg-dark-border transition flex items-center gap-2 ${
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
        <header className="bg-white dark:bg-dark-card border-b border-gray-200 dark:border-dark-border px-6 py-4 sticky top-0 z-40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-text">
                {selectedFeed === 'favorites'
                  ? '收藏'
                  : selectedFeed 
                    ? feeds.find(f => f.id === selectedFeed)?.title 
                    : '全部内容'
                }
              </h2>
              <span className="text-sm text-gray-500 dark:text-dark-text-secondary">
                {items.length} 项
              </span>
            </div>
            
            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              {/* Image Width Control */}
              <div className="relative">
                <button
                  onClick={() => setShowWidthSlider(!showWidthSlider)}
                  className="p-2 text-gray-600 dark:text-dark-text-secondary hover:bg-gray-100 dark:hover:bg-dark-hover rounded-lg transition"
                  title="调整图片大小"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </button>
                
                {showWidthSlider && (
                  <div className="absolute right-0 mt-2 p-4 bg-white dark:bg-dark-card rounded-lg shadow-lg border border-gray-200 dark:border-dark-border z-50 min-w-[280px]">
                    {/* 图片大小 */}
                    <div className="mb-4">
                      <div className="text-xs font-medium text-gray-700 dark:text-dark-text mb-2">图片大小</div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-xs text-gray-500 dark:text-dark-text-secondary whitespace-nowrap">大</span>
                        <input
                          type="range"
                          min="1"
                          max="10"
                          value={getCurrentImageWidth()}
                          onChange={(e) => setCurrentImageWidth(parseInt(e.target.value))}
                          className="flex-1 h-1.5 bg-gray-300 dark:bg-dark-border rounded-lg appearance-none cursor-pointer accent-blue-600"
                        />
                        <span className="text-xs text-gray-500 dark:text-dark-text-secondary whitespace-nowrap">小</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-600 dark:text-dark-text">{getCurrentImageWidth()} 列</span>
                          <span className="text-xs text-gray-400 dark:text-dark-text-secondary">
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
                    <div className="border-t border-gray-200 dark:border-dark-border my-4"></div>

                    {/* 每页显示项目数 */}
                    <div className="mb-4">
                      <div className="text-xs font-medium text-gray-700 dark:text-dark-text mb-2">每页显示</div>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          min="10"
                          max="100"
                          step="10"
                          value={itemsPerPage}
                          onChange={(e) => setItemsPerPage(Math.max(10, Math.min(100, parseInt(e.target.value) || 20)))}
                          className="w-20 px-2 py-1 text-sm border border-gray-300 dark:border-dark-border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-dark-hover text-gray-900 dark:text-dark-text"
                        />
                        <span className="text-sm text-gray-600 dark:text-dark-text">项</span>
                      </div>
                    </div>

                    {/* 分隔线 */}
                    <div className="border-t border-gray-200 dark:border-dark-border my-4"></div>

                    {/* 排序方式 */}
                    <div className="mb-4">
                      <div className="text-xs font-medium text-gray-700 dark:text-dark-text mb-2">排序方式</div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setSortBy('published')}
                          className={`flex-1 px-3 py-1.5 text-xs rounded transition ${
                            sortBy === 'published'
                              ? 'bg-gray-300 dark:bg-dark-border text-gray-800 dark:text-dark-text'
                              : 'bg-gray-100 dark:bg-dark-hover text-gray-700 dark:text-dark-text hover:bg-gray-200 dark:hover:bg-dark-border'
                          }`}
                        >
                          发布时间
                        </button>
                        <button
                          onClick={() => setSortBy('created')}
                          className={`flex-1 px-3 py-1.5 text-xs rounded transition ${
                            sortBy === 'created'
                              ? 'bg-gray-300 dark:bg-dark-border text-gray-800 dark:text-dark-text'
                              : 'bg-gray-100 dark:bg-dark-hover text-gray-700 dark:text-dark-text hover:bg-gray-200 dark:hover:bg-dark-border'
                          }`}
                        >
                          抓取时间
                        </button>
                      </div>
                    </div>

                    {/* 分隔线 */}
                    <div className="border-t border-gray-200 dark:border-dark-border my-4"></div>

                    {/* 自动加载 */}
                    <div>
                      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-dark-text cursor-pointer">
                        <input
                          type="checkbox"
                          checked={autoLoadMore}
                          onChange={(e) => setAutoLoadMore(e.target.checked)}
                          className="rounded border-gray-300 dark:border-dark-border text-blue-600 focus:ring-blue-500"
                        />
                        <span>自动加载更多</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Unread Filter Button - hide for favorites */}
              {selectedFeed !== 'favorites' && (
                <button
                  onClick={() => setCurrentUnreadFilter(!getCurrentUnreadFilter())}
                  className="p-2 text-gray-500 dark:text-dark-text-secondary hover:bg-gray-100 dark:hover:bg-dark-hover rounded-lg transition"
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
              )}
              
              {/* Theme Toggle */}
              <ThemeToggle />
              
              <button
                onClick={() => triggerRefresh()}
                className="p-2 text-gray-600 dark:text-dark-text-secondary hover:bg-gray-100 dark:hover:bg-dark-hover rounded-lg transition"
                title="刷新"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              
              <Menu as="div" className="relative">
                <Menu.Button
                  className="p-2 text-gray-600 dark:text-dark-text-secondary hover:bg-gray-100 dark:hover:bg-dark-hover rounded-lg transition"
                  title="更多操作"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                  </svg>
                </Menu.Button>
                
                <Menu.Items className="absolute right-0 mt-2 w-48 bg-white dark:bg-dark-card rounded-lg shadow-lg border border-gray-200 dark:border-dark-border py-1 focus:outline-none">
                  {selectedFeed !== 'favorites' && (
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
                              active ? 'bg-gray-50 dark:bg-dark-hover text-gray-900 dark:text-dark-text' : 'text-gray-700 dark:text-dark-text'
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
                  )}
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        onClick={() => setShowIntegrationSettings(true)}
                        className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 ${
                          active ? 'bg-gray-50 dark:bg-dark-hover text-gray-900 dark:text-dark-text' : 'text-gray-700 dark:text-dark-text'
                        }`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z" />
                        </svg>
                        集成
                      </button>
                    )}
                  </Menu.Item>
                  {selectedFeed && selectedFeed !== 'favorites' && (
                    <>
                      <Menu.Item>
                        {({ active }) => {
                          const currentFeed = feeds.find(f => f.id === selectedFeed);
                          return (
                            <button
                              onClick={() => currentFeed && handleEditFeed(currentFeed)}
                              className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 ${
                                active ? 'bg-gray-50 dark:bg-dark-hover text-gray-900 dark:text-dark-text' : 'text-gray-700 dark:text-dark-text'
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
                                active ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400' : 'text-red-600 dark:text-red-400'
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
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-dark-card rounded-lg p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-dark-text">添加新订阅</h3>
              <form onSubmit={handleAddFeed} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-dark-text mb-2">
                    RSS 订阅地址
                  </label>
                  <input
                    type="url"
                    value={newFeedUrl}
                    onChange={(e) => setNewFeedUrl(e.target.value)}
                    placeholder="https://example.com/feed.xml"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-transparent bg-white dark:bg-dark-hover text-gray-900 dark:text-dark-text placeholder-gray-400 dark:placeholder-dark-text-secondary"
                    required
                    autoFocus
                  />
                </div>
                
                {/* 集成启用设置 */}
                {newFeedAvailableIntegrations.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-dark-text mb-2">
                      启用的集成
                    </label>
                    <p className="text-xs text-gray-500 dark:text-dark-text-secondary mb-2">
                      选择要在此订阅的卡片工具栏中显示的集成
                    </p>
                    <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 dark:border-dark-border rounded-lg p-2">
                      {newFeedAvailableIntegrations.map((integration) => {
                        const isEnabled = newFeedEnabledIntegrations?.includes(integration.id) ?? false;
                        return (
                          <label
                            key={integration.id}
                            className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-dark-hover rounded cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={isEnabled}
                              onChange={(e) => {
                                const currentList = newFeedEnabledIntegrations ?? [];
                                if (e.target.checked) {
                                  setNewFeedEnabledIntegrations([...currentList, integration.id]);
                                } else {
                                  setNewFeedEnabledIntegrations(currentList.filter(id => id !== integration.id));
                                }
                              }}
                              className="w-4 h-4 rounded border-gray-300 dark:border-dark-border text-blue-600 focus:ring-blue-500"
                            />
                            {integration.icon ? (
                              <IntegrationIconComponent icon={integration.icon} className="w-4 h-4 text-gray-600 dark:text-dark-text-secondary" />
                            ) : (
                              <svg className="w-4 h-4 text-gray-600 dark:text-dark-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.172 13.828a4 4 0 015.656 0l4-4a4 4 0 10-5.656-5.656l-1.101 1.101" />
                              </svg>
                            )}
                            <span className="text-sm text-gray-700 dark:text-dark-text">{integration.name}</span>
                            <span className="text-xs text-gray-400 dark:text-dark-text-secondary ml-auto">
                              {integration.type === 'url' ? 'URL' : 'Webhook'}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setNewFeedEnabledIntegrations(newFeedAvailableIntegrations.map(i => i.id))}
                        className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        全选
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewFeedEnabledIntegrations([])}
                        className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        全不选
                      </button>
                    </div>
                  </div>
                )}
                
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddFeed(false);
                      setNewFeedEnabledIntegrations(null);
                      setNewFeedAvailableIntegrations([]);
                    }}
                    className="px-4 py-2 text-gray-700 dark:text-dark-text hover:bg-gray-100 dark:hover:bg-dark-hover rounded-lg transition"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-gray-700 dark:bg-dark-border text-white rounded-lg hover:bg-gray-800 dark:hover:bg-gray-600 transition"
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
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-dark-card rounded-lg p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-dark-text">编辑订阅</h3>
              <form onSubmit={handleUpdateFeed} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-dark-text mb-2">
                    订阅名称
                  </label>
                  <input
                    type="text"
                    value={editFeedTitle}
                    onChange={(e) => setEditFeedTitle(e.target.value)}
                    placeholder="订阅名称"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-transparent bg-white dark:bg-dark-hover text-gray-900 dark:text-dark-text placeholder-gray-400 dark:placeholder-dark-text-secondary"
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-dark-text mb-2">
                    RSS链接
                  </label>
                  <input
                    type="url"
                    value={editFeedUrl}
                    onChange={(e) => setEditFeedUrl(e.target.value)}
                    placeholder="https://example.com/feed.xml"
                    className="w-full px-4 py-2 border border-gray-300 dark:border-dark-border rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-transparent bg-white dark:bg-dark-hover text-gray-900 dark:text-dark-text placeholder-gray-400 dark:placeholder-dark-text-secondary"
                    required
                  />
                </div>
                
                {/* 集成启用设置 */}
                {availableIntegrations.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-dark-text mb-2">
                      启用的集成
                    </label>
                    <p className="text-xs text-gray-500 dark:text-dark-text-secondary mb-2">
                      选择要在此订阅的卡片工具栏中显示的集成
                    </p>
                    <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 dark:border-dark-border rounded-lg p-2">
                      {availableIntegrations.map((integration) => {
                        const isEnabled = editFeedEnabledIntegrations?.includes(integration.id) ?? false;
                        return (
                          <label
                            key={integration.id}
                            className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-dark-hover rounded cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={isEnabled}
                              onChange={(e) => {
                                const currentList = editFeedEnabledIntegrations ?? [];
                                if (e.target.checked) {
                                  setEditFeedEnabledIntegrations([...currentList, integration.id]);
                                } else {
                                  setEditFeedEnabledIntegrations(currentList.filter(id => id !== integration.id));
                                }
                              }}
                              className="w-4 h-4 rounded border-gray-300 dark:border-dark-border text-blue-600 focus:ring-blue-500"
                            />
                            {integration.icon ? (
                              <IntegrationIconComponent icon={integration.icon} className="w-4 h-4 text-gray-600 dark:text-dark-text-secondary" />
                            ) : (
                              <svg className="w-4 h-4 text-gray-600 dark:text-dark-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.172 13.828a4 4 0 015.656 0l4-4a4 4 0 10-5.656-5.656l-1.101 1.101" />
                              </svg>
                            )}
                            <span className="text-sm text-gray-700 dark:text-dark-text">{integration.name}</span>
                            <span className="text-xs text-gray-400 dark:text-dark-text-secondary ml-auto">
                              {integration.type === 'url' ? 'URL' : 'Webhook'}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEditFeedEnabledIntegrations(availableIntegrations.map(i => i.id))}
                        className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        全选
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditFeedEnabledIntegrations([])}
                        className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        全不选
                      </button>
                    </div>
                  </div>
                )}
                
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingFeed(null);
                      setEditFeedEnabledIntegrations(null);
                      setAvailableIntegrations([]);
                    }}
                    className="px-4 py-2 text-gray-700 dark:text-dark-text hover:bg-gray-100 dark:hover:bg-dark-hover rounded-lg transition"
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-gray-700 dark:bg-dark-border text-white rounded-lg hover:bg-gray-800 dark:hover:bg-gray-600 transition"
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
              <svg className="mx-auto h-16 w-16 text-gray-400 dark:text-dark-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-dark-text">暂无内容</h3>
              <p className="mt-2 text-gray-500 dark:text-dark-text-secondary">
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
                viewedItems={viewedItems}
                onItemUpdated={handleItemUpdated}
                onItemHoverRead={handleItemHoverRead}
                onAddExecutionHistory={(entry) => setExecutionHistory(prev => [entry, ...prev].slice(0, 50))}
                refreshIntegrationsTrigger={integrationsRefreshTrigger}
              />
              
              {/* Load More Button */}
              {hasMore ? (
                <div ref={loadMoreButtonRef} className="flex justify-center mt-8">
                  <button
                    onClick={loadMore}
                    disabled={isLoading}
                    className="px-6 py-3 bg-gray-200 dark:bg-dark-hover text-gray-700 dark:text-dark-text rounded-lg hover:bg-gray-300 dark:hover:bg-dark-border disabled:bg-gray-300 dark:disabled:bg-dark-border disabled:text-gray-400 transition"
                  >
                    {isLoading ? '加载中...' : '加载更多'}
                  </button>
                </div>
              ) : (
                /* Mark All as Read Button - shown when no more items to load */
                items.some(item => item.isUnread) && (
                  <div className="flex flex-col items-center mt-8 mb-4">
                    <p className="text-sm text-gray-400 dark:text-dark-text-secondary mb-3">已加载全部内容</p>
                    <button
                      onClick={handleMarkAllAsRead}
                      className="px-6 py-3 bg-gray-200 dark:bg-dark-hover text-gray-700 dark:text-dark-text rounded-lg hover:bg-gray-300 dark:hover:bg-dark-border transition flex items-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      标记全部为已读
                    </button>
                  </div>
                )
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
        onItemUpdated={handleItemUpdated}
        onAddExecutionHistory={(entry) => setExecutionHistory(prev => [entry, ...prev].slice(0, 50))}
        refreshIntegrationsTrigger={integrationsRefreshTrigger}
      />

      {/* Integration Settings Modal */}
      <IntegrationSettings
        isOpen={showIntegrationSettings}
        onClose={() => setShowIntegrationSettings(false)}
        executionHistory={executionHistory}
        onClearHistory={() => setExecutionHistory([])}
        onIntegrationsChange={() => setIntegrationsRefreshTrigger(prev => prev + 1)}
      />
    </div>
  );
}

export default App;
