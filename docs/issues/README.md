# GitHub Issue 发布包

这里是根 [tasks.md](../../tasks.md) 的逐项 Issue 正文，共 41 项，目标仓库为 [bao-linfeng/exhibition-ai](https://github.com/bao-linfeng/exhibition-ai)。发布结果与依赖映射以 manifest.json 和各正文的真实链接为准；Issue 发布不代表功能实现完成。

- `T001.md`～`T041.md`：可直接作为Issue正文；标题取首个H1。
- [manifest.json](manifest.json)：稳定 ID、阶段、依赖和发布映射；功能 PR 字段为 null 代表尚未创建。
- [publish.ps1](publish.ps1)：针对本仓库的可恢复发布脚本。先查询所有状态的 Issues 并按任务 ID 查重；逐项创建、即时保存编号，最后回读验证标题、正文及依赖链接。遇到远端内容差异时停止，不覆盖后续人工或开发修改。
- 发布时先核实目标仓库、现有任务和权限；按task-id查重，逐项保存成功结果，再补真实依赖链接。
- 用户已指定本仓库并授权创建全部功能 Issues；脚本固定校验目标，不用于其他仓库。
- 本地文件和tasks中的验收条目同步维护；GitHub评论或PR状态不能自动充当验收证据。
