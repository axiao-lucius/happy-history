# 🏯 快乐学历史 · Happy History

> 国风水墨历史语音问答 PWA 小程序 | 577题 | GitHub Pages 免安装即用

## ✨ 功能特色

- **🎙️ 语音问答**：说出答案即可答题，支持语音读题和情感反馈
- **📈 自适应难度**：从易到难智能递进，连续答对5题自动升级高难题比例
- **👑 王者荣耀段位**：6级称号体系（不屈青铜→荣耀王者），段位揭晓动画
- **🎨 国风水墨UI**：宣纸纹理、墨晕动效、朱砂红点缀，古典书卷气质
- **📱 PWA离线可用**：添加到手机主屏幕，无需安装，断网也能答题
- **📚 577道题库**：覆盖先秦到世界史，小学到高中全学段，按朝代×难度索引
- **🔥 连胜系统**：连击特效、火焰图标、成就徽章解锁
- **📖 错题本**：自动收集错题，随时复习巩固

## 🚀 快速开始

### 本地预览
```bash
cd happy-history
python3 -m http.server 8080
# 浏览器打开 http://localhost:8080
```

### 部署到 GitHub Pages

1. 在 GitHub 创建仓库 `happy-history`
2. 推送代码：
```bash
cd happy-history
git init
git add .
git commit -m "🏯 快乐学历史 v1.0"
git remote add origin https://github.com/YOUR_USERNAME/happy-history.git
git branch -M main
git push -u origin main
```
3. 进入仓库 Settings → Pages → Source 选择 `main` 分支 `/ (root)` → Save
4. 等待部署完成，访问 `https://YOUR_USERNAME.github.io/happy-history/`

## 📁 项目结构

```
happy-history/
├── index.html                 # SPA入口页
├── manifest.json              # PWA清单
├── sw.js                      # Service Worker(离线缓存)
├── css/
│   └── main.css               # 国风水墨设计系统
├── js/
│   ├── app.js                 # 主应用控制器(路由+流程编排)
│   ├── quizEngine.js          # 题库加载与索引引擎
│   ├── adaptiveSystem.js      # 自适应难度递进算法
│   ├── stateManager.js        # 状态持久化(错题本/成就/统计)
│   ├── voiceEngine.js         # 语音识别与合成引擎
│   ├── scoringSystem.js       # 计分与段位系统
│   └── components/
│       ├── QuizCard.js        # 答题卡片组件
│       ├── RankReveal.js      # 段位揭晓动画
│       └── StreakCounter.js   # 连胜计数器
├── data/
│   └── k12-history-quiz-v3.json  # 题库(577题, v5.1.0)
└── assets/icons/
    ├── icon-192.svg           # PWA图标
    └── icon-512.svg
```

## 🎮 自适应难度机制

| 累计连胜轮次 | 每轮高难题数 | 说明 |
|-------------|------------|------|
| 0 | 0 | 全部基础题(D1-D2) |
| 1-2 | 1 | 首次达成5连对，插入1道D4-D5 |
| 3-5 | 2 | 连续3次5连对，升至2道 |
| 6-8 | 3 | 升至3道 |
| 9+ | 4(封顶) | 最多4道高难，至少保留1道基础题 |

每日首题固定为D1(最简单)，答错当前轮次连胜归零但历史轮次数保留。

## 👑 段位体系

| 得分 | 称号 | 标识 |
|------|------|------|
| 100 | 荣耀王者·史学宗师 | 👑 |
| 80 | 最强王者·博古通今 | ⭐ |
| 60 | 至尊星耀·学有所成 | 💎 |
| 40 | 永恒钻石·初窥门径 | 🔷 |
| 20 | 尊贵铂金·再接再厉 | 🥉 |
| 0 | 不屈青铜·从头再来 | 🛡️ |

## 🛠️ 技术栈

- **前端**: Vanilla JS + Web Components (零依赖)
- **语音**: Web Speech API (STT + TTS)
- **存储**: LocalStorage (纯前端，无需后端)
- **部署**: GitHub Pages (静态托管)
- **PWA**: Service Worker + manifest.json

## 📝 License

MIT
