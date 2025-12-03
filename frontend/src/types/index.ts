export interface Feed {
  id: string;
  title: string;
  url: string;
  siteUrl?: string;
  description?: string;
  favicon?: string;
  category?: string;
  updateInterval: number;
  lastFetchedAt?: string;
  lastFetchError?: string;  // 上次抓取失败的错误信息
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  itemsCount?: number;
  unreadCount?: number;
  warning?: string;  // 订阅存在问题时的警告信息
}

export interface FeedItem {
  id: string;
  feedId: string;
  title: string;
  link: string;
  description?: string;
  content?: string;
  coverImage?: string;
  thumbnailImage?: string;
  author?: string;
  categories?: string;
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
  isUnread?: boolean;
  feed?: {
    title: string;
    category?: string;
    favicon?: string;
  };
}

export interface ItemsResponse {
  items: FeedItem[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}
