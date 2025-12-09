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
  enabledIntegrations?: string[] | null;  // 启用的集成 ID 列表，null 表示全部启用
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
  isFavorite?: boolean;
  feed?: {
    title: string;
    category?: string;
    favicon?: string;
    enabledIntegrations?: string[] | null;  // 该 feed 启用的集成 ID 列表
  };
}

export interface ItemsResponse {
  items: FeedItem[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

// 集成类型
export type IntegrationType = 'url' | 'webhook';
export type WebhookMethod = 'GET' | 'POST';

// 可选图标列表
export type IntegrationIcon = 
  | 'link'        // 链接
  | 'globe'       // 地球
  | 'bookmark'    // 书签
  | 'star'        // 星星
  | 'heart'       // 心形
  | 'archive'     // 归档
  | 'cloud'       // 云
  | 'send'        // 发送
  | 'download'    // 下载
  | 'upload'      // 上传
  | 'folder'      // 文件夹
  | 'document'    // 文档
  | 'code'        // 代码
  | 'terminal'    // 终端
  | 'database'    // 数据库
  | 'share'       // 分享
  | 'bell'        // 铃铛
  | 'mail'        // 邮件
  | 'chat'        // 聊天
  | 'lightning';  // 闪电

// 预设集成（如 Obsidian、Hentai Assistant 等）
export interface PresetIntegration {
  id: string;
  name?: string;  // 可选，用于从默认配置获取
  icon?: string;  // 可选，用于从默认配置获取
  enabled: boolean;
  config?: Record<string, string>;
  apiUrl?: string;  // API 基础 URL（用于私人集成）
  createdAt?: string;
  updatedAt?: string;
}

// 自定义集成
export interface CustomIntegration {
  id: string;
  name: string;
  type: IntegrationType;
  icon?: IntegrationIcon; // 自选图标
  // URL 跳转类型
  url?: string;
  // Webhook 类型
  webhookUrl?: string;
  webhookMethod?: WebhookMethod;
  webhookBody?: string; // JSON 字符串，用于 POST 请求
  sortOrder?: number; // 排序顺序
  createdAt: string;
  updatedAt: string;
}

// 集成
export interface IntegrationSettings {
  presets: PresetIntegration[];
  custom: CustomIntegration[];
}
