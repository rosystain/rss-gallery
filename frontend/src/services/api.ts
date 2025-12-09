import type { Feed, FeedItem, ItemsResponse, CustomIntegration, PresetIntegration } from '../types';

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

  async createFeed(url: string, category?: string, enabledIntegrations?: string[] | null): Promise<Feed> {
    const payload: Record<string, unknown> = { url };
    if (category !== undefined) payload.category = category;
    if (enabledIntegrations !== undefined) payload.enabled_integrations = enabledIntegrations;
    
    const response = await fetch(`${API_BASE}/feeds`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
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

  async updateFeed(id: string, data: { title?: string; url?: string; category?: string; enabledIntegrations?: string[] | null }): Promise<Feed> {
    // Convert enabledIntegrations to snake_case for backend
    const payload: Record<string, unknown> = {};
    if (data.title !== undefined) payload.title = data.title;
    if (data.url !== undefined) payload.url = data.url;
    if (data.category !== undefined) payload.category = data.category;
    if (data.enabledIntegrations !== undefined) payload.enabled_integrations = data.enabledIntegrations;
    
    const response = await fetch(`${API_BASE}/feeds/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
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

  async refreshItemImage(itemId: string): Promise<{ success: boolean; thumbnail_image: string }> {
    const response = await fetch(`${API_BASE}/items/${itemId}/refresh-image`, {
      method: 'POST',
    });
    return handleResponse<{ success: boolean; thumbnail_image: string }>(response);
  },

  // Favorites
  async toggleFavorite(itemId: string): Promise<{ success: boolean; is_favorite: boolean }> {
    const response = await fetch(`${API_BASE}/items/${itemId}/favorite`, {
      method: 'POST',
    });
    return handleResponse<{ success: boolean; is_favorite: boolean }>(response);
  },

  async getFavorites(params?: {
    page?: number;
    limit?: number;
    sortBy?: 'published' | 'created' | 'favorited';
  }): Promise<ItemsResponse> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.set('page', params.page.toString());
    if (params?.limit) queryParams.set('limit', params.limit.toString());
    if (params?.sortBy) queryParams.set('sort_by', params.sortBy);

    const response = await fetch(`${API_BASE}/items/favorites?${queryParams}`);
    return handleResponse<ItemsResponse>(response);
  },

  // Integrations
  async getIntegrations(): Promise<CustomIntegration[]> {
    const response = await fetch(`${API_BASE}/integrations`);
    return handleResponse<CustomIntegration[]>(response);
  },

  async createIntegration(data: Omit<CustomIntegration, 'id' | 'createdAt' | 'updatedAt'>): Promise<CustomIntegration> {
    const response = await fetch(`${API_BASE}/integrations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: data.name,
        type: data.type,
        icon: data.icon,
        url: data.url,
        webhook_url: data.webhookUrl,
        webhook_method: data.webhookMethod,
        webhook_body: data.webhookBody,
        sort_order: data.sortOrder,
      }),
    });
    return handleResponse<CustomIntegration>(response);
  },

  async updateIntegration(id: string, data: Partial<CustomIntegration>): Promise<CustomIntegration> {
    const payload: Record<string, unknown> = {};
    if (data.name !== undefined) payload.name = data.name;
    if (data.type !== undefined) payload.type = data.type;
    if (data.icon !== undefined) payload.icon = data.icon;
    if (data.url !== undefined) payload.url = data.url;
    if (data.webhookUrl !== undefined) payload.webhook_url = data.webhookUrl;
    if (data.webhookMethod !== undefined) payload.webhook_method = data.webhookMethod;
    if (data.webhookBody !== undefined) payload.webhook_body = data.webhookBody;
    if (data.sortOrder !== undefined) payload.sort_order = data.sortOrder;

    const response = await fetch(`${API_BASE}/integrations/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<CustomIntegration>(response);
  },

  async deleteIntegration(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/integrations/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`API Error (${response.status}): ${errorText}`);
    }
  },

  // Preset Integrations
  async getPresetIntegrations(): Promise<PresetIntegration[]> {
    const response = await fetch(`${API_BASE}/preset-integrations`);
    return handleResponse<PresetIntegration[]>(response);
  },

  async getPresetIntegration(id: string): Promise<PresetIntegration> {
    const response = await fetch(`${API_BASE}/preset-integrations/${id}`);
    return handleResponse<PresetIntegration>(response);
  },

  async updatePresetIntegration(id: string, data: Partial<PresetIntegration>): Promise<PresetIntegration> {
    const payload: Record<string, unknown> = {};
    if (data.enabled !== undefined) payload.enabled = data.enabled;
    if (data.apiUrl !== undefined) payload.api_url = data.apiUrl;
    if (data.config !== undefined) payload.config = data.config;

    const response = await fetch(`${API_BASE}/preset-integrations/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<PresetIntegration>(response);
  },
};
