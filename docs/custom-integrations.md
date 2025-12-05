# 自定义扩展使用说明

RSS Gallery 支持自定义扩展功能，允许你将 RSS 条目快速发送到第三方服务，或通过 URL 跳转实现快捷操作。

## 功能概述

自定义扩展支持两种类型：

| 类型 | 说明 | 用途示例 |
|------|------|----------|
| **URL 跳转** | 在新标签页打开自定义 URL | 在 Google 搜索标题、发送到 Obsidian |
| **Webhook** | 向指定接口发送 HTTP 请求 | 发送到 Telegram、保存到 Notion |

## 快速开始

### 1. 打开扩展

点击页面右上角的设置按钮，进入「扩展」面板。

### 2. 创建自定义扩展

点击「新建」按钮，填写：

- **名称**：扩展的显示名称
- **图标**：选择一个图标
- **类型**：选择 URL 跳转或 Webhook
- **URL/接口地址**：填写目标地址，可使用变量

### 3. 在 Feed 中启用

在添加或编辑 Feed 时，可以选择该 Feed 启用哪些扩展。只有被勾选的扩展才会显示在该 Feed 条目的工具栏中。

## 模板变量

在 URL 或请求体中可以使用以下变量：

| 变量 | 说明 |
|------|------|
| `{{ url }}` | 原文链接（自动 URL 编码） |
| `{{ title }}` | 文章标题（自动 URL 编码） |

### 基础用法

```
https://www.google.com/search?q={{ title }}
```

变量会自动进行 URL 编码，确保特殊字符被正确处理。

## 高级过滤器

模板支持类似 Jinja 的过滤器语法，可以对变量值进行处理：

```
{{ variable | filter1 | filter2 }}
```

### 可用过滤器

| 过滤器 | 语法 | 说明 | 示例 |
|--------|------|------|------|
| `regex` | `regex:'pattern':group` | 正则提取 | `{{ title \| regex:'\\d+':0 }}` |
| `replace` | `replace:'pattern':'new'` | 正则替换 | `{{ title \| replace:'\\s+':'-' }}` |
| `split` | `split:'separator':index` | 分割取值 | `{{ title \| split:'-':0 }}` |
| `truncate` | `truncate:length` | 截断字符 | `{{ title \| truncate:50 }}` |
| `lower` | `lower` | 转小写 | `{{ title \| lower }}` |
| `upper` | `upper` | 转大写 | `{{ title \| upper }}` |
| `trim` | `trim` | 去除首尾空白 | `{{ title \| trim }}` |
| `urlencode` | `urlencode` | URL 编码 | `{{ title \| urlencode }}` |
| `raw` | `raw` | 不编码（原样输出） | `{{ url \| raw }}` |
| `number` | `number` | 提取第一个数字 | `{{ title \| number }}` |
| `default` | `default:'value'` | 默认值 | `{{ title \| default:'无标题' }}` |
| `base64` | `base64` | Base64 编码 | `{{ title \| base64 }}` |
| `json` | `json` | JSON 字符串转义 | `{{ title \| json }}` |

### 过滤器链

多个过滤器可以链式调用：

```
{{ title | lower | replace:' ':'-' | truncate:30 }}
```

## 配置示例

### URL 跳转示例

#### Google 搜索

```
https://www.google.com/search?q={{ title }}
```

#### 在 Twitter/X 分享

```
https://twitter.com/intent/tweet?text={{ title }}&url={{ url }}
```

#### 保存到 Pocket

```
https://getpocket.com/save?url={{ url }}&title={{ title }}
```

#### 发送到 Obsidian

```
obsidian://new?vault=MyVault&name={{ title | replace:'/':'-' }}&content={{ url }}
```

### Webhook 示例

#### 发送到 Telegram Bot

**方法**: POST  
**URL**: 
```
https://api.telegram.org/bot<YOUR_BOT_TOKEN>/sendMessage
```

**请求体**:
```json
{
  "chat_id": "YOUR_CHAT_ID",
  "text": "{{ title }}\n\n{{ url | raw }}",
  "parse_mode": "HTML"
}
```

#### 保存到 Notion

**方法**: POST  
**URL**: 
```
https://api.notion.com/v1/pages
```

**请求头**: 需要在服务端配置 Authorization  

**请求体**:
```json
{
  "parent": { "database_id": "YOUR_DATABASE_ID" },
  "properties": {
    "Name": {
      "title": [{ "text": { "content": "{{ title | json }}" } }]
    },
    "URL": {
      "url": "{{ url | raw }}"
    }
  }
}
```

#### 发送到自定义 API

**方法**: POST  
**URL**: 
```
https://your-api.com/save
```

**请求体**:
```json
{
  "title": "{{ title | json }}",
  "link": "{{ url | raw }}",
  "source": "rss-gallery"
}
```

## 使用技巧

### 1. 使用 `raw` 过滤器

在 JSON 请求体中的 URL 字段，使用 `{{ url | raw }}` 避免重复编码：

```json
{
  "link": "{{ url | raw }}"
}
```

### 2. 使用 `json` 过滤器

在 JSON 中嵌入文本时，使用 `json` 过滤器确保特殊字符被正确转义：

```json
{
  "title": "{{ title | json }}"
}
```

### 3. 正则提取

从标题中提取信息：

```
{{ title | regex:'\\[(.+?)\\]':1 }}  # 提取方括号内容
{{ title | regex:'(\\d{4})':1 }}     # 提取年份
```

### 4. 组合过滤器

```
{{ title | replace:'[^a-zA-Z0-9]':'-' | lower | truncate:50 }}
```

这个示例将：
1. 替换非字母数字字符为连字符
2. 转为小写
3. 截断到 50 个字符

## 按 Feed 启用扩展

每个 Feed 可以独立控制启用哪些扩展：

1. 在「添加 Feed」或「编辑 Feed」对话框中
2. 找到「启用的扩展」部分
3. 勾选需要启用的扩展

未勾选的扩展不会出现在该 Feed 条目的工具栏中。

## 执行历史

在扩展面板的「执行历史」标签页中，可以查看：

- 最近的扩展执行记录
- 执行成功/失败状态
- 错误详情（用于调试）

## 常见问题

### Q: 为什么 Webhook 请求失败？

1. 检查目标服务器是否允许跨域请求（CORS）
2. 检查请求体 JSON 格式是否正确
3. 查看「执行历史」中的错误详情

### Q: 如何处理包含特殊字符的标题？

使用 `json` 过滤器进行转义：
```json
{ "title": "{{ title | json }}" }
```

### Q: URL 跳转时出现编码问题？

- 默认情况下变量会自动 URL 编码
- 如果已经是 URL 格式，使用 `{{ url | raw }}` 避免重复编码

### Q: 如何在多个 Feed 使用相同的扩展配置？

扩展配置是全局的，在创建后可以在任意 Feed 中启用。每个 Feed 只需选择要启用的扩展即可。
