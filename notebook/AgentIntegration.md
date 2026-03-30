## 代码库扫描：AI Agent 如何用「会话」与网页交互（WebSocket / SSE）

下面按 **端到端链路** 写清楚：前端如何建立会话、如何连 Socket.IO、后端如何按 session 进房间并向浏览器推送 UI 操作，以及流式（SSE）如何补位。

---

## 前端：会话与连接（浏览器侧）

### 1) 两种“会话 ID”含义不同（很关键）

- **`auth session_id`（登录态）**  
  - 来源：登录后后端发 `sd_session_id` cookie（`AuthProvider` 也会在前端设置 cookie）。  
  - 用途：鉴权、用户资料、购物车、对话历史持久化。  
  - 相关代码：
    - `frontend/src/lib/auth-context.tsx`：读写 `sd_session_id` cookie；用 `session-id` header 调 `/auth/me`、`/auth/logout`。
- **`chatSessionId`（聊天/Agent 会话）**  
  - 来源：前端本地 `crypto.randomUUID()`，按用户邮箱或匿名存 localStorage。  
  - 用途：**Socket.IO 房间号**、Agent 推 UI action 的目标、RAG 记忆向量的 `ws_session_id`。  
  - 相关代码：
    - `frontend/src/lib/convo-context.tsx`：`chatSessionId` 生成与持久化（每个用户一个）。

> 当前实现中，**WebSocket 的 join_room 用的是 `chatSessionId`**（不是登录 cookie 的 session_id）。

### 2) Socket.IO 连接与“按 session 加入房间”

- `frontend/src/lib/socket-context.tsx`
  - 连接后执行：
    - `socket.emit('join_session', { session_id: sessionId })`
  - 这里的 `sessionId` = `chatSessionId`（见 `SocketBridge`）。

对应关键代码引用：

```79:97:frontend/src/lib/socket-context.tsx
socket.on('connect', () => {
  setConnected(true);
  // Join the session-specific room
  socket.emit('join_session', { session_id: sessionId });
});

/** Backend agent is controlling the frontend UI. */
socket.on('ui_action', (action: UiAction) => {
  console.info('[socket] ui_action received:', action);
  setLastUiAction(action);
});
```

### 3) 执行 AI 推送的 UI 操作（路由/筛选/搜索）

- `frontend/src/main.tsx` 的 `UiActionExecutor`
  - 消费 `lastUiAction`，根据 `action` 做：
    - `select_category` / `apply_filter` / `select_sidebar`：写入 `useShop()` 的 `gender/category` 并 `navigate('/shop')`
    - `set_search_hint`：写入搜索框并 `navigate('/shop')`
    - `open_product`：跳转商品详情

对应关键代码引用：

```71:106:frontend/src/main.tsx
case 'apply_filter':
case 'select_sidebar':
case 'select_category': {
  // Agent sets sidebar tags; empty string clears (must use `in` — falsy values still apply).
  const f = payload as { gender?: string; category?: string };
  if ('gender' in f) setGender(f.gender ?? '');
  if ('category' in f) setCategory(f.category ?? '');
  if (location.pathname !== '/shop') navigate('/shop');
  break;
}
case 'set_search_hint':
  if (typeof payload.query === 'string') {
    setInputValue(payload.query);
    setQuery(payload.query);
    if (location.pathname !== '/shop') navigate('/shop');
  }
  break;
```

### 4) SSE（`/chat/stream`）也会触发 UI（非 Socket 兜底）

- `frontend/src/components/ChatWidget.tsx`
  - 在 `final` 事件里拿到 `filter` 后，同步 `gender/category`，并在有筛选时 `navigate('/shop')`（你刚要求的行为）。

---

## 后端：Socket.IO 房间、Agent 推送 UI Action

### 1) Socket.IO server 与 join_session

- `backend/api.py`
  - `sio = socketio.AsyncServer(...)`
  - 事件：
    - `@sio.on("join_session")`：`enter_room(sid, f"sd_{session_id}")`

对应关键代码引用：

```1336:1344:backend/api.py
@sio.on("join_session")
async def on_join_session(sid, data):
    """Client sends { session_id } to subscribe to its personal event room."""
    session_id = (data or {}).get("session_id", "")
    if session_id:
        room = f"sd_{session_id}"
        await sio.enter_room(sid, room)
        await sio.emit("connected", {"session_id": session_id, "status": "joined"}, to=sid)
```

### 2) Agent 运行时如何“控制网页”（核心：`sio.emit("ui_action")`）

- `backend/api.py` 的 `gemini_chat_stream(...)` ReAct loop
  - 当模型调用 `manage_sidebar` 并发生改变时：
    - `await sio.emit("ui_action", { action: "select_category", payload: {gender, category} }, room=f"sd_{ws_session_id}")`
  - 当模型调用 `keyword_search` 时：
    - `await sio.emit("ui_action", { action: "set_search_hint", payload: {query} }, room=f"sd_{ws_session_id}")`
  - 最后还会推 `catalog_results`（给 UI 渲染商品卡片）

对应关键代码引用：

```951:989:backend/api.py
if observation.get("ui_action_required"):
    payload = observation["action_payload"] or {}
    await sio.emit("ui_action", {
        "action": "select_category",
        "payload": payload,
        "description": f"Agent sidebar: gender={payload.get('gender')!r} category={payload.get('category')!r}",
    }, room=f"sd_{ws_session_id}")

# ...
if ws_session_id and kw:
    await sio.emit("ui_action", {
        "action": "set_search_hint",
        "payload": {"query": kw},
        "description": f"Agent searching for: {kw}"
    }, room=f"sd_{ws_session_id}")
```

---

## 会话（session）在后端的用途分层

- **登录态 session（鉴权）**：`backend/auth.py` 生成 `session_id`，写入 `auth_sessions.json`，通过 `session-id` header / cookie 使用。
- **聊天/网页控制 session（房间+RAG）**：`ChatRequest.session_id`（前端传 `chatSessionId`）作为：
  - Socket 房间：`sd_{session_id}`
  - RAG 记忆索引键：`vs.add_query_embedding(... session_id=ws_session_id ...)`
  - UI 推送目标：`room=f"sd_{ws_session_id}"`

---

## 关于你提到的「MCP」

在当前仓库里，我没有找到 **浏览器 MCP**（例如“让 AI 直接点页面元素”的那种）集成代码；现阶段的“AI 控制网页”是 **后端推结构化 `ui_action` → 前端执行** 的模式。

如果未来你要把 **MCP 浏览器自动化** 接进来，最自然的挂载点是：

- **后端**：在 `gemini_chat_stream` 的工具体系里新增一个 tool（比如 `mcp_browser_action`），但务必注意：MCP 通常跑在开发者环境/IDE 侧，不适合直接跑在生产后端。
- **前端**：维持当前 `ui_action` 模式作为“生产可用”通道；MCP 用于测试/回放/自动化验证（例如 CI 或开发环境），而不是线上用户页面控制。

如果你希望我再写一段“未来 MCP + WebSocket 架构草图（建议的消息协议与安全边界）”，我也可以继续补一节。