# Learn-AI

面向 Java 全栈开发者的 AI 学习知识库，涵盖大语言模型、Agent、RAG、AI 工程、Java/Spring 生态与生产实践。学习内容直接维护为语义化 HTML，并通过 GitHub Pages 发布。

- 在线知识库：<https://toik001.github.io/Learn-AI/>
- 仓库入口：[index.html](index.html)
- 学习页面：[public/notes/](public/notes/)

## 环境要求

- Node.js 24：运行索引生成、内容回归和站点完整性校验。
- 可选 Java 21 或更高版本：使用 JDK 自带的 `jwebserver` 本地预览。

项目没有 npm 依赖，也不需要静态站点生成器。

## 本地阅读

可以直接用浏览器打开根目录的 `index.html`。使用本地 HTTP 服务预览时，应从仓库根目录启动：

```bash
jwebserver -d . -p 8000
```

然后访问 <http://localhost:8000/>。

## 项目结构

```text
.
├── .nojekyll                    # 保持原始静态文件，不执行 Jekyll 转换
├── index.html                   # GitHub Pages 与本地知识库入口
├── AGENTS.md                    # 学习助手与项目维护规则
├── README.md                    # 仓库使用说明
├── public/
│   ├── manifest.json            # 页面清单
│   ├── assets/                  # 共享样式与脚本
│   └── notes/<category>/        # HTML 学习页面
└── scripts/
    ├── build-html-index.mjs     # 重建根入口、导航与清单
    ├── verify-site.mjs          # 校验链接、锚点和页面结构
    └── test-*.mjs               # 内容与生成器回归测试
```

GitHub Pages 从 `main` 分支的 `/ (root)` 发布。入口位于仓库根目录，知识页面和静态资源仍集中在 `public/`。

## 新增或修改学习内容

1. 在 `public/notes/<category>/` 新建或编辑 HTML 页面。
2. 使用相对链接引用 `public/assets/style.css`、`public/assets/app.js` 和其他知识页。
3. 提供 `description`、`study-category`、`study-date`、稳定标题 ID、“核心结论”和“参考资料”。
4. 重建根首页、分类侧栏、目录、上一篇/下一篇与清单：

   ```bash
   node scripts/build-html-index.mjs
   ```

5. 完成下方全量校验后再提交。

## 本地校验

```bash
test -s index.html
test ! -e public/index.html
node --check scripts/build-html-index.mjs
node --check scripts/verify-site.mjs
node --check public/assets/app.js
for test_file in scripts/test-*.mjs; do node "$test_file"; done
node scripts/verify-site.mjs
node scripts/build-html-index.mjs
git diff --exit-code -- index.html public
git diff --check
```

`verify-site.mjs` 会检查根入口、本地链接、资源路径、片段锚点、重复 ID、知识页元数据、语义标签、根路径引用和外部链接安全属性。最后两条生成检查保证入口与导航已经提交且可重复生成。

## GitHub Pages 部署

仓库不使用自定义 Actions workflow，直接从 `main` 分支发布：

1. 在 GitHub 打开 **Settings → Pages**。
2. 在 **Build and deployment → Source** 选择 **Deploy from a branch**。
3. **Branch** 选择 `main`，目录选择 `/ (root)`，然后保存。
4. 此后每次推送 `main`，GitHub Pages 都会自动发布根目录内容。

默认项目站点地址是 <https://toik001.github.io/Learn-AI/>。站内链接全部使用相对路径，因此能够适配 `/Learn-AI/` 项目子路径。

分支根目录会成为发布源，因此不要向仓库提交密钥、私有资料或其他不应公开的文件。若页面返回 404，先确认 Pages Source、`main`、`/ (root)` 三项设置，并等待 GitHub 完成本次构建。

## 维护规则

详细内容规范、联网资料落盘要求、GitHub Pages 约束和交付标准见 [AGENTS.md](AGENTS.md)。

## License

本项目使用 [MIT License](LICENSE)。
