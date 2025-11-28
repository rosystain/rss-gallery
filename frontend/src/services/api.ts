import type { Feed, FeedItem, ItemsResponse } from '../types';

const API_BASE = 'http://localhost:3001/api';

export const api = {
  // Feeds
  async getFeeds(): Promise<Feed[]> {
    const response = await fetch(`${API_BASE}/feeds`);
    return response.json();
  },

  async createFeed(url: string, category?: string): Promise<Feed> {
    const response = await fetch(`${API_BASE}/feeds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, category }),
    });
    return response.json();
  },

  async deleteFeed(id: string): Promise<void> {
    await fetch(`${API_BASE}/feeds/${id}`, {
      method: 'DELETE',
    });
  },

  async updateFeed(id: string, data: { title?: string; url?: string; category?: string }): Promise<Feed> {
    const response = await fetch(`${API_BASE}/feeds/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return response.json();
  },

  async fetchFeed(id: string): Promise<{ success: boolean; newItems: number }> {
    const response = await fetch(`${API_BASE}/feeds/${id}/fetch`, {
      method: 'POST',
    });
    return response.json();
  },

  async markFeedAsRead(id: string, latestItemTime?: string): Promise<{ success: boolean; lastViewedAt: string }> {
    const url = latestItemTime 
      ? `${API_BASE}/feeds/${id}/mark-read?latest_item_time=${encodeURIComponent(latestItemTime)}`
      : `${API_BASE}/feeds/${id}/mark-read`;
    const response = await fetch(url, {
      method: 'POST',
    });
    return response.json();
  },

  async markItemsAsRead(itemIds: string[]): Promise<{ success: boolean; marked_count: number }> {
    const response = await fetch(`${API_BASE}/items/mark-read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(itemIds),
    });
    return response.json();
  },

  async markItemAsRead(itemId: string): Promise<{ success: boolean }> {
    const response = await fetch(`${API_BASE}/items/${itemId}/mark-read`, {
      method: 'POST',
    });
    return response.json();
  },

  async markAllFeedAsRead(feedId: string): Promise<{ success: boolean; marked_count: number }> {
    const response = await fetch(`${API_BASE}/feeds/${feedId}/mark-all-read`, {
      method: 'POST',
    });
    return response.json();
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
    return response.json();
  },

  async getItem(id: string): Promise<FeedItem> {
    const response = await fetch(`${API_BASE}/items/${id}`);
    return response.json();
  },
};
