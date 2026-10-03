# 王米笑个人网站维护与 GitHub Pages 部署

正式域名保持 `https://wangmixiaopiano.cn/`。项目是无第三方 npm 依赖的静态 HTML/CSS/JS；Node.js 22 只在构建或本地预览时运行，GitHub Pages 发布的是 `dist/`。没有数据库、服务端 API、PHP 或 SSR。

仓库：[wangmixiao-art/wangmixiao-art.github.io](https://github.com/wangmixiao-art/wangmixiao-art.github.io)，发布分支为 `main`，默认预览地址为 `https://wangmixiao-art.github.io/`。默认地址会在绑定自定义域名后跳转到正式域名。迁移中的 DNS 切换和自定义域名 HTTPS 必须实际验证后才能认定完成；旧阿里云网站保持运行。

## 日常修改

- 编辑 `dist/index.html` 中的中文内容和结构，`dist/app.js` 中的中／英／法译文，以及 `dist/styles.css`。
- 原始 WebP 图片保存在 `dist/assets/images/hero.webp` 与 `portrait.webp`；保留照片颜色与现有画面比例。
- 执行 `npm run build`，再执行 `npm run check`。构建生成 `/en/`、`/fr/`、版本文件、站点地图以及带内容哈希的 CSS、JS、图片。
- 执行 `npm start` 在本地预览，检查桌面、手机、三语和本次修改。
- 提交并推送到 `main`：`git add .`、`git commit -m "Describe the website update"`、`git push origin main`。
- `.github/workflows/pages.yml` 自动重新构建、验证并发布。查看仓库 Actions 中的 “Build and deploy website”，确认成功后核对正式域名内容。
- 要回退线上版本，使用 `git revert` 撤销对应提交后 push，避免强制推送。

构建输出中的哈希文件不提交，Actions 每次重新生成。不要直接修改带哈希的生成文件。旧阿里云站点作为迁移回退保留，GitHub 部署不需要 SSH、服务器密码或 Nginx 操作。

## 首次设置与域名切换

1. 在 GitHub 仓库 Settings → Pages 中将 Source 设置为 **GitHub Actions**。
2. 在默认 github.io 地址完成页面、资源与三语验证，期间保留旧服务器和原 DNS。
3. 在 Pages → Custom domain 中保存 `wangmixiaopiano.cn`。使用 Actions 时，`dist/CNAME` 仅记录期望域名，不能代替 GitHub 的 Pages 设置。
4. 用户手动更改 DNS：根域 `@` 设置四条 A 记录，分别为 `185.199.108.153`、`185.199.109.153`、`185.199.110.153`、`185.199.111.153`；`www` 设置 CNAME 到 `wangmixiao-art.github.io`，不能带协议或仓库路径。
5. 同一主机记录的旧 A/AAAA/CNAME 不应与这些记录冲突。只替换网站的 `@` 和 `www`，保留邮件 MX、域名验证 TXT 及其他无关记录。TTL 可设为 600 秒。
6. 等待 GitHub DNS 校验及证书签发，启用 **Enforce HTTPS**，复测根域、www、跳转、三语、CSS/JS、图片、sitemap、robots 和 canonical。验证成功前不要关闭旧服务器。

参考：[GitHub 自定义域名官方说明](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site)、[HTTPS 官方说明](https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https)。具体 GitHub 账户与 Pages 状态必须在迁移时确认，DNS 由用户操作。

## 缓存与兼容性

GitHub Pages 的响应头由平台控制，`server.mjs` 和 `dist/_headers` 中的缓存设置不会生效，HTML meta 也不能代替 HTTP 响应头。本项目使用内容哈希 CSS、JS、图片与构建版本，保留 `version.json` 更新探测和自动版本参数刷新，并避免边缘缓存更新时的重复刷新循环。不能承诺即时清除已打开微信页面的缓存，应在真实设备验证。

三语页面是目录中的真实 `index.html`，没有 SPA 路由，不需要服务器回退规则。资源使用 `/` 开头的同域路径；当前使用 GitHub 用户站点仓库 `wangmixiao-art.github.io`，保证未绑定自定义域名前的预览也位于域名根路径。canonical、hreflang、social image 和 sitemap 始终指向 `wangmixiaopiano.cn`。

公共 GitHub Pages 的代码与网站图片会公开。提交前检查 Git 暂存区，不上传 `.env`、Token、私钥、SSH 配置、部署凭据、`.openai/hosting.json` 或当前聊天工作区的历史日志。GitHub CLI 凭据由系统密钥链或 CLI 自身安全存储管理，不能放进项目。
