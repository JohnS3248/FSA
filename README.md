# FSA - Fix Steam Activities

修复 Steam 社区动态页面的布局异常和无限滚动失效问题。

## 问题描述

Steam 社区动态页面偶发性出现以下问题：
1. **页面全宽渲染异常** - 页面布局变成全宽，失去正常的居中约束
2. **无限滚动失效** - 只能查看约 20 条动态，滚动无法触发加载更多内容

## 安装方法

### 前置要求

安装浏览器扩展 [Tampermonkey](https://www.tampermonkey.net/)：
- [Chrome 版](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
- [Firefox 版](https://addons.mozilla.org/firefox/addon/tampermonkey/)
- [Edge 版](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)

### 安装脚本

#### 方法一：直接安装（推荐）

点击下方链接直接安装：

[**安装 FSA 脚本**](https://raw.githubusercontent.com/JohnS3248/FSA/main/fsa.user.js)

#### 方法二：手动安装

1. 点击浏览器工具栏的 Tampermonkey 图标
2. 选择「添加新脚本」
3. 删除编辑器中的所有默认内容
4. 复制 [fsa.user.js](./fsa.user.js) 的全部内容并粘贴
5. 按 `Ctrl+S` (Mac: `Cmd+S`) 保存

## 使用方法

1. 安装脚本后，访问 Steam 社区动态页面
2. 页面右上角会出现绿色的 **「FSA」** 悬浮按钮
3. 如果检测到问题，脚本会自动修复，按钮变为「已修复 ✓」
4. 也可以手动点击按钮触发修复

## 支持的页面

- `https://steamcommunity.com/id/*/home*` - 好友动态
- `https://steamcommunity.com/profiles/*/home*` - 好友动态
- `https://steamcommunity.com/my/home*` - 我的动态
- `https://steamcommunity.com/id/*/myactivity*` - 我的活动
- `https://steamcommunity.com/profiles/*/myactivity*` - 我的活动
- `https://steamcommunity.com/my/myactivity*` - 我的活动

## 已知限制

- **前一天动态可能无法加载**：当页面出现布局异常时，Steam 服务器会对前一天的动态请求返回 500 错误（原因不明）。这是 Steam 服务端的限制，脚本无法绕过。例如：今天是 1 月 20 日，页面异常时 1 月 19 日的动态可能无法获取。

## 调试命令

在浏览器控制台 (F12) 中可以使用以下命令：

```javascript
FSA.diagnose()  // 诊断页面问题
FSA.fix()       // 手动修复
FSA.loadMore()  // 手动加载更多
FSA.status()    // 查看状态
FSA.reset()     // 重置状态
```

## 许可证

MIT License
