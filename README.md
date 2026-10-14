# AuraReader 官网

AuraReader 的中文单页官网。当前版本展示固件理念、功能、使用说明及刷机入口；在正式固件发布前，刷机能力保持安全关闭。

## 技术栈

- Vite 6
- TypeScript
- 原生 HTML / CSS / DOM API
- GitHub Actions + GitHub Pages

## 本地开发

需要 Node.js 24 和 pnpm 11。

```bash
pnpm install --frozen-lockfile
pnpm dev
```

提交前执行完整验证：

```bash
pnpm verify
```

构建产物输出至 `dist/`，可部署到任意静态文件托管服务。

## 部署到 GitHub Pages

1. 在 GitHub 新建一个空仓库。
2. 将本目录中的全部文件放在仓库根目录并推送到 `main` 分支。
3. 打开仓库的 **Settings → Pages**。
4. 在 **Build and deployment** 中将 **Source** 设为 **GitHub Actions**。
5. 等待 `Deploy AuraReader to GitHub Pages` 工作流完成。

工作流会依次安装锁定依赖、运行类型检查和测试、执行生产构建，再发布 `dist/`。Vite 使用相对资源路径，因此同时兼容用户主页仓库和普通项目仓库。

如果需要连接后端，在仓库 **Settings → Secrets and variables → Actions → Variables** 中添加以下任一变量：

- `VITE_API_BASE_URL`
- `VITE_RELEASE_MANIFEST_URL`

两者都不设置时，网站会显示“固件加紧开发中”，且不会尝试连接或写入设备。

## 项目结构

```text
.
├─ .github/workflows/deploy-pages.yml  # 自动验证与部署
├─ public/screens/                     # 设备界面素材
├─ src/main.ts                         # 页面交互入口
├─ src/release-service.ts              # 固件发布状态接口
├─ src/styles.css                      # 响应式样式
├─ tests/                              # 静态结构与资源测试
├─ index.html                          # 页面入口
├─ package.json
└─ vite.config.ts
```

## 发布状态接口

站点按以下优先级读取发布状态：

1. `VITE_API_BASE_URL`：请求 `GET {API_BASE_URL}/v1/releases/latest`
2. `VITE_RELEASE_MANIFEST_URL`：读取静态 JSON 清单
3. 两者均未配置：安全回退为 `pending`，刷机保持禁用

响应只接受以下两种可扩展结构：

```json
{ "state": "pending" }
```

```json
{
  "state": "available",
  "version": "1.0.0",
  "publishedAt": "2026-10-14T00:00:00Z"
}
```

接口不可用或结构不合法时，页面显示“暂时无法读取固件状态”，不会尝试连接或写入设备。后端需为官网部署来源配置 CORS；该请求不携带凭据。

## 素材来源

`public/screens/` 中的界面图复制自工作区现有的 `ui-design-final/figma-editable/screens/`，用于真实展示 AuraReader 设备 UI。

## 发布说明

当前官网版本为 `1.0.1`。版本变化记录见 [CHANGELOG.md](./CHANGELOG.md)。本仓库未附带开源许可证；如需开放复用，请在发布前另行选择并添加许可证。

