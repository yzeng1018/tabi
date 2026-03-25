# tabi — AI 订票助手 设计文档

**日期：** 2026-03-25
**状态：** 已批准

---

## 背景 & 决策

现有 trip-agent 专注于 AI 行程规划，但该赛道已被 Claude、ChatGPT、豆包等大模型产品覆盖。战略转向：放弃行程规划，聚焦订票，打造 AI 订票助手 **tabi**。

tabi 的商业逻辑清晰：通过携程/飞猪联盟深链导流，从机票和酒店预订中赚取联盟佣金。

**新建独立仓库，不继承 trip-agent 代码。**

---

## 产品定位

- **核心体验：** AI 顾问模式——主动发起对话，问清用户需求，推荐最优机票+酒店组合，用户确认后跳转到 OTA 平台完成预订。
- **目标用户：** 中国用户，主要预订国内及出境游机票+酒店。
- **对接平台：** 携程、飞猪（短期）；Booking.com（可选扩展）。

---

## 三阶段路线图

| 阶段 | 能力 | 说明 |
|------|------|------|
| 短期（MVP） | 深链跳转 | AI 收集需求 → 生成预填参数的携程/飞猪深链 → 跳转 |
| 中期 | 实时价格查询 | 接入机票/酒店 API，在 tabi 内展示比价结果 |
| 长期 | 代理下单 | 用户在 tabi 内直接支付，tabi 作为订单中间层 |

本文档聚焦短期 MVP。

---

## 架构

**技术栈：** Next.js 16 + TypeScript + Tailwind v4，AI 用 Qwen（DashScope），部署在 Vercel。

**核心数据流：**

```
用户输入 → AI 对话（多轮）→ 需求结构化 → 生成推荐卡 → 深链跳转
```

**两个核心状态：**

- `collecting` — AI 通过对话收集旅行需求
- `recommending` — 需求收集完毕，展示推荐卡 + 深链

**目录结构：**

```
app/
  page.tsx            # 对话主页
  api/chat/route.ts   # AI 对话 API（streaming）
lib/
  ai.ts               # AI 调用 + 系统提示词
  booking.ts          # 深链生成（携程/飞猪/Booking.com）+ 城市→IATA 映射表
  types.ts            # TripRequirements、RecommendationCard 等类型
components/
  ChatWindow.tsx      # 对话界面
  RecommendCard.tsx   # 推荐卡（机票+酒店）
```

---

## AI 对话逻辑

### 角色设定

tabi 是中文旅行订票顾问，风格主动、简洁，每次只问一个问题，不废话。

### 需求字段

MVP 仅支持**往返程**（round-trip），不支持单程。

| 字段 | TypeScript 字段名 | 示例 | 必填 |
|------|-----------------|------|------|
| 出发地 | `origin` | 上海 | ✓ |
| 目的地 | `destination` | 大阪 | ✓ |
| 出发日期 | `departDate` | 2026-04-25（ISO 8601） | ✓ |
| 返回日期 | `returnDate` | 2026-04-30（ISO 8601） | ✓ |
| 成人人数 | `adults` | 2 | ✓ |
| 预算（元） | `budget` | 8000 | 可选 |
| 偏好 | `preferences` | 靠近景区、要早班机 | 可选 |

**触发推荐的条件：** 5个必填字段全部收集后，AI 切换到推荐模式。

**修改需求：** 用户在推荐卡展示后说"改去东京""换成5月"等，状态重置回 `collecting`，客户端用修改后的字段更新 `TripRequirements`，AI 重新追问剩余字段（若有）或直接重新推荐。

### 核心类型定义

```typescript
// lib/types.ts

interface TripRequirements {
  origin: string;          // 城市名，如"上海"
  destination: string;     // 城市名，如"大阪"
  departDate: string;      // ISO 8601，如"2026-04-25"
  returnDate: string;      // ISO 8601，如"2026-04-30"
  adults: number;
  budget?: number;         // CNY，可选
  preferences?: string;    // 自由文本，可选
}

interface RecommendationCard {
  flight: {
    from: string;
    to: string;
    departDate: string;
    returnDate: string;
    cabin: string;         // 如"经济舱"
  };
  hotel: {
    city: string;
    checkin: string;
    checkout: string;
    stars: number;
  };
  summary: string;
  // cabin 字段由 AI 输出中文显示名（如"经济舱"），booking.ts 负责映射到 IATA 舱位代码：
  // 经济舱→Y, 商务舱→C, 头等舱→F
  links: {
    flight: string;        // 携程机票深链
    hotel: string;         // 携程酒店深链
  };
}
```

### 状态管理

- `TripRequirements` 由客户端维护，每轮请求随消息体一起发送给后端（适配 Vercel 无状态 serverless 环境，不依赖服务端 session）
- System prompt 中注入已知字段，AI 继续追问缺失字段
- 必填字段齐全后，AI 输出结构化推荐 JSON

### 推荐 JSON 交付协议

当需求收集完毕时，AI **仅输出一个 JSON 代码块，不含任何前置文字**：

