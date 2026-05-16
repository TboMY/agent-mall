# 热榜获取 API 接口文档

## 1. 接口概述

该接口用于获取不同平台的热榜数据，例如抖音热搜榜、哔哩哔哩全站日榜等。

接口通过 `type` 参数区分不同平台或榜单类型。

---

## 2. 接口信息

| 项目 | 内容 |
|---|---|
| 接口名称 | 热榜获取接口 |
| 请求地址 | `https://api.98dou.cn/api/hotlist` |
| 请求方式 | `GET` |
| 返回格式 | `JSON` |
| 是否需要登录 | 否 |
| 是否需要鉴权 | 否 |

---

## 3. 请求参数

| 参数名 | 类型 | 是否必填 | 示例值 | 说明 |
|---|---|---|---|---|
| type | string | 是 | `douyin` | 榜单类型，用于指定要获取的平台热榜；可选值见下方“type 可选值” |

---

## 4. type 可选值

`type` 参数用于指定要获取的热榜类型。

| type 值 | 榜单说明 | 示例接口 |
|---|---|---|
| baidu | 百度热搜 | `https://api.98dou.cn/api/hotlist?type=baidu` |
| weibo | 微博热搜 | `https://api.98dou.cn/api/hotlist?type=weibo` |
| sspai | 少数派热榜 | `https://api.98dou.cn/api/hotlist?type=sspai` |
| csdn | CSDN 全站综合热榜 | `https://api.98dou.cn/api/hotlist?type=csdn` |
| history | 百度百科历史上的今天 | `https://api.98dou.cn/api/hotlist?type=history` |
| douyin | 抖音热搜榜 | `https://api.98dou.cn/api/hotlist?type=douyin` |
| biliall | 哔哩哔哩全站日榜 | `https://api.98dou.cn/api/hotlist?type=biliall` |
| bilihot | 哔哩哔哩热搜榜 | `https://api.98dou.cn/api/hotlist?type=bilihot` |
| sogou | 搜狗热榜 | `https://api.98dou.cn/api/hotlist?type=sogou` |
| sohu | 搜狐热榜新闻 | `https://api.98dou.cn/api/hotlist?type=sohu` |
| toutiao | 今日头条热榜 | `https://api.98dou.cn/api/hotlist?type=toutiao` |
| acfun | ACFUN 弹幕网热榜 | `https://api.98dou.cn/api/hotlist?type=acfun` |
| ker | 安全客 KER 快讯 | `https://api.98dou.cn/api/hotlist?type=ker` |
| dongqiudi | 懂球帝热榜 | `https://api.98dou.cn/api/hotlist?type=dongqiudi` |
| ifanr | 爱范儿快讯 | `https://api.98dou.cn/api/hotlist?type=ifanr` |
| juejin | 稀土掘金文章榜 | `https://api.98dou.cn/api/hotlist?type=juejin` |
| netease_news | 网易新闻热点榜 | `https://api.98dou.cn/api/hotlist?type=netease_news` |
| 51cto | 51CTO 推荐榜 | `https://api.98dou.cn/api/hotlist?type=51cto` |
| github | GitHub 趋势榜 | `https://api.98dou.cn/api/hotlist?type=github` |
| zhihu | 知乎热榜 | `https://api.98dou.cn/api/hotlist?type=zhihu` |

---

## 5. 请求示例

### 5.1 获取抖音热搜榜

```http
GET https://api.98dou.cn/api/hotlist?type=douyin
```

### 5.2 获取哔哩哔哩全站日榜

```http
GET https://api.98dou.cn/api/hotlist?type=biliall
```

---

## 6. 返回参数说明

### 6.1 通用返回字段

| 字段名 | 类型 | 示例值 | 说明 |
|---|---|---|---|
| success | boolean | `true` | 请求是否成功 |
| msg | string | `抖音热搜榜请求成功` | 接口返回提示信息 |
| title | string | `抖音` | 榜单所属平台名称 |
| subtitle | string | `热搜榜` | 榜单名称 |
| update_time | string | `2026-05-08 09:25:19` | 数据更新时间 |
| total | number | `50` | 返回的数据总条数 |
| data | array | `[...]` | 热榜数据列表 |

---

## 7. data 数组字段说明

### 7.1 抖音热搜榜 data 字段

适用于：

```http
GET https://api.98dou.cn/api/hotlist?type=douyin
```

| 字段名 | 类型 | 示例值 | 说明 |
|---|---|---|---|
| index | number | `1` | 排名 |
| title | string | `夏天开始的瞬间` | 热榜标题 |
| hot | string | `1160万` | 热度值 |
| url | string | `https://www.douyin.com/search/...` | PC 端跳转地址 |
| mobilUrl | string | `https://www.douyin.com/search/...` | 移动端跳转地址 |

