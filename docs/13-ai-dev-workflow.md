# AI 辅助开发工作流指引

> 适用场景：用 Claude Code / Cursor / Windsurf 等 AI 编程工具，按规划文档逐步实现功能

---

## 一、核心原则

1. **先规划，后代码**：每个模块先读规划文档，再让 AI 生成代码
2. **一个模块走通再下一个**：模块没通过验收测试，不进入下一阶段
3. **AI 边写边测**：每完成一个函数/端点立即测试
4. **兼容第一**：新增代码必须与现有模块无冲突

---

## 二、工作流模板（每模块通用）

以「模块 X.Y」为例：

### Step 1：AI 理解需求

把规划文档中该模块的描述发给 AI 编程工具：

> "请基于 docs/11-plan-notifications.md 的「模块 1.2：后端 API」实现 CRUD 路由。
> 数据表已在模块 1.1 创建。
> 路由路径前缀为 /apple/notifications。
> 文件放在 apps/api/app/modules/apple/notifications/ 下。"

### Step 2：AI 生成代码

AI 生成文件：router.py、schemas.py、service.py、repository.py

### Step 3：AI 自测

要求 AI 先跑测试确认无语法错误：

> "文件已编写完成，请检查 import 路径是否正确，
> 确认与现有 app.main 中 router 的注册方式一致。"

### Step 4：手动验收

对照规划文档的「验收标准」逐项确认。

### Step 5：git commit

```bash
git add . && git commit -m "[notifications] feat: 模块 1.2 CRUD API"
```

---

## 三、与 AI 编程工具的协作技巧

### 好的 Prompt 示例

```
❌ 差："帮我写通告模块"
✅ 好："请根据 docs/11-plan-notifications.md 的模块 1.2 实现以下 API：
   GET /apple/notifications/templates
   POST /apple/notifications/templates
   文件放在 apps/api/app/modules/apple/notifications/ 下。
   参考已有模块 apps/api/app/modules/apple/assets/router.py 的写法。"
```

### 需要提供 context

每次开始新模块前，先给 AI 编程工具提供：
1. 相关规划文档的链接/内容
2. 参考的已有模块文件（如 assets 模块的 router.py）
3. 数据库表结构
4. 与现有系统的接口约定

### 遇到问题时

- Prompt 效果差 → 先调 Prompt，不要跳过
- 与已有功能冲突 → 先读已有代码，再让 AI 改
- 多个模块耦合 → 先拆解为更小模块，逐个解决

---

## 四、执行检查清单（每日用）

```
□ 今天要做的模块编号：____
□ 已阅读对应规划文档
□ 已找到可参考的已有代码
□ AI 生成代码后已确认无 import 错误
□ 已通过验收标准
□ 没有引入新 bug（回测已有功能）
□ 已 git commit
```

---

## 五、文件索引

| 文件 | 说明 |
|------|------|
| docs/11-plan-notifications.md | 案例一：家校沟通规划（6 个子模块） |
| docs/12-plan-scores-comments.md | 案例二：成绩评语规划（9 个子模块） |
| 任务卡_附录F_第一组_公告WhatsApp.md | 第一组分发任务卡 |
| 任务卡_附录G_第二组_成绩评语WhatsApp.md | 第二组分发任务卡 |
