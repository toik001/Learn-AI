# Learn-AI

面向 Java 全栈开发者的 AI 学习知识库，涵盖大语言模型、Agent、RAG、AI 工程、Java/Spring 生态与生产实践。所有学习内容直接维护为语义化 HTML，并通过 GitHub Pages 发布。

- 在线知识库：<https://toik001.github.io/Learn-AI/>
- 仓库内入口：[public/index.html](public/index.html)
- 发布工作流：[.github/workflows/pages.yml](.github/workflows/pages.yml)

## 环境要求

- Node.js 24：运行索引生成、内容回归和站点完整性校验。
- 可选 Java 21 或更高版本：使用 JDK 自带的 `jwebserver` 本地预览。

项目没有 npm 依赖，也不需要静态站点生成器。

## 本地阅读

可以直接用浏览器打开 `public/index.html`。若浏览器限制本地文件交互，使用 Java 21 启动静态服务器：

```bash
jwebserver -d public -p 8000
```

然后访问 <http://localhost:8000/>。

## 项目结构

```text
.
├── .github/workflows/pages.yml   # 校验并部署 GitHub Pages
├── AGENTS.md                     # 学习助手与项目维护规则
├── README.md                     # 仓库使用说明
├── public/                       # 唯一发布根目录
│   ├── index.html                # 知识库入口
│   ├── manifest.json             # 页面清单
│   ├── assets/                   # 共享样式与脚本
│   └── notes/<category>/         # HTML 学习页面
└── scripts/
    ├── build-html-index.mjs      # 重建入口、导航与清单
    ├── verify-site.mjs           # 校验链接、锚点和页面结构
    └── test-*.mjs                # 内容与生成器回归测试
```

只有 `public/` 会进入 Pages artifact；`AGENTS.md`、README、测试和工作流不会公开到站点目录。

## 新增或修改学习内容

1. 在 `public/notes/<category>/` 新建或编辑 HTML 页面。
2. 使用相对链接引用 `public/assets/style.css`、`public/assets/app.js` 和其他知识页。
3. 提供 `description`、`study-category`、`study-date`、稳定标题 ID、“核心结论”和“参考资料”。
4. 重建首页、分类侧栏、目录、上一篇/下一篇与清单：

   ```bash
   node scripts/build-html-index.mjs
   ```

5. 完成下方全量校验后再提交。

## 本地校验

```bash
test -s public/index.html
node --check scripts/build-html-index.mjs
node --check scripts/verify-site.mjs
node --check public/assets/app.js
for test_file in scripts/test-*.mjs; do node "$test_file"; done
node scripts/verify-site.mjs
node scripts/build-html-index.mjs
git diff --exit-code -- public
git diff --check
```

`verify-site.mjs` 会检查本地链接、资源路径、片段锚点、重复 ID、知识页元数据、语义标签、根路径引用和外部链接安全属性。最后两条生成检查保证索引已提交且可重复生成。

## GitHub Pages 部署

仓库使用 GitHub Actions，从 `main` 分支自动部署 `public/`：

1. 在 GitHub 打开 **Settings → Pages**。
2. 在 **Build and deployment → Source** 选择 **GitHub Actions**。
3. 推送 `main`，或在 **Actions → Deploy knowledge base to GitHub Pages** 中手动运行。
4. `build` job 校验站点并上传 artifact；`deploy` job 使用 GitHub OIDC 发布到 `github-pages` environment。

默认项目站点地址是 <https://toik001.github.io/Learn-AI/>。站内链接全部使用相对路径，因此能够正确适配 `/Learn-AI/` 子路径。

若部署失败，先查看 Actions 中失败的具体步骤：

- 生成结果不一致：本地运行 `node scripts/build-html-index.mjs` 并提交 `public/` 变化。
- 链接或锚点失败：运行 `node scripts/verify-site.mjs` 查看文件级诊断。
- 部署 job 未运行：确认 build 已通过，且 Pages Source 已选择 GitHub Actions。
- 页面返回 404：确认 artifact 根部存在小写 `index.html`，并检查仓库 Pages 设置。

## 维护规则

详细内容规范、联网资料落盘要求、GitHub Pages 约束和交付标准见 [AGENTS.md](AGENTS.md)。

## License

本项目使用 [MIT License](LICENSE)。