---

### 7.2 哔哩哔哩全站日榜 data 字段

适用于：

```http
GET https://api.98dou.cn/api/hotlist?type=biliall
```

| 字段名 | 类型 | 示例值 | 说明 |
|---|---|---|---|
| index | number | `1` | 排名 |
| title | string | `《鸣潮》×《赛博朋克：边缘行者》联动预告｜早上好，索拉里斯！` | 视频标题 |
| pic | string | `http://i2.hdslb.com/bfs/archive/xxx.jpg` | 视频封面图片地址 |
| desc | string | `和我一起，坠入永不醒来的幻梦中吧。` | 视频简介 |
| hot | string | `375.1万` | 热度值 |
| url | string | `https://b23.tv/BV1tbRhBKEWb` | PC 端跳转地址 |
| mobilUrl | string | `https://b23.tv/BV1tbRhBKEWb` | 移动端跳转地址 |

---

## 8. 返回示例

### 8.1 抖音热搜榜返回示例

```json
{
  "success": true,
  "msg": "抖音热搜榜请求成功",
  "title": "抖音",
  "subtitle": "热搜榜",
  "update_time": "2026-05-08 09:25:19",
  "total": 50,
  "data": [
    {
      "index": 1,
      "title": "夏天开始的瞬间",
      "hot": "1160万",
      "url": "https://www.douyin.com/search/%E5%A4%8F%E5%A4%A9%E5%BC%80%E5%A7%8B%E7%9A%84%E7%9E%AC%E9%97%B4",
      "mobilUrl": "https://www.douyin.com/search/%E5%A4%8F%E5%A4%A9%E5%BC%80%E5%A7%8B%E7%9A%84%E7%9E%AC%E9%97%B4"
    }
  ]
}
```

---

### 8.2 哔哩哔哩全站日榜返回示例

```json
{
  "success": true,
  "msg": "哔哩哔哩全站日榜请求成功",
  "title": "哔哩哔哩",
  "subtitle": "全站日榜",
  "update_time": "2026-05-08 09:27:15",
  "total": 100,
  "data": [
    {
      "index": 1,
      "title": "《鸣潮》×《赛博朋克：边缘行者》联动预告｜早上好，索拉里斯！",
      "pic": "http://i2.hdslb.com/bfs/archive/c512da66a0e1e2a7b044acdf592bd7f3f52f0f15.jpg",
      "desc": "和我一起，坠入永不醒来的幻梦中吧。《鸣潮》× 《赛博朋克：边缘行者》联动即将开启！",
      "hot": "375.1万",
      "url": "https://b23.tv/BV1tbRhBKEWb",
      "mobilUrl": "https://b23.tv/BV1tbRhBKEWb"
    }
  ]
}
```

---

## 9. 成功响应说明

当接口请求成功时，`success` 字段为 `true`。

示例：

```json
{
  "success": true,
  "msg": "抖音热搜榜请求成功"
}
```

---

## 10. 字段差异说明

不同 `type` 返回的 `data` 数据结构可能略有差异。

| type | 是否包含 pic | 是否包含 desc | 说明 |
|---|---|---|---|
| douyin | 否 | 否 | 抖音热搜榜主要返回标题、热度和跳转链接 |
| biliall | 是 | 是 | B 站全站日榜会额外返回视频封面和视频简介 |

---

## 11. 注意事项

1. `type` 参数决定返回的榜单类型。
2. 不同榜单的 `data` 内部字段可能不完全一致，开发时需要做兼容处理。
3. `hot` 字段为字符串类型，例如 `1160万`、`375.1万`，不建议直接按数字处理。
4. `url` 和 `mobilUrl` 通常都表示跳转地址，但具体是否区分 PC 和移动端，以实际返回为准。
5. `update_time` 表示接口数据更新时间，不一定等于请求时间。

---

## 12. 简单调用示例

### JavaScript fetch 示例

```javascript
fetch("https://api.98dou.cn/api/hotlist?type=douyin")
  .then(response => response.json())
  .then(data => {
    console.log(data.title);
    console.log(data.subtitle);
    console.log(data.data);
  })
  .catch(error => {
    console.error("请求失败：", error);
  });
```

---

## 13. 推荐前端展示字段

### 抖音热搜榜

| 展示字段 | 对应字段 |
|---|---|
| 排名 | index |
| 标题 | title |
| 热度 | hot |
| 跳转链接 | url 或 mobilUrl |

### 哔哩哔哩全站日榜

| 展示字段 | 对应字段 |
|---|---|
| 排名 | index |
| 视频标题 | title |
| 视频封面 | pic |
| 视频简介 | desc |
| 热度 | hot |
| 跳转链接 | url 或 mobilUrl |
