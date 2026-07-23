【任务卡 - 第一组：公告 + WhatsApp 群发】
总工时：2 天
业务模块：家校沟通 — 中英文通告 + WhatsApp 推送 + 状态追踪

组员：
- 同学 2（蔡承烨）：前端负责 + 组长
- 同学 5（谢作怡）：后端 + WhatsApp API 集成
- 同学 3（陈培鑫）：AI Prompt + 内容生成

──────────────
Day 1 上午（基础设施 + 设计）
──────────────

□ 09:00-09:30 kickoff 确认分工

□ 09:30-11:00（同学 5）基础建表 + API
  - 新建 apple_notification_templates 表（通告模板）
  - 新建 apple_notifications 表（发送记录）
  - 新建 apple_notification_logs 表（每条消息的发送状态）
  - 通告 CRUD API（增删改查）
  - 文件路径：apps/api/app/modules/apple/notifications/

□ 09:30-11:00（同学 2）前端通告管理页
  - 路径：apps/web/app/(dashboard)/dashboard/apple/notifications/
  - 通告列表页（搜索 + 筛选状态）
  - 新建通告页（选模板 → 填内容 → 选班级/年级）
  - 模板管理页（增删改模板）

□ 09:30-11:00（同学 3）AI Prompt
  - 写通告生成 Prompt（中英双语版）
  - 文件：apps/api/app/modules/apple/prompts/notice_bilingual_zh_hk.md
  - 联调 DeepSeek，确认输出质量

──────────────
Day 1 下午
──────────────

□ 13:00-15:00（同学 5）WhatsApp 集成
  - 接入 WhatsApp Business API（或 Twilio/WATI）
  - 封装公共发送函数 send_whatsapp(phone, message, attachment?)
  - 配置 Webhook 接收送达/已读回执
  - 更新 notification_logs 状态（sent/delivered/read/failed）

□ 13:00-15:00（同学 2）发送确认流程
  - 预览通告内容（中英文）
  - 发送前确认弹窗
  - 消息队列：批次发送 + 暂停/继续

□ 13:00-15:00（同学 3）PDF 导出
  - 通告另存为 PDF（双语并排或分页）
  - 用 fpdf2 或 docxtpl 实现

□ 15:00-17:00 联调
  - 全链路：选模板 → 填内容 → AI 生成 → 选班级 → WhatsApp 发送 → 状态更新

□ 17:00-18:00 状态统计看板
  - 前端：发送记录列表 + 统计卡片（已发送/已送达/已读/失败）
  - 按班级/年级筛选查看

──────────────
Day 2 上午（评审 + 修复）
──────────────

□ 09:00-10:30 代码评审（同学 1 主持）
  - 检查：目录规范、权限校验、错误处理、空/加载状态
  - 检查：WhatsApp Key 无硬编码

□ 10:30-12:00 修复 + 联调

──────────────
Day 2 下午（收尾）
──────────────

□ 13:00-15:00 端到端测试
  - 场景 1：新建模板 → AI 生成通告 → 预览 → 发送 → 状态追踪
  - 场景 2：发送失败 → 重发机制 → 状态更新
  - 场景 3：PDF 导出 → 下载

□ 15:00-17:00 文档
  - docs/07-module-notifications.md（12 节标准格式）
  - 更新 README

□ 17:00-18:00 演示彩排

──────────────
交付清单
──────────────
✅ 通告管理页（模板 + 编辑 + 发送）
✅ 中英文 AI 通告生成 Prompt
✅ WhatsApp API 接入（发送 + Webhook）
✅ 发送状态追踪 + 统计看板
✅ PDF 导出
✅ 单元测试 ≥5 个
✅ docs/07-module-notifications.md