```json
{
  "flight": {
    "from": "上海",
    "to": "大阪",
    "departDate": "2026-04-25",
    "returnDate": "2026-04-30",
    "cabin": "经济舱"
  },
  "hotel": {
    "city": "大阪",
    "checkin": "2026-04-25",
    "checkout": "2026-04-30",
    "stars": 4
  },
  "summary": "推荐早班直飞+道顿堀附近4星酒店，性价比最高"
}
```

客户端用 `raw.search(/\{\s*"/)` 在流式响应中定位 JSON 起始（不锚定字符串开头，以容忍 LLM 偶发前置文字），解析失败时先尝试 `jsonrepair`，仍失败则降级为纯文字回复。

**数据流分层：** AI 输出的 JSON 由 `app/api/chat/route.ts` 后端解析，调用 `booking.ts` 生成深链并注入 `links` 字段，再将完整的 `RecommendationCard` 返回给前端。前端不直接调用 `booking.ts`，城市→IATA 映射逻辑只存在于服务端。

### 城市 → IATA 映射

`booking.ts` 内置城市名到 IATA 机场代码的映射表（MVP 覆盖主要出发城市）：

```typescript
const CITY_TO_IATA: Record<string, string> = {
  "上海": "SHA",   // 虹桥；如需浦东可扩展为 PVG
  "北京": "PEK",
  "广州": "CAN",
  "成都": "CTU",
  "深圳": "SZX",
  // 目的地（日韩东南亚热门）
  "大阪": "KIX",
  "东京": "NRT",
  "首尔": "ICN",
  "曼谷": "BKK",
  "新加坡": "SIN",
};
```

城市名无法匹配时，直接将城市名传入深链（OTA 平台支持模糊搜索作为兜底）。

---

## 深链格式参考

### 携程机票（国际，城市名直接传参，无需 IATA）

```
https://flights.ctrip.com/international/search/oneway
  ?adult={adults}
  &cabin=y
  &dcity={origin}        // 出发城市名，encodeURIComponent
  &acity={destination}   // 目的地城市名，encodeURIComponent
  &date={departDateYYYYMMDD}
```

示例：上海→大阪，2026-04-25 出发，2大人：
```
https://flights.ctrip.com/international/search/oneway?adult=2&cabin=y&dcity=%E4%B8%8A%E6%B5%B7&acity=%E5%A4%A7%E9%98%AA&date=20260425
```

> **说明：**
> - 此格式使用城市名（非 IATA 代码），OTA 端自动匹配机场，无需 `CITY_TO_IATA` 映射
> - MVP 使用单程链接（oneway），返程链接由用户在携程落地页另搜，或未来迭代时添加 `retdate` 参数
> - `cabin=y` 使用小写（与现有 booking.ts 保持一致）
> - `CITY_TO_IATA` 映射表**仅供未来中期阶段接入真实机票 API 时使用**，MVP 不需要

### 携程国内机票

```
https://m.ctrip.com/webapp/flights/domestic/
  ?adult={adults}
  &fromCity={origin}
  &toCity={destination}
  &departDate={departDate}   // YYYY-MM-DD
```

### 携程酒店

```
https://m.ctrip.com/webapp/hotel/list/
  ?city={destination}
  &checkin={checkin}         // YYYY-MM-DD
  &checkout={checkout}       // YYYY-MM-DD
  &adult={adults}
```

> **注意：** 携程酒店深链不支持通过 URL 参数直接过滤星级，星级偏好由 AI 在推荐卡的 `summary` 文字中体现（如"推荐4星酒店"），用户在携程落地页自行筛选。

---

## UI / 交互

### 主页（对话页）

- 全屏对话界面，移动端优先
- 顶部：tabi logo + tagline（"说说你想去哪"）
- 中间：消息气泡流，AI 先发话（"你好，我是 tabi，你想去哪里旅行？"）
- 底部：固定输入框 + 发送按钮

### 推荐卡

- 卡片式，一屏展示机票 + 酒店两块
- 机票区：出发地 → 目的地、出发/返回日期、舱位
- 酒店区：城市、入住/退房日期、星级
- 两个 CTA：「查机票」「查酒店」（分别跳转携程深链）
- 底部文字：「不满意？告诉我调整哪里」——可继续对话重新推荐

### 交互细节

- AI 打字时显示 loading 气泡（三点动画）
- 推荐卡出现时有轻微滑入动画
- 移动端 `viewport` 处理：输入框聚焦时不被键盘顶飞

---

## 错误处理

| 场景 | 处理方式 |
|------|---------|
| AI 接口超时/失败 | 显示"网络开小差了，再试一次？"，保留对话上下文 |
| 推荐 JSON 解析失败 | 用 `jsonrepair` 尝试修复；仍失败则降级为纯文字回复 |
| 城市名无法匹配 IATA | 直接传城市名入深链，OTA 模糊搜索兜底 |
| 用户输入模糊（"随便""不知道"）| AI 追问引导，不强制要求格式 |

---

## 测试策略（MVP 阶段）

- 手动测试典型对话路径：完整需求、模糊需求、中途修改需求
- 验证深链参数正确性（手动点击检查 OTA 落地页）
- 不写单元测试，上线后用真实用户反馈驱动迭代

---

## 超出 MVP 范围（不做）

- 行程规划
- 单程机票支持（MVP 仅往返）
- 实时价格查询（中期再做）
- 用户账号系统
- 订单管理
