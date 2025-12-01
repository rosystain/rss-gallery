import type { Feed, FeedItem, ItemsResponse } from '../types';

const API_BASE = '/api';

// 统一的响应处理
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`API Error (${response.status}): ${errorText}`);
  }
  return response.json();
}

export const api = {
  // Feeds
  async getFeeds(): Promise<Feed[]> {
    const response = await fetch(`${API_BASE}/feeds`);
    return handleResponse<Feed[]>(response);
  },

  async createFeed(url: string, category?: string): Promise<Feed> {
    const response = await fetch(`${API_BASE}/feeds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, category }),
    });
    return handleResponse<Feed>(response);
  },

  async deleteFeed(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/feeds/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`API Error (${response.status}): ${errorText}`);
    }
  },

  async updateFeed(id: string, data: { title?: string; url?: string; category?: string }): Promise<Feed> {
    const response = await fetch(`${API_BASE}/feeds/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return handleResponse<Feed>(response);
  },

  async fetchFeed(id: string): Promise<{ success: boolean; newItems: number }> {
    const response = await fetch(`${API_BASE}/feeds/${id}/fetch`, {
      method: 'POST',
    });
    return handleResponse<{ success: boolean; newItems: number }>(response);
  },

  async markFeedAsRead(id: string, latestItemTime?: string): Promise<{ success: boolean; lastViewedAt: string }> {
    const url = latestItemTime 
      ? `${API_BASE}/feeds/${id}/mark-read?latest_item_time=${encodeURIComponent(latestItemTime)}`
      : `${API_BASE}/feeds/${id}/mark-read`;
    const response = await fetch(url, {
      method: 'POST',
    });
    return handleResponse<{ success: boolean; lastViewedAt: string }>(response);
  },

  async markItemsAsRead(itemIds: string[]): Promise<{ success: boolean; marked_count: number }> {
    const response = await fetch(`${API_BASE}/items/mark-read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(itemIds),
    });
    return handleResponse<{ success: boolean; marked_count: number }>(response);
  },

  async markItemAsRead(itemId: string): Promise<{ success: boolean }> {
    const response = await fetch(`${API_BASE}/items/${itemId}/mark-read`, {
      method: 'POST',
    });
    return handleResponse<{ success: boolean }>(response);
  },

  async markAllFeedAsRead(feedId: string): Promise<{ success: boolean; marked_count: number }> {
    const response = await fetch(`${API_BASE}/feeds/${feedId}/mark-all-read`, {
      method: 'POST',
    });
    return handleResponse<{ success: boolean; marked_count: number }>(response);
  },

  // Items
  async getItems(params?: {
    page?: number;
    limit?: number;
    feedId?: string;
    category?: string;
    search?: string;
    unreadOnly?: boolean;
    sortBy?: 'published' | 'created';
  }): Promise<ItemsResponse> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.set('page', params.page.toString());
    if (params?.limit) queryParams.set('limit', params.limit.toString());
    if (params?.feedId) queryParams.set('feed_id', params.feedId); // 修正：后端使用 feed_id
    if (params?.category) queryParams.set('category', params.category);
    if (params?.search) queryParams.set('search', params.search);
    if (params?.unreadOnly) queryParams.set('unread_only', 'true');
    if (params?.sortBy) queryParams.set('sort_by', params.sortBy);

    const response = await fetch(`${API_BASE}/items?${queryParams}`);
    return handleResponse<ItemsResponse>(response);
  },

  async getItem(id: string): Promise<FeedItem> {
    const response = await fetch(`${API_BASE}/items/${id}`);
    return handleResponse<FeedItem>(response);
  },
};
