# Gamefolio

Apple 风格的游戏设计灵感库。项目使用标准 Next.js App Router，可部署到
Vercel；Supabase 提供邮箱密码登录、PostgreSQL 数据库、行级权限和私有图片存储。

## 本地运行

1. 复制 `.env.example` 为 `.env.local`。
2. 在 Supabase Dashboard 的 Project Settings > API 中填入项目 URL、
   Publishable key 和 Secret key。Secret key 只能放在服务端环境变量中。
3. 打开 Supabase SQL Editor，运行
   `supabase/migrations/20260728000000_initial_schema.sql`。
4. 在 Supabase Authentication > URL Configuration 中加入：
   - Site URL: `http://localhost:3000`
   - Redirect URL: `http://localhost:3000/auth/confirm`
5. 在 Authentication > Users 中预先创建允许登录的邮箱账户和密码。应用只提供
   登录接口，不提供公开注册。
6. 安装依赖并运行：

```bash
npm install
npm run dev
```

## 部署到 Vercel

1. 在 Vercel Import Git Repository 中选择 `FallGuy102/Gamefolio`。
2. Framework Preset 保持 Next.js，Root Directory 保持 `./`。
3. 添加 `.env.example` 中的三个 Supabase 环境变量。
4. 点击 Deploy。
5. 部署成功后，把 Supabase 的 Site URL 改成 Vercel 生产网址，并把
   `https://你的域名/auth/confirm` 添加到 Redirect URLs。

如果需要 IGDB 实时搜索，再单独添加 `IGDB_CLIENT_ID` 和
`IGDB_CLIENT_SECRET`。没有它们时，手动创建游戏档案仍可使用。

## 工作原理

- 浏览器加载 Vercel 上的 Next.js 页面，并通过 Supabase Auth 获取登录会话。
- Next.js API 使用登录 Cookie 验证用户；数据库 RLS 再按 `auth.uid()` 限制每行数据。
- 条目、游戏和图片说明存入 PostgreSQL；原始图片存入私有 Storage bucket。
- 公开分享只保存随机令牌的 SHA-256 哈希。只读分享接口在服务端验证令牌后，
  只返回对应条目。
- 离线文字草稿保存在浏览器 IndexedDB，恢复网络后再提交同步。

## 验证

```bash
npm run lint
npm run build
npm test
```
