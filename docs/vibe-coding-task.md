# 协作与任务指引

> 5 人小团队 48 小时冲刺协作规范 — 架构师/Leader 定稿

## 1. Git 工作流

```
main（受保护）
  └── feat/<module>-<描述>（个人分支）
       └── PR → main（Leader 评审后合并）
```

### 提交规范

```
<type>: <简短描述>

type: feat / fix / docs / refactor / test / chore
示例:
  feat: awards 列表页新增搜索筛选
  fix: OCR 识别人民币金额
  docs: 更新 API 设计规范
```

### 每日节奏

| 时间 | 动作 |
|------|------|
| 09:00 | 站会 5 分钟 — 同步进度 |
| 12:00 | 午餐前 push 当前代码 |
| 17:00 | 联调 — 前后端对接 |
| 18:00 | Day 收尾 — PR + 文档更新 |

## 2. 分支策略

```bash
# 创建功能分支
git checkout -b feat/awards-list main

# 开发完成，拉取最新 main 后提交
git add apps/api/app/modules/apple/awards/
git commit -m "feat: awards CRUD 完成"
git push origin feat/awards-list

# 在 GitHub 创建 PR，@Leader 评审
```

## 3. 模块拆分原则

每个同学负责独立的功能模块，不依赖其他同学的业务代码：

| 同学 | 模块 | 依赖（仅底座） |
|------|------|---------------|
| 同学1 | 底座 + 权限 + 通用组件 | 无 |
| 同学2 | 奖状奖学金 | Leader 底座 |
| 同学3 | 财务 + 资产 | Leader 底座 |
| 同学4 | 学生 + AI + OCR | Leader 底座 |
| 同学5 | 总览页 + 文档汇总 | 全部前端页 |

**关键规则**：不跨模块 import 业务代码。共享能力（JWT 校验、数据库会话、文件上传）通过 Leader 提供的底座模块调用。

## 4. 前后端联调

### 前端调用后端

```typescript
// lib/api.ts — 统一请求封装
import { api } from "@/lib/api";

// GET 列表
const res = await api.get<Item[]>("/apple/awards");

// POST 创建
const res = await api.post<Item>("/apple/awards", { name: "..." });

// 文件上传
const form = new FormData();
form.append("file", file);
const res = await api.form<UploadedFile>("/files/upload", form);
```

### 后端返回格式

所有接口统一返回 `APIResponse<T>`：

```python
from app.common.schemas import APIResponse

@router.get("", response_model=APIResponse[list[ItemOut]])
async def list_items(...):
    return APIResponse(data=items)
```

## 5. 阻塞处理

如果遇到以下阻塞情况，立即在群里同步：

| 阻塞类型 | 处理方式 |
|----------|---------|
| 底座 API 不可用 | @Leader，记录到 `docs/testing-report.md` |
| 前端组件缺失 | @Leader，先 mock 数据继续开发 |
| 数据库表冲突 | @Leader，统一表名以 `apple_` 前缀 |
| OCR Worker 无响应 | @同学4，暂时回退 Tesseract.js 兜底 |
| 端口占用 | 默认 8000（后端）/ 3000（前端），冲突时改用 8001 |

## 6. 演示准备

- Day 2 17:00 前完成所有代码合并
- Day 2 17:00-18:00 演示彩排，每人 5 分钟
- 演示账号：`admin` / `admin123`
- 演示数据通过 `seed_demo_data.py` 加载

## 7. 验收标准

详见 `docs/acceptance-checklist.md`，核心要求：

- [ ] 4 个模块前端页面可正常渲染
- [ ] 后端 7 个路由组全部注册并响应
- [ ] 至少 1 个端到端场景能走通（登录→创建→查看）
- [ ] 颜色统一为品牌绿 `#23675f`
- [ ] 无 console error / 500 错误
