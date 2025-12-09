import { useState, useEffect } from 'react';
import type { CustomIntegration, IntegrationType, WebhookMethod, PresetIntegration, IntegrationIcon } from '../types';
import type { ReactNode } from 'react';
import { api } from '../services/api';

// 可选图标配置
const AVAILABLE_ICONS: { id: IntegrationIcon; label: string }[] = [
  { id: 'link', label: '链接' },
  { id: 'globe', label: '地球' },
  { id: 'bookmark', label: '书签' },
  { id: 'star', label: '星星' },
  { id: 'heart', label: '心形' },
  { id: 'archive', label: '归档' },
  { id: 'cloud', label: '云' },
  { id: 'send', label: '发送' },
  { id: 'download', label: '下载' },
  { id: 'upload', label: '上传' },
  { id: 'folder', label: '文件夹' },
  { id: 'document', label: '文档' },
  { id: 'code', label: '代码' },
  { id: 'terminal', label: '终端' },
  { id: 'database', label: '数据库' },
  { id: 'share', label: '分享' },
  { id: 'bell', label: '铃铛' },
  { id: 'mail', label: '邮件' },
  { id: 'chat', label: '聊天' },
  { id: 'lightning', label: '闪电' },
];

// 图标组件
export function IntegrationIconComponent({ icon, className = 'w-4 h-4' }: { icon: IntegrationIcon; className?: string }) {
  const iconPaths: Record<IntegrationIcon, ReactNode> = {
    link: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />,
    globe: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
    bookmark: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />,
    star: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />,
    heart: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />,
    archive: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />,
    cloud: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />,
    send: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />,
    download: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />,
    upload: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />,
    folder: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />,
    document: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />,
    code: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />,
    terminal: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />,
    database: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />,
    share: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />,
    bell: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />,
    mail: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />,
    chat: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />,
    lightning: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />,
  };

  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      {iconPaths[icon]}
    </svg>
  );
}

// 预设集成配置（固定的，不存数据库）
const defaultPresets: PresetIntegration[] = [
  {
    id: 'obsidian',
    name: 'Obsidian',
    icon: 'obsidian',
    enabled: false,
  },
];

// 执行历史记录类型
export interface ExecutionHistoryEntry {
  id: string;
  type: 'success' | 'error';
  integrationName: string;
  message: string;
  detail?: string;
  timestamp: Date;
}

interface IntegrationSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  executionHistory: ExecutionHistoryEntry[];
  onClearHistory: () => void;
  onIntegrationsChange?: () => void;  // 当集成配置变更时的回调
}

