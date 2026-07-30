/* =====================================================
   快乐学历史 v2.0 · 主应用 (Vanilla JS)
   ===================================================== */
(function () {
  'use strict';

  // ================ 配置 ================
  const CONFIG = {
    QUIZ_FILE: 'data/quiz-v4.json',
    ROUND_SIZE: 5,           // 每轮题目数
    SCORE_PER: 20,           // 每题分值
    STORAGE_KEY: 'happy_history_v2',
    WRONG_KEY: 'happy_history_wrong_v2',
    SETTINGS_KEY: 'happy_history_settings_v2',
  };

  // 段位系统（王者荣耀风格但历史化）
  const RANKS = [
    { min: 100, key: 'king',    emblem: '👑', title: '荣耀王者', subtitle: '史学宗师',
      quote: '究天人之际，通古今之变', color: '#a02c2c' },
    { min: 80,  key: 'star',    emblem: '⭐', title: '最强王者', subtitle: '博古通今',
      quote: '腹有诗书气自华', color: '#d4a95c' },
    { min: 60,  key: 'diamond', emblem: '💎', title: '至尊星耀', subtitle: '学有所成',
      quote: '学而不厌，诲人不倦', color: '#4c7a5e' },
    { min: 40,  key: 'plat',    emblem: '🔷', title: '永恒钻石', subtitle: '初窥门径',
      quote: '路漫漫其修远兮，吾将上下而求索', color: '#5b7db1' },
    { min: 20,  key: 'gold',    emblem: '🥉', title: '尊贵铂金', subtitle: '再接再厉',
      quote: '千里之行，始于足下', color: '#b28948' },
    { min: 0,   key: 'bronze',  emblem: '🛡️', title: '不屈青铜', subtitle: '从头再来',
      quote: '失败乃成功之母', color: '#8c8272' },
  ];

  // 情绪化文案 - 答对
  const RIGHT_LINES = [
    ['妙哉！', '此题连翰林学士都要赞你三分'],
    ['答得漂亮！', '这份底蕴，着实令人叹服'],
    ['当真了得！', '看来诸子百家都被你翻烂了'],
    ['不错不错！', '博闻强识，就是说的你了'],
    ['神机妙算！', '此答已入圣手'],
    ['妙笔生花！', '此等见识，堪称大家'],
    ['一鼓作气！', '这波节奏，稳如泰山'],
    ['金榜有名！', '如此才学，必得高中'],
  ];
  // 情绪化文案 - 答错
  const WRONG_LINES = [
    ['再想想～', '当年苏东坡也在此处栽过跟头'],
    ['莫要气馁！', '错题恰是最好的老师'],
    ['无妨！', '一次不成，再来便是'],
    ['稍安勿躁～', '历史长河，谁未失足过'],
    ['略有偏差！', '差之毫厘，谬以千里，慢慢来'],
    ['别急！', '知不足然后能自反也'],
    ['惜哉！', '此题稍难，记住即可'],
    ['未曾～', '不知者不罪，看看解析吧'],
  ];

  // ================ 状态 ================
  const State = {
    quiz: null,              // 完整题库 { metadata, questions[] }
    round: {                 // 当前一轮
      questions: [],
      idx: 0,
      score: 0,
      results: [],
      startTime: 0,
    },
    userData: null,          // 用户历史数据
    wrong: [],               // 错题本
    settings: {
      sound: true,
      autoRead: false,
      voice: false,
    },
    lastMode: 'normal',      // 'normal' | 'wrong'（复习错题模式）
    currentCategory: 'all',
  };

  // ================ 工具 ================
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);
  const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  function loadJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; }
    catch { return fallback; }
  }
  function saveJSON(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { }
  }
  function toast(msg, ms = 1800) {
    const t = $('#toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast._tid);
    toast._tid = setTimeout(() => { t.hidden = true; }, ms);
  }
  function playBeep(ok = true) {
    if (!State.settings.sound) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = ok ? 'sine' : 'triangle';
      osc.frequency.value = ok ? 880 : 220;
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.start(); osc.stop(ctx.currentTime + 0.35);
      if (ok) {
        // 上滑第二音
        const osc2 = ctx.createOscillator();
        const g2 = ctx.createGain();
        osc2.connect(g2); g2.connect(ctx.destination);
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
        g2.gain.setValueAtTime(0.12, ctx.currentTime + 0.1);
        g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        osc2.start(ctx.currentTime + 0.1); osc2.stop(ctx.currentTime + 0.5);
      }
    } catch (e) { }
  }
  function speak(text) {
    if (!('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'zh-CN'; u.rate = 0.95; u.pitch = 1.05;
      window.speechSynthesis.speak(u);
    } catch (e) { }
  }
  function vibrate(pattern) {
    if (navigator.vibrate) navigator.vibrate(pattern);
  }

  // ================ 段位计算 ================
  function getRank(score) {
    for (const r of RANKS) {
      if (score >= r.min) return r;
    }
    return RANKS[RANKS.length - 1];
  }

  // ================ 出题引擎 ================
  function pickQuestions(pool, size, exclude) {
    const excl = new Set(exclude || []);
    const cand = pool.filter(q => !excl.has(q.id));
    if (cand.length <= size) return shuffle(cand).slice(0, size);
    // 按难度分层：低-中-中-高-高
    const buckets = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    for (const q of cand) {
      const d = Math.min(5, Math.max(1, q.difficulty || 2));
      buckets[d].push(q);
    }
    for (const d in buckets) buckets[d] = shuffle(buckets[d]);
    const plan = [1, 2, 2, 3, 3];  // 默认难度节奏
    // 根据用户已完成轮数动态调整
    const rounds = State.userData.rounds || 0;
    const boost = Math.min(2, Math.floor(rounds / 5));
    const dynamic = plan.map(d => Math.min(5, d + boost));
    const out = [];
    const usedIds = new Set();
    for (const d of dynamic) {
      // 优先取该难度，取不到则相邻取
      const order = [d, d - 1, d + 1, d - 2, d + 2].filter(x => x >= 1 && x <= 5);
      for (const dd of order) {
        while (buckets[dd].length) {
          const q = buckets[dd].pop();
          if (!usedIds.has(q.id)) {
            out.push(q); usedIds.add(q.id); break;
          }
        }
        if (out.length === dynamic.indexOf(d) + 1) break;
      }
    }
    // 补齐（万一某档没有）
    while (out.length < size) {
      for (const d in buckets) {
        if (buckets[d].length) {
          const q = buckets[d].pop();
          if (!usedIds.has(q.id)) { out.push(q); usedIds.add(q.id); }
          if (out.length >= size) break;
        }
      }
      break;
    }
    return out.slice(0, size);
  }

  function getFilteredPool() {
    const cat = State.currentCategory;
    if (cat === 'all' || !cat) return State.quiz.questions;
    if (cat.startsWith('cat:')) {
      const c = cat.slice(4);
      return State.quiz.questions.filter(q => q.category === c);
    }
    if (cat.startsWith('dyn:')) {
      const d = cat.slice(4);
      return State.quiz.questions.filter(q => q.dynasty === d);
    }
    return State.quiz.questions;
  }

  // ================ 场景切换 ================
  function showScene(name) {
    ['sceneHome', 'sceneQuiz', 'sceneResult'].forEach(id => {
      const el = document.getElementById(id);
      const active = id === name;
      el.dataset.active = active;
      el.setAttribute('aria-hidden', !active);
    });
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  // ================ 答题流程 ================
  function startRound(mode = 'normal') {
    State.lastMode = mode;
    let pool;
    if (mode === 'wrong') {
      if (State.wrong.length < CONFIG.ROUND_SIZE) {
        toast('错题不足 5 道，先去多练几轮吧');
        return;
      }
      pool = State.wrong.slice();
    } else {
      pool = getFilteredPool();
      if (pool.length < CONFIG.ROUND_SIZE) {
        toast('该分类题目不足，切换到全部');
        State.currentCategory = 'all';
        pool = State.quiz.questions;
      }
    }
    // 30天去重
    const recent = (State.userData.recentQIds || []).slice(-100);
    let picked = pickQuestions(pool, CONFIG.ROUND_SIZE, recent);
    if (picked.length < CONFIG.ROUND_SIZE) {
      picked = pickQuestions(pool, CONFIG.ROUND_SIZE, []);
    }
    State.round = {
      questions: picked,
      idx: 0,
      score: 0,
      results: [],
      startTime: Date.now(),
    };
    showScene('sceneQuiz');
    renderQuestion();
  }

  function renderQuestion() {
    const q = State.round.questions[State.round.idx];
    if (!q) { finishRound(); return; }

    // 头部信息
    const total = State.round.questions.length;
    $('#progressText').textContent = `第 ${State.round.idx + 1} / ${total} 题`;
    $('#progressFill').style.width = `${((State.round.idx) / total) * 100}%`;
    $('#scoreBadge').textContent = `已得 ${State.round.score} 分`;

    $('#qIndex').textContent = State.round.idx + 1;
    $('#qDynasty').textContent = q.dynasty || '综合';
    $('#qDifficulty').textContent = '难度 ' + '★'.repeat(Math.min(5, q.difficulty || 2));
    const catMap = { k12: '📖 教材', event: '⚔ 事件', book: '📚 著作' };
    $('#qCategory').textContent = catMap[q.category] || '综合';
    $('#qText').textContent = q.question;

    // 语音按钮显隐
    $('#btnMic').hidden = !State.settings.voice ||
      !('webkitSpeechRecognition' in window || 'SpeechRecognition' in window);

    // 选项
    const box = $('#options');
    box.innerHTML = '';
    q.options.forEach((opt, i) => {
      const letter = opt.match(/^([A-D])[.、\s]/)?.[1] || 'ABCD'[i];
      const text = opt.replace(/^[A-D][.、\s]*/, '');
      const btn = document.createElement('button');
      btn.className = 'option';
      btn.dataset.letter = letter;
      btn.innerHTML = `<span class="option-letter">${letter}</span><span class="option-text">${text}</span>`;
      btn.addEventListener('click', () => handleAnswer(letter, btn));
      box.appendChild(btn);
    });

    // 反馈区隐藏
    $('#feedback').hidden = true;
    $('#feedback').classList.remove('right', 'wrong');

    // 自动朗读
    if (State.settings.autoRead) speak(q.question);
  }

  function handleAnswer(letter, btnEl) {
    const q = State.round.questions[State.round.idx];
    if (!q) return;
    // 已答，不响应
    if ($$('#options .option.disabled').length) return;
    const correct = letter === q.answer;
    $$('#options .option').forEach(b => {
      b.classList.add('disabled');
      const l = b.dataset.letter;
      if (l === q.answer) b.classList.add('correct');
      if (l === letter && !correct) b.classList.add('wrong');
    });

    if (correct) {
      State.round.score += CONFIG.SCORE_PER;
      playBeep(true);
      vibrate(30);
      // 如果是错题本模式且答对，从错题本移除
      if (State.lastMode === 'wrong') {
        State.wrong = State.wrong.filter(w => w.id !== q.id);
        saveJSON(CONFIG.WRONG_KEY, State.wrong);
      }
    } else {
      playBeep(false);
      vibrate([40, 60, 40]);
      // 加入错题本
      const already = State.wrong.find(w => w.id === q.id);
      if (!already) {
        State.wrong.unshift(q);
        if (State.wrong.length > 200) State.wrong.pop();
        saveJSON(CONFIG.WRONG_KEY, State.wrong);
      }
    }

    // 记录结果
    State.round.results.push({
      qid: q.id, question: q.question, answer: q.answer, user: letter,
      correct, explanation: q.explanation,
    });

    // 更新 recent
    const rec = State.userData.recentQIds || [];
    rec.push(q.id);
    if (rec.length > 200) rec.splice(0, rec.length - 200);
    State.userData.recentQIds = rec;
    saveUserData();

    // 显示反馈
    showFeedback(correct, q);
    $('#scoreBadge').textContent = `已得 ${State.round.score} 分`;
    $('#progressFill').style.width = `${((State.round.idx + 1) / State.round.questions.length) * 100}%`;
  }

  function showFeedback(correct, q) {
    const fb = $('#feedback');
    const [title, tip] = rand(correct ? RIGHT_LINES : WRONG_LINES);
    $('#fbIcon').textContent = correct ? '✔' : '✘';
    $('#fbTitle').textContent = title;
    $('#fbBody').innerHTML = `<p style="margin:0 0 6px;color:${correct ? '#4c7a5e' : '#a02c2c'};font-weight:600;">${tip}</p>` +
      `<p style="margin:0;">正确答案：<b>${q.answer}</b>。${q.explanation || ''}</p>`;
    fb.classList.add(correct ? 'right' : 'wrong');
    fb.hidden = false;
  }

  function nextQuestion() {
    State.round.idx += 1;
    if (State.round.idx >= State.round.questions.length) {
      finishRound();
    } else {
      renderQuestion();
    }
  }

  function finishRound() {
    const score = State.round.score;
    const rank = getRank(score);
    // 累积到用户数据
    State.userData.rounds = (State.userData.rounds || 0) + 1;
    State.userData.bestScore = Math.max(State.userData.bestScore || 0, score);
    // 连胜（本轮 5 题全对 +1 连胜；否则清零）
    const allRight = State.round.results.every(r => r.correct);
    State.userData.streak = allRight ? (State.userData.streak || 0) + 1 : 0;
    State.userData.maxStreak = Math.max(State.userData.maxStreak || 0, State.userData.streak);
    // 最近记录
    const recent = State.userData.recentRounds || [];
    recent.unshift({
      time: Date.now(),
      score,
      rankKey: rank.key,
      rankTitle: rank.title,
      allRight,
    });
    State.userData.recentRounds = recent.slice(0, 10);
    saveUserData();
    renderResult(score, rank);
    showScene('sceneResult');
  }

  function renderResult(score, rank) {
    $('#rankEmblem').textContent = rank.emblem;
    $('#rankTitle').textContent = rank.title;
    $('#rankTitle').style.color = rank.color;
    $('#rankSubtitle').textContent = rank.subtitle;
    $('#rankSubtitle').style.color = rank.color;
    $('#rankScoreNum').textContent = score;
    $('#rankQuote').textContent = `"${rank.quote}"`;

    // 回顾列表
    const list = $('#reviewList');
    list.innerHTML = '';
    State.round.results.forEach((r, i) => {
      const li = document.createElement('li');
      li.className = 'review-item';
      li.innerHTML = `
        <span class="review-mark ${r.correct ? 'right' : 'wrong'}">${r.correct ? '✓' : '✗'}</span>
        <div>
          <div class="review-q">${i + 1}. ${r.question}</div>
          <div class="review-a">你选 ${r.user || '—'} · 正确答案 ${r.answer}</div>
        </div>
      `;
      list.appendChild(li);
    });

    // 粒子动画
    if (score >= 60) startParticles(rank.color, score >= 100 ? 120 : 60);
  }

  // ================ 粒子动画 ================
  let particleAnimId = null;
  function startParticles(color, count) {
    const canvas = $('#particleCanvas');
    const stage = canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = stage.offsetWidth * dpr;
    canvas.height = stage.offsetHeight * dpr;
    canvas.style.width = stage.offsetWidth + 'px';
    canvas.style.height = stage.offsetHeight + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const W = stage.offsetWidth, H = stage.offsetHeight;
    const colors = [color, '#d4a95c', '#a02c2c', '#f6efe0'];
    const ps = [];
    for (let i = 0; i < count; i++) {
      ps.push({
        x: W / 2 + (Math.random() - 0.5) * 60,
        y: 80 + (Math.random() - 0.5) * 40,
        vx: (Math.random() - 0.5) * 4,
        vy: -3 - Math.random() * 4,
        r: 2 + Math.random() * 4,
        color: colors[i % colors.length],
        life: 1,
      });
    }
    cancelAnimationFrame(particleAnimId);
    function frame() {
      ctx.clearRect(0, 0, W, H);
      let alive = 0;
      for (const p of ps) {
        p.vy += 0.12;
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.008;
        if (p.life > 0 && p.y < H + 20) {
          alive++;
          ctx.globalAlpha = Math.max(0, p.life);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      if (alive > 0) particleAnimId = requestAnimationFrame(frame);
    }
    frame();
  }

  // ================ 首页渲染 ================
  function renderHome() {
    // 统计
    $('#statTotal').textContent = State.quiz.metadata.total_count || State.quiz.questions.length;
    $('#statStreak').textContent = State.userData.maxStreak || 0;
    $('#statRounds').textContent = State.userData.rounds || 0;

    // 段位一览
    const grid = $('#rankGrid');
    grid.innerHTML = '';
    RANKS.slice().reverse().forEach(r => {
      const cell = document.createElement('div');
      cell.className = 'rank-cell';
      cell.innerHTML = `
        <div class="rank-cell-emblem">${r.emblem}</div>
        <div class="rank-cell-name" style="color:${r.color}">${r.title}</div>
        <div class="rank-cell-score">${r.min} 分起</div>
      `;
      grid.appendChild(cell);
    });

    // 分类 chips
    const chips = $('#categoryChips');
    chips.innerHTML = '';
    const items = [
      { key: 'all', label: '📚 全部题库' },
      { key: 'cat:k12', label: '📖 教材主干' },
      { key: 'cat:event', label: '⚔ 重大事件' },
      { key: 'cat:book', label: '📜 历史著作' },
      { key: 'dyn:先秦', label: '先秦' },
      { key: 'dyn:秦汉', label: '秦汉' },
      { key: 'dyn:隋唐', label: '隋唐' },
      { key: 'dyn:宋元', label: '宋元' },
      { key: 'dyn:明清', label: '明清' },
      { key: 'dyn:近现代', label: '近现代' },
    ];
    items.forEach(it => {
      const el = document.createElement('button');
      el.className = 'chip' + (State.currentCategory === it.key ? ' active' : '');
      el.textContent = it.label;
      el.addEventListener('click', () => {
        State.currentCategory = it.key;
        renderHome();
      });
      chips.appendChild(el);
    });

    // 最近记录
    const rr = State.userData.recentRounds || [];
    const sec = $('#recentSection');
    if (rr.length) {
      sec.hidden = false;
      const list = $('#recentList');
      list.innerHTML = '';
      rr.slice(0, 5).forEach(rec => {
        const rank = RANKS.find(r => r.key === rec.rankKey) || RANKS[RANKS.length - 1];
        const li = document.createElement('li');
        li.className = 'recent-item';
        const d = new Date(rec.time);
        const time = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        li.innerHTML = `
          <span class="recent-emblem">${rank.emblem}</span>
          <div class="recent-info">
            <div class="recent-title">${rank.title}${rec.allRight ? ' · 全对！' : ''}</div>
            <div class="recent-time">${time}</div>
          </div>
          <span class="recent-score">${rec.score}</span>
        `;
        list.appendChild(li);
      });
    } else {
      sec.hidden = true;
    }
  }

  // ================ 抽屉/设置 ================
  function openDrawer() {
    $('#drawer').setAttribute('aria-hidden', 'false');
    renderDrawer();
  }
  function closeDrawer() { $('#drawer').setAttribute('aria-hidden', 'true'); }
  function renderDrawer() {
    const rank = getRank(State.userData.bestScore || 0);
    $('#myRankEmblem').textContent = rank.emblem;
    $('#myRankTitle').textContent = rank.title;
    $('#myRankTitle').style.color = rank.color;
    $('#myBestScore').textContent = State.userData.bestScore || 0;
    $('#myRounds').textContent = State.userData.rounds || 0;
    $('#wrongCount').textContent = State.wrong.length;
    $('#setSound').checked = State.settings.sound;
    $('#setAutoRead').checked = State.settings.autoRead;
    $('#setVoice').checked = State.settings.voice;
  }

  // ================ 数据持久化 ================
  function saveUserData() { saveJSON(CONFIG.STORAGE_KEY, State.userData); }
  function saveSettings() { saveJSON(CONFIG.SETTINGS_KEY, State.settings); }

  // ================ 事件绑定 ================
  function bindEvents() {
    $('#btnStart').addEventListener('click', () => startRound('normal'));
    $('#btnNext').addEventListener('click', nextQuestion);
    $('#btnQuit').addEventListener('click', () => {
      if (confirm('确定退出当前答题？分数将不计入。')) showScene('sceneHome');
    });
    $('#btnAgain').addEventListener('click', () => startRound(State.lastMode));
    $('#btnBackHome').addEventListener('click', () => { showScene('sceneHome'); renderHome(); });
    $('#btnMenu').addEventListener('click', openDrawer);
    $('#btnCloseDrawer').addEventListener('click', closeDrawer);
    $('#drawerMask').addEventListener('click', closeDrawer);
    $('#btnReviewWrong').addEventListener('click', () => {
      closeDrawer();
      startRound('wrong');
    });
    $('#btnResetAll').addEventListener('click', () => {
      if (confirm('确定清空所有战绩、错题和设置？此操作不可恢复。')) {
        localStorage.removeItem(CONFIG.STORAGE_KEY);
        localStorage.removeItem(CONFIG.WRONG_KEY);
        localStorage.removeItem(CONFIG.SETTINGS_KEY);
        State.userData = {};
        State.wrong = [];
        State.settings = { sound: true, autoRead: false, voice: false };
        renderHome();
        renderDrawer();
        toast('已清空所有数据');
      }
    });
    $('#setSound').addEventListener('change', e => { State.settings.sound = e.target.checked; saveSettings(); });
    $('#setAutoRead').addEventListener('change', e => { State.settings.autoRead = e.target.checked; saveSettings(); });
    $('#setVoice').addEventListener('change', e => { State.settings.voice = e.target.checked; saveSettings(); });
    $('#btnSpeak').addEventListener('click', () => {
      const q = State.round.questions[State.round.idx];
      if (q) speak(q.question);
    });
    $('#btnMic').addEventListener('click', voiceInput);

    // 网络状态
    const updateNet = () => {
      $('#offlineBadge').hidden = navigator.onLine;
    };
    window.addEventListener('online', updateNet);
    window.addEventListener('offline', updateNet);
    updateNet();
  }

  // ================ 语音识别 ================
  function voiceInput() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { toast('当前浏览器不支持语音识别'); return; }
    const rec = new SR();
    rec.lang = 'zh-CN';
    rec.interimResults = false;
    rec.maxAlternatives = 3;
    toast('请说：A / B / C / D 或答案文字');
    rec.onresult = (e) => {
      const txt = e.results[0][0].transcript.trim();
      toast(`听到：${txt}`);
      // 匹配 ABCD
      const letter = txt.match(/[abcdABCD]/)?.[0]?.toUpperCase() ||
        { '一': 'A', '二': 'B', '三': 'C', '四': 'D' }[txt[0]] ||
        (txt.includes('第一') ? 'A' : txt.includes('第二') ? 'B' :
          txt.includes('第三') ? 'C' : txt.includes('第四') ? 'D' : null);
      if (letter) {
        const btn = document.querySelector(`.option[data-letter="${letter}"]`);
        if (btn) btn.click();
      } else {
        toast('未识别，请说 A/B/C/D');
      }
    };
    rec.onerror = () => toast('语音识别失败');
    try { rec.start(); } catch (e) { toast('无法启动麦克风'); }
  }

  // ================ 启动 ================
  async function boot() {
    // 载入用户数据 & 设置
    State.userData = loadJSON(CONFIG.STORAGE_KEY, {});
    State.wrong = loadJSON(CONFIG.WRONG_KEY, []);
    const savedSet = loadJSON(CONFIG.SETTINGS_KEY, null);
    if (savedSet) State.settings = { ...State.settings, ...savedSet };

    // 载入题库
    try {
      const r = await fetch(CONFIG.QUIZ_FILE + '?v=' + Date.now(), { cache: 'no-cache' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      State.quiz = await r.json();
    } catch (e) {
      console.error('加载题库失败', e);
      toast('题库加载失败，请刷新重试');
      return;
    }

    bindEvents();
    renderHome();
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
