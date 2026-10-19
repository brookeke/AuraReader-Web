# AuraReader 官网

AuraReader 的中文单页官网，可直接托管在 GitHub Pages。新版以编辑式信息架构呈现固件理念、真实界面、使用说明、Wi-Fi 传书、更新日志与常见问题，并通过 Espressif esptool-js 提供包含版本选择的站内分步刷写。

## 技术栈

- Vite 6
- TypeScript
- 原生 HTML / CSS / DOM API
- GitHub Actions + GitHub Pages（从分支发布）

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
4. 在 **Build and deployment** 中将 **Source** 设为 **Deploy from a branch**。
5. 将分支设为 **main**、目录设为 **/ (root)**，保存后等待 Pages 发布完成。

`Verify AuraReader website` 工作流会依次安装锁定依赖、运行类型检查和测试，并验证生产构建。仓库根目录本身可直接静态托管，Vite 构建产物也可部署到其他静态文件服务。

如果需要连接后端，在仓库 **Settings → Secrets and variables → Actions → Variables** 中添加以下任一变量：

- `VITE_API_BASE_URL`
- `VITE_RELEASE_MANIFEST_URL`

两者都不设置时，网站读取仓库内的 `firmware/manifest.json`，提供当前稳定固件。

## 项目结构

```text
.
├─ .github/workflows/verify.yml        # 自动验证与构建
├─ screens/                            # 设备界面素材
├─ firmware/                           # 网页刷机清单与合并固件
├─ scripts/copy-static.mjs             # 将固件复制到 Vite 构建产物
├─ src/main.js                         # 页面通用交互
├─ src/web-flasher.js                  # 站内版本选择、刷写引导与进度
├─ src/release-service.js              # 固件发布状态接口
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
3. 两者均未配置：读取 `firmware/manifest.json`

接口支持待发布、单版本或多版本目录。多版本目录最多在页面展示前两个版本：

```json
{ "state": "pending" }
```

```json
{
  "state": "available",
  "version": "1.0.0",
  "publishedAt": "2026-10-14T00:00:00Z",
  "path": "https://example.com/aurareader-v1.0.0.bin"
}
```

```json
{
  "releases": [
    { "version": "1.1.0", "channel": "stable", "path": "https://example.com/aurareader-v1.1.0.bin" },
    { "version": "1.0.0", "channel": "stable", "path": "https://example.com/aurareader-v1.0.0.bin" }
  ]
}
```

接口不可用或结构不合法时，页面显示“暂时无法读取固件状态”，不会尝试连接或写入设备。后端需为官网部署来源配置 CORS；该请求不携带凭据。

## 放置编译后的固件

网页刷机使用单一合并镜像。当前文件放在：

```text
firmware/v0.5.0-firefly.alpha.36/AuraReader-v0.5.0-firefly.alpha.36-full-16MB.bin
```

发布新版本时，新建 `firmware/vX.Y.Z-codename.prerelease/`，把合并镜像放入其中，并同步更新 `firmware/manifest.json` 的版本身份、`path`、`offset`、文件大小和 SHA-256。不要直接把单独的应用固件作为 `offset: 0` 发布。

本版合并镜像包含：`0x0` 启动程序、`0x8000` 分区表、`0x10000` AuraReader 主程序、`0x910000` 系统字体。原始构建产物仍可分别保留在发布归档中，官网只需要托管合并后的 `.bin` 与 manifest。

## 素材来源

`screens/` 中的界面图复制自工作区现有的 `ui-design-final/figma-editable/screens/`，用于真实展示 AuraReader 设备 UI。该位置兼容 GitHub Pages 从仓库根目录发布，也会被 Vite 正确纳入生产构建。

## 发布说明

当前官网版本为 `2.8.1`。版本变化记录见 [CHANGELOG.md](./CHANGELOG.md)。本仓库未附带开源许可证；如需开放复用，请在发布前另行选择并添加许可证。