export default function IntegrationSettings({ isOpen, onClose, executionHistory, onClearHistory, onIntegrationsChange }: IntegrationSettingsProps) {
  const [presets] = useState<PresetIntegration[]>(defaultPresets);
  const [activeTab, setActiveTab] = useState<'integrations' | 'history'>('integrations');
  const [customIntegrations, setCustomIntegrations] = useState<CustomIntegration[]>([]);
  const [editingIntegration, setEditingIntegration] = useState<CustomIntegration | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [, setIsLoading] = useState(false);
  const [, setIsSaving] = useState(false);

  // 从 API 加载集成
  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      api.getIntegrations()
        .then(setCustomIntegrations)
        .catch(err => console.error('Failed to load integrations:', err))
        .finally(() => setIsLoading(false));
    }
  }, [isOpen]);

  // 创建新的自定义集成
  const handleCreateNew = () => {
    const newIntegration: CustomIntegration = {
      id: '',  // 服务端生成
      name: '',
      type: 'url',
      url: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setEditingIntegration(newIntegration);
    setIsCreating(true);
  };

  // 编辑集成
  const handleEdit = (integration: CustomIntegration) => {
    setEditingIntegration({ ...integration });
    setIsCreating(false);
  };

  // 保存集成
  const handleSaveIntegration = async () => {
    if (!editingIntegration || !editingIntegration.name.trim()) {
      alert('请输入集成名称');
      return;
    }

    // 验证 URL
    if (editingIntegration.type === 'url' && !editingIntegration.url?.trim()) {
      alert('请输入跳转 URL');
      return;
    }
    if (editingIntegration.type === 'webhook' && !editingIntegration.webhookUrl?.trim()) {
      alert('请输入 Webhook URL');
      return;
    }

    setIsSaving(true);
    try {
      if (isCreating) {
        const created = await api.createIntegration({
          name: editingIntegration.name,
          type: editingIntegration.type,
          icon: editingIntegration.icon,
          url: editingIntegration.url,
          webhookUrl: editingIntegration.webhookUrl,
          webhookMethod: editingIntegration.webhookMethod,
          webhookBody: editingIntegration.webhookBody,
          sortOrder: editingIntegration.sortOrder,
        });
        setCustomIntegrations(prev => [...prev, created]);
      } else {
        const updated = await api.updateIntegration(editingIntegration.id, editingIntegration);
        setCustomIntegrations(prev => prev.map(i => i.id === updated.id ? updated : i));
      }
      setEditingIntegration(null);
      setIsCreating(false);
      onIntegrationsChange?.();  // 通知外部刷新
    } catch (err) {
      console.error('Failed to save integration:', err);
      alert('保存失败，请重试');
    } finally {
      setIsSaving(false);
    }
  };

  // 删除集成
  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除这个集成吗？')) return;
    
    try {
      await api.deleteIntegration(id);
      setCustomIntegrations(prev => prev.filter(i => i.id !== id));
      setEditingIntegration(null);
      onIntegrationsChange?.();  // 通知外部刷新
    } catch (err) {
      console.error('Failed to delete integration:', err);
      alert('删除失败，请重试');
    }
  };

  // 取消编辑
  const handleCancelEdit = () => {
    setEditingIntegration(null);
    setIsCreating(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div
        className="bg-white dark:bg-dark-card rounded-lg w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-dark-border">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-text">集成</h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-dark-hover rounded-lg transition"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {/* Tabs */}
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('integrations')}
              className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'integrations'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-dark-text-secondary hover:text-gray-700 dark:hover:text-dark-text'
              }`}
            >
              集成
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`pb-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === 'history'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-dark-text-secondary hover:text-gray-700 dark:hover:text-dark-text'
              }`}
            >
              执行历史
              {executionHistory.length > 0 && (
                <span className="px-1.5 py-0.5 text-xs bg-gray-200 dark:bg-dark-border rounded-full">
                  {executionHistory.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 历史记录 Tab */}
          {activeTab === 'history' && (
            <div>
              {executionHistory.length === 0 ? (
                <p className="text-center text-gray-400 dark:text-dark-text-secondary py-12">暂无执行记录</p>
              ) : (
                <>
                  <div className="flex justify-end mb-3">
                    <button
                      onClick={onClearHistory}
                      className="text-sm text-gray-500 hover:text-gray-700 dark:text-dark-text-secondary dark:hover:text-dark-text"
                    >
                      清空历史
                    </button>
                  </div>
                  <div className="space-y-3">
                    {executionHistory.map((entry) => (
                      <div 
                        key={entry.id}
                        className={`rounded-lg p-3 ${
                          entry.type === 'success'
                            ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                            : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          {entry.type === 'success' ? (
                            <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          )}
                          <span className={`text-sm font-medium ${
                            entry.type === 'success' ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'
                          }`}>
                            {entry.integrationName}
                          </span>
                          <span className="text-xs text-gray-400 dark:text-dark-text-secondary ml-auto">
                            {entry.timestamp.toLocaleTimeString()}
                          </span>
                        </div>
                        {entry.detail && (
                          <pre className={`text-xs overflow-auto max-h-24 p-2 rounded whitespace-pre-wrap break-all ${
                            entry.type === 'success'
                              ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
                              : 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
                          }`}>
                            {entry.detail}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* 集成 Tab */}
          {activeTab === 'integrations' && (
            <>
          {/* 预设集成 */}
          <section>
            <h3 className="text-sm font-medium text-gray-700 dark:text-dark-text mb-3">预设集成</h3>
            <div className="space-y-2">
              {presets.map((preset) => (
                <div
                  key={preset.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-dark-hover rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {/* Obsidian Icon */}
                    {preset.icon === 'obsidian' && (
                      <svg className="w-5 h-5 text-purple-600" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                      </svg>
                    )}
                    <span className="text-gray-900 dark:text-dark-text">{preset.name}</span>
                  </div>
                  <span className="text-xs text-gray-400 dark:text-dark-text-secondary">即将推出</span>
                </div>
              ))}
            </div>
          </section>

          {/* 自定义集成 */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-700 dark:text-dark-text">自定义集成</h3>
              <button
                onClick={handleCreateNew}
                className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                新建
              </button>
            </div>

            {/* 集成列表 */}
            {customIntegrations.length === 0 && !editingIntegration ? (
              <div className="text-center py-8 text-gray-400 dark:text-dark-text-secondary">
                <p>暂无自定义集成</p>
                <p className="text-sm mt-1">点击"新建"添加自定义集成</p>
              </div>
            ) : (
              <div className="space-y-2">
                {customIntegrations.map((integration) => (
                  <div
                    key={integration.id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-dark-hover rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {/* Custom Icon or Default Type Icon */}
                      {integration.icon ? (
                        <IntegrationIconComponent icon={integration.icon} className="w-5 h-5 text-gray-500 dark:text-dark-text-secondary" />
                      ) : integration.type === 'url' ? (
                        <svg className="w-5 h-5 text-gray-500 dark:text-dark-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      ) : (
                        <svg className="w-5 h-5 text-gray-500 dark:text-dark-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      )}
                      <div>
                        <div className="text-gray-900 dark:text-dark-text">{integration.name}</div>
                        <div className="text-xs text-gray-400 dark:text-dark-text-secondary">
                          {integration.type === 'url' ? 'URL 跳转' : `Webhook (${integration.webhookMethod})`}
                          <span className="mx-1">•</span>
                          <span className="font-mono">{integration.id}</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleEdit(integration)}
                      className="text-sm text-gray-500 hover:text-gray-700 dark:text-dark-text-secondary dark:hover:text-dark-text"
                    >
                      编辑
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* 编辑/创建表单 */}
          {editingIntegration && (
            <section className="border-t border-gray-200 dark:border-dark-border pt-6">
              <h3 className="text-sm font-medium text-gray-700 dark:text-dark-text mb-4">
                {isCreating ? '新建集成' : '编辑集成'}
              </h3>
              
              <div className="space-y-4">
                {/* 名称 */}
                <div>
                  <label className="block text-sm text-gray-600 dark:text-dark-text-secondary mb-1">
                    名称
                  </label>
                  <input
                    type="text"
                    value={editingIntegration.name}
                    onChange={(e) =>
                      setEditingIntegration({ ...editingIntegration, name: e.target.value })
                    }
                    placeholder="集成名称"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-hover text-gray-900 dark:text-dark-text placeholder-gray-400 dark:placeholder-dark-text-secondary focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* 图标选择 */}
                <div>
                  <label className="block text-sm text-gray-600 dark:text-dark-text-secondary mb-2">
                    图标
                  </label>
                  <div className="grid grid-cols-10 gap-1">
                    {AVAILABLE_ICONS.map((iconOption) => (
                      <button
                        key={iconOption.id}
                        type="button"
                        onClick={() =>
                          setEditingIntegration({ ...editingIntegration, icon: iconOption.id })
                        }
                        className={`p-2 rounded-lg transition-colors ${
                          editingIntegration.icon === iconOption.id
                            ? 'bg-gray-200 dark:bg-dark-border text-gray-900 dark:text-dark-text'
                            : 'hover:bg-gray-100 dark:hover:bg-dark-hover text-gray-500 dark:text-dark-text-secondary'
                        }`}
                        title={iconOption.label}
                      >
                        <IntegrationIconComponent icon={iconOption.id} className="w-5 h-5" />
                      </button>
                    ))}
                  </div>
                </div>

                {/* 类型 */}
                <div>
                  <label className="block text-sm text-gray-600 dark:text-dark-text-secondary mb-1">
                    类型
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="type"
                        checked={editingIntegration.type === 'url'}
                        onChange={() =>
                          setEditingIntegration({ ...editingIntegration, type: 'url' as IntegrationType })
                        }
                        className="text-blue-600"
                      />
                      <span className="text-gray-700 dark:text-dark-text">URL 跳转</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="type"
                        checked={editingIntegration.type === 'webhook'}
                        onChange={() =>
                          setEditingIntegration({
                            ...editingIntegration,
                            type: 'webhook' as IntegrationType,
                            webhookMethod: editingIntegration.webhookMethod || 'POST',
                          })
                        }
                        className="text-blue-600"
                      />
                      <span className="text-gray-700 dark:text-dark-text">Webhook</span>
                    </label>
                  </div>
                </div>

                {/* URL 跳转配置 */}
                {editingIntegration.type === 'url' && (
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-dark-text-secondary mb-1">
                      跳转 URL
                    </label>
                    <input
                      type="text"
                      value={editingIntegration.url || ''}
                      onChange={(e) =>
                        setEditingIntegration({ ...editingIntegration, url: e.target.value })
                      }
                      placeholder="https://example.com/search?q={title}"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-hover text-gray-900 dark:text-dark-text placeholder-gray-400 dark:placeholder-dark-text-secondary focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                    />
                  </div>
                )}

                {/* Webhook 配置 */}
                {editingIntegration.type === 'webhook' && (
                  <>
                    <div>
                      <label className="block text-sm text-gray-600 dark:text-dark-text-secondary mb-1">
                        请求方式
                      </label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="method"
                            checked={editingIntegration.webhookMethod === 'GET'}
                            onChange={() =>
                              setEditingIntegration({
                                ...editingIntegration,
                                webhookMethod: 'GET' as WebhookMethod,
                              })
                            }
                            className="text-blue-600"
                          />
                          <span className="text-gray-700 dark:text-dark-text">GET</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="method"
                            checked={editingIntegration.webhookMethod === 'POST'}
                            onChange={() =>
                              setEditingIntegration({
                                ...editingIntegration,
                                webhookMethod: 'POST' as WebhookMethod,
                              })
                            }
                            className="text-blue-600"
                          />
                          <span className="text-gray-700 dark:text-dark-text">POST</span>
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm text-gray-600 dark:text-dark-text-secondary mb-1">
                        Webhook URL
                      </label>
                      <input
                        type="text"
                        value={editingIntegration.webhookUrl || ''}
                        onChange={(e) =>
                          setEditingIntegration({ ...editingIntegration, webhookUrl: e.target.value })
                        }
                        placeholder="https://api.example.com/webhook?title={title}"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-hover text-gray-900 dark:text-dark-text placeholder-gray-400 dark:placeholder-dark-text-secondary focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                      />
                    </div>

                    {editingIntegration.webhookMethod === 'POST' && (
                      <div>
                        <label className="block text-sm text-gray-600 dark:text-dark-text-secondary mb-1">
                          请求体 (JSON)
                        </label>
                        <textarea
                          value={editingIntegration.webhookBody || ''}
                          onChange={(e) =>
                            setEditingIntegration({ ...editingIntegration, webhookBody: e.target.value })
                          }
                          placeholder={`{\n  "title": "{{ title }}",\n  "url": "{{ url }}"\n}`}
                          rows={5}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-dark-border rounded-lg bg-white dark:bg-dark-hover text-gray-900 dark:text-dark-text placeholder-gray-400 dark:placeholder-dark-text-secondary focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                        />
                      </div>
                    )}
                  </>
                )}

                {/* 变量说明 */}
                <div className="bg-gray-50 dark:bg-dark-hover rounded-lg p-3 space-y-3">
                  <div>
                    <div className="text-xs font-medium text-gray-600 dark:text-dark-text-secondary mb-1.5">
                      基础变量（自动 URL 编码）：
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <code className="px-2 py-0.5 bg-gray-200 dark:bg-dark-border rounded text-xs text-gray-700 dark:text-dark-text">
                        {'{{ url }}'}
                      </code>
                      <span className="text-xs text-gray-500 dark:text-dark-text-secondary">原文链接</span>
                      <code className="px-2 py-0.5 bg-gray-200 dark:bg-dark-border rounded text-xs text-gray-700 dark:text-dark-text ml-2">
                        {'{{ title }}'}
                      </code>
                      <span className="text-xs text-gray-500 dark:text-dark-text-secondary">文章标题</span>
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-xs font-medium text-gray-600 dark:text-dark-text-secondary mb-1.5">
                      高级语法（支持过滤器）：
                    </div>
                    <div className="space-y-1 text-xs text-gray-500 dark:text-dark-text-secondary">
                      <div><code className="bg-gray-200 dark:bg-dark-border px-1 rounded">{'{{ title | regex:\'pattern\':0 }}'}</code> 正则提取</div>
                      <div><code className="bg-gray-200 dark:bg-dark-border px-1 rounded">{'{{ title | replace:\'pattern\':\'new\' }}'}</code> 正则替换</div>
                      <div><code className="bg-gray-200 dark:bg-dark-border px-1 rounded">{'{{ title | split:\'-\':0 }}'}</code> 分割取值</div>
                      <div><code className="bg-gray-200 dark:bg-dark-border px-1 rounded">{'{{ title | truncate:50 }}'}</code> 截断</div>
                      <div><code className="bg-gray-200 dark:bg-dark-border px-1 rounded">{'{{ title | lower | urlencode }}'}</code> 链式过滤器</div>
                    </div>
                    <div className="mt-1.5 text-xs text-gray-400 dark:text-dark-text-secondary">
                      更多过滤器：upper, trim, number, default, base64, json, raw
                    </div>
                  </div>
                </div>

                {/* ID 显示 */}
                {!isCreating && (
                  <div className="text-xs text-gray-400 dark:text-dark-text-secondary">
                    ID: <code className="font-mono">{editingIntegration.id}</code>
                  </div>
                )}

                {/* 操作按钮 */}
                <div className="flex items-center justify-between pt-2">
                  <div>
                    {!isCreating && (
                      <button
                        onClick={() => handleDelete(editingIntegration.id)}
                        className="text-sm text-red-500 hover:text-red-600"
                      >
                        删除
                      </button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleCancelEdit}
                      className="px-4 py-2 text-gray-700 dark:text-dark-text hover:bg-gray-100 dark:hover:bg-dark-hover rounded-lg transition"
                    >
                      取消
                    </button>
                    <button
                      onClick={handleSaveIntegration}
                      className="px-4 py-2 bg-gray-700 dark:bg-dark-border text-white rounded-lg hover:bg-gray-800 dark:hover:bg-gray-600 transition"
                    >
                      保存
                    </button>
                  </div>
                </div>
              </div>
            </section>
          )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// 导出异步获取函数供其他组件使用
export async function getCustomIntegrationsAsync(): Promise<CustomIntegration[]> {
  return api.getIntegrations();
}

// ==================== 模板引擎 ====================

/**
 * 内置过滤器
 * 支持类似 Jinja 的语法: {{ variable | filter1 | filter2(arg) }}
 */
const templateFilters: Record<string, (value: string, ...args: string[]) => string> = {
  // 正则提取
  regex: (value: string, pattern: string, group?: string) => {
    try {
      const regex = new RegExp(pattern);
      const match = value.match(regex);
      if (!match) return value;
      const groupIndex = group ? parseInt(group, 10) : 0;
      return match[groupIndex] ?? value;
    } catch {
      return value;
    }
  },
  
  // 正则替换
  replace: (value: string, pattern: string, replacement: string = '') => {
    try {
      const regex = new RegExp(pattern, 'g');
      return value.replace(regex, replacement);
    } catch {
      return value;
    }
  },
  
  // 截取前 N 个字符
  truncate: (value: string, length: string, suffix: string = '...') => {
    const len = parseInt(length, 10);
    if (value.length <= len) return value;
    return value.slice(0, len) + suffix;
  },
  
  // 转小写
  lower: (value: string) => value.toLowerCase(),
  
  // 转大写
  upper: (value: string) => value.toUpperCase(),
  
  // 去除首尾空白
  trim: (value: string) => value.trim(),
  
  // URL 编码
  urlencode: (value: string) => encodeURIComponent(value),
  
  // 不编码（原样输出）
  raw: (value: string) => value,
  
  // 提取第一个匹配的数字
  number: (value: string) => {
    const match = value.match(/\d+/);
    return match ? match[0] : '';
  },
  
  // 分割后取指定索引
  split: (value: string, separator: string, index: string = '0') => {
    const parts = value.split(separator);
    const idx = parseInt(index, 10);
    return parts[idx] ?? value;
  },
  
  // 默认值（当值为空时使用）
  default: (value: string, defaultValue: string) => {
    return value || defaultValue;
  },
  
  // Base64 编码
  base64: (value: string) => {
    try {
      return btoa(unescape(encodeURIComponent(value)));
    } catch {
      return value;
    }
  },
  
  // JSON 字符串转义（用于嵌入 JSON）
  json: (value: string) => {
    return JSON.stringify(value).slice(1, -1); // 去掉首尾引号
  },
};

/**
 * 解析过滤器调用，支持带参数的过滤器
 * 例如: "regex('[A-Z]+', 0)" -> { name: 'regex', args: ['[A-Z]+', '0'] }
 */
function parseFilter(filterStr: string): { name: string; args: string[] } {
  const match = filterStr.match(/^(\w+)(?:\((.+)\))?$/);
  if (!match) {
    return { name: filterStr.trim(), args: [] };
  }
  
  const name = match[1];
  const argsStr = match[2];
  
  if (!argsStr) {
    return { name, args: [] };
  }
  
  // 解析参数，支持引号内的逗号
  const args: string[] = [];
  let current = '';
  let inQuote = false;
  let quoteChar = '';
  
  for (let i = 0; i < argsStr.length; i++) {
    const char = argsStr[i];
    
    if (!inQuote && (char === '"' || char === "'")) {
      inQuote = true;
      quoteChar = char;
    } else if (inQuote && char === quoteChar) {
      inQuote = false;
      quoteChar = '';
    } else if (!inQuote && char === ',') {
      args.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  if (current.trim()) {
    args.push(current.trim());
  }
  
  // 去除参数的引号
  return {
    name,
    args: args.map(arg => {
      if ((arg.startsWith('"') && arg.endsWith('"')) || 
          (arg.startsWith("'") && arg.endsWith("'"))) {
        return arg.slice(1, -1);
      }
      return arg;
    }),
  };
}

/**
 * 处理模板字符串
 * 语法: {{ variable }} 或 {{ variable | filter1 | filter2 }}
 * 示例:
 * - {{ url }} - 简单变量（自动 URL 编码）
 * - {{ title | truncate:50 }} - 带过滤器
 * - {{ title | regex:'pattern':'replacement' | urlencode }} - 过滤器链
 */
function processTemplate(template: string, variables: Record<string, string>, autoEncode: boolean = true): string {
  // 处理 {{ variable }} 或 {{ variable | filter1 | filter2 }} 语法
  return template.replace(/\{\{\s*(\w+)((?:\s*\|\s*[^}]+)*)\s*\}\}/g, (_, varName, filterChain) => {
    let value = variables[varName] ?? '';
    
    if (filterChain && filterChain.trim()) {
      // 解析过滤器链
      const filters = filterChain.split('|').slice(1).map((f: string) => f.trim());
      
      for (const filterStr of filters) {
        const { name, args } = parseFilter(filterStr);
        const filterFn = templateFilters[name];
        
        if (filterFn) {
          value = filterFn(value, ...args);
        }
      }
    } else if (autoEncode) {
      // 简单变量且需要自动编码
      value = encodeURIComponent(value);
    }
    
    return value;
  });
}

// 执行集成动作
export async function executeIntegration(
  integration: CustomIntegration,
  variables: { url: string; title: string }
): Promise<{ success: boolean; message?: string; response?: unknown }> {
  try {
    if (integration.type === 'url') {
      // URL 跳转 - 简单变量自动 URL 编码
      const url = processTemplate(integration.url || '', variables, true);
      window.open(url, '_blank');
      return { success: true };
    } else if (integration.type === 'webhook') {
      // Webhook URL - 简单变量自动 URL 编码
      const url = processTemplate(integration.webhookUrl || '', variables, true);
      
      let response: Response;
      
      if (integration.webhookMethod === 'GET') {
        response = await fetch(url, { method: 'GET' });
      } else {
        // POST 请求体 - 简单变量不自动编码（JSON 中通常不需要）
        const body = processTemplate(integration.webhookBody || '{}', variables, false);
        
        response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        });
      }
      
      // 尝试解析响应
      let responseData: unknown = null;
      try {
        const text = await response.text();
        try {
          responseData = JSON.parse(text);
        } catch {
          responseData = text;
        }
      } catch {
        // 忽略响应解析错误
      }
      
      if (response.ok) {
        return { success: true, response: responseData };
      } else {
        return { 
          success: false, 
          message: `HTTP ${response.status}: ${response.statusText}`,
          response: responseData 
        };
      }
    }
    return { success: false, message: '未知的集成类型' };
  } catch (error) {
    console.error('Integration execution failed:', error);
    return { success: false, message: String(error) };
  }
}
