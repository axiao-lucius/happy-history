/**
 * app.js — 快乐学历史 SPA 主应用入口
 * 负责页面路由、初始化、答题流程编排、语音交互集成
 */
(function () {
  'use strict';

  // ==================== 常量与配置 ====================

  var PAGES = ['home', 'quiz', 'rank', 'profile'];
  var ROUND_SIZE = 5;
  var VOICE_CONFIDENCE_THRESHOLD = 0.6;

  var DAILY_QUOTES = [
    '以铜为镜，可以正衣冠；以古为镜，可以知兴替。——唐太宗',
    '读史使人明智，读诗使人灵秀。——培根',
    '前事不忘，后事之师。——《战国策》',
    '鉴前世之兴衰，考当今之得失。——司马光',
    '究天人之际，通古今之变，成一家之言。——司马迁',
    '欲知大道，必先为史。——龚自珍',
    '灭人之国，必先去其史。——龚自珍',
    '一切历史都是当代史。——克罗齐',
    '历史是国家和人类的传记。——伏尔泰',
    '忘记历史就意味着背叛。——列宁'
  ];

  var RANK_TIERS = [
    { tier: 'king_glory', title: '荣耀王者·史学宗师', emoji: '👑', color: '#FFD700' },
    { tier: 'king_strong', title: '最强王者·博古通今', emoji: '⭐', color: '#FF6B6B' },
    { tier: 'star', title: '至尊星耀·学有所成', emoji: '💎', color: '#9B59B6' },
    { tier: 'diamond', title: '永恒钻石·初窥门径', emoji: '🔷', color: '#3498DB' },
    { tier: 'platinum', title: '尊贵铂金·再接再厉', emoji: '🥉', color: '#1ABC9C' },
    { tier: 'bronze', title: '不屈青铜·从头再来', emoji: '🛡️', color: '#95A5A6' }
  ];

  // ==================== 应用状态 ====================

  var _state = {
    currentPage: 'home',
    roundQuestions: [],
    currentQuestionIndex: 0,
    roundCorrectCount: 0,
    isRoundActive: false,
    waitingForConfirm: false,
    voiceSupported: false
  };

  // ==================== 工具函数 ====================

  function safeCall(namespace, method) {
    var args = Array.prototype.slice.call(arguments, 2);
    if (window[namespace] && typeof window[namespace][method] === 'function') {
      return window[namespace][method].apply(window[namespace], args);
    }
    return null;
  }

  function $(selector) { return document.querySelector(selector); }
  function $$(selector) { return document.querySelectorAll(selector); }

  function getRandomQuote() {
    return DAILY_QUOTES[Math.floor(Math.random() * DAILY_QUOTES.length)];
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function showToast(message) {
    var toast = document.createElement('div');
    toast.className = 'app-toast';
    toast.textContent = message;
    toast.style.cssText = 'position:fixed;top:20%;left:50%;transform:translateX(-50%);' +
      'background:rgba(0,0,0,0.8);color:#fff;padding:12px 24px;border-radius:8px;' +
      'z-index:10000;font-size:14px;text-align:center;max-width:80%;transition:opacity 0.3s;';
    document.body.appendChild(toast);
    setTimeout(function () {
      toast.style.opacity = '0';
      setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
    }, 2500);
  }

  // ==================== 页面路由 ====================

  function switchPage(pageName) {
    if (PAGES.indexOf(pageName) === -1) return;

    var pageContainers = $$('[data-page]');
    for (var i = 0; i < pageContainers.length; i++) {
      pageContainers[i].classList.remove('active');
    }

    var target = $('[data-page="' + pageName + '"]');
    if (target) target.classList.add('active');

    var navItems = $$('.nav-tab[data-target]');
    for (var j = 0; j < navItems.length; j++) {
      navItems[j].classList.remove('active');
      if (navItems[j].getAttribute('data-target') === pageName) {
        navItems[j].classList.add('active');
      }
    }

    _state.currentPage = pageName;

    if (pageName === 'home') renderHomePage();
    else if (pageName === 'rank') renderRankPage();
    else if (pageName === 'profile') renderProfilePage();
  }

  function bindNavigation() {
    var navItems = $$('.nav-tab[data-target]');
    for (var i = 0; i < navItems.length; i++) {
      navItems[i].addEventListener('click', function (e) {
        e.preventDefault();
        var target = this.getAttribute('data-target');
        if (target && target !== _state.currentPage) {
          if (_state.isRoundActive && _state.currentPage === 'quiz') {
            if (!confirm('答题进行中，确定要离开吗？当前进度将丢失。')) return;
            _state.isRoundActive = false;
          }
          switchPage(target);
        }
      });
    }
  }

  // ==================== 首页(home) ====================

  function renderHomePage() {
    var adaptiveState = AdaptiveSystem.getState();
    var todayAnswered = adaptiveState.today_answered_ids ? adaptiveState.today_answered_ids.length : 0;
    var currentStreak = adaptiveState.current_streak_in_round || 0;
    var completedStreaks = adaptiveState.completed_streaks_today || 0;

    var statusEl = $('#home-today-status');
    if (statusEl) {
      statusEl.innerHTML =
        '<div class="status-item"><span class="status-value">' + todayAnswered + '</span><span class="status-label">今日已答</span></div>' +
        '<div class="status-item"><span class="status-value">' + currentStreak + '</span><span class="status-label">当前连胜</span></div>' +
        '<div class="status-item"><span class="status-value">' + completedStreaks + '</span><span class="status-label">完成轮次</span></div>';
    }

    var quoteEl = $('#home-daily-quote');
    if (quoteEl) quoteEl.textContent = getRandomQuote();

    var voiceTipEl = $('#home-voice-tip');
    if (voiceTipEl) {
      if (!_state.voiceSupported) {
        voiceTipEl.style.display = 'block';
        voiceTipEl.textContent = '💡 建议开启语音以获得最佳体验';
      } else {
        voiceTipEl.style.display = 'none';
      }
    }

    var startBtn = $('#btn-start-challenge');
    if (startBtn) {
      var newBtn = startBtn.cloneNode(true);
      startBtn.parentNode.replaceChild(newBtn, startBtn);
      newBtn.addEventListener('click', function () {
        switchPage('quiz');
        startRound();
      });
    }
  }

  // ==================== 答题流程(quiz) ====================

  function startRound() {
    _state.roundQuestions = [];
    _state.currentQuestionIndex = 0;
    _state.roundCorrectCount = 0;
    _state.isRoundActive = true;
    _state.waitingForConfirm = false;

    var adaptiveState = AdaptiveSystem.getState();
    var batchConfig = AdaptiveSystem.getNextBatch(adaptiveState);
    var isFirstQuestionToday = !adaptiveState.today_answered_ids || adaptiveState.today_answered_ids.length === 0;
    var excludeIds = (adaptiveState.today_answered_ids || []).slice();
    var questions = [];

    for (var i = 0; i < batchConfig.length; i++) {
      var config = batchConfig[i];
      var q = null;

      if (i === 0 && isFirstQuestionToday) {
        q = QuizEngine.getDailyFirstQuestion();
      }

      if (!q) {
        var candidates = QuizEngine.getRandomQuestions(1, { min: config.min, max: config.max }, excludeIds);
        if (candidates && candidates.length > 0) q = candidates[0];
      }

      if (q) {
        questions.push(q);
        excludeIds.push(q.id);
      }
    }

    if (questions.length === 0) {
      showQuizError('暂无可用题目，请稍后再试。');
      return;
    }

    _state.roundQuestions = questions;
    safeCall('StreakCounter', 'reset');
    safeCall('QuizCard', 'reset');
    renderCurrentQuestion();
  }

  function renderCurrentQuestion() {
    if (_state.currentQuestionIndex >= _state.roundQuestions.length) {
      endRound(_state.roundCorrectCount);
      return;
    }

    var question = _state.roundQuestions[_state.currentQuestionIndex];
    var progressText = (_state.currentQuestionIndex + 1) + ' / ' + _state.roundQuestions.length;

    var progressEl = $('#quiz-progress');
    if (progressEl) progressEl.textContent = progressText;

    safeCall('QuizCard', 'render', question, {
      onOptionClick: handleAnswer,
      showMicButton: _state.voiceSupported
    });

    if (!window.QuizCard || typeof window.QuizCard.render !== 'function') {
      renderFallbackQuestion(question);
    }

    bindMicButton(question);
  }

  function renderFallbackQuestion(question) {
    var container = $('#quiz-card-container');
    if (!container) return;

    var optionsHtml = '';
    var labels = ['A', 'B', 'C', 'D'];
    var options = question.options || [];

    for (var i = 0; i < options.length; i++) {
      optionsHtml += '<div class="quiz-option" data-option="' + labels[i] + '">' +
        '<span class="option-label">' + labels[i] + '</span>' +
        '<span class="option-text">' + escapeHtml(options[i]) + '</span></div>';
    }

    container.innerHTML =
      '<div class="quiz-card-fallback">' +
        '<div class="question-dynasty">' + escapeHtml(question.dynasty || '') + '</div>' +
        '<div class="question-text">' + escapeHtml(question.question || question.text || '') + '</div>' +
        '<div class="options-list">' + optionsHtml + '</div>' +
        (_state.voiceSupported ? '<button id="btn-mic" class="mic-btn">🎤 语音回答</button>' : '') +
      '</div>';

    var optionEls = container.querySelectorAll('.quiz-option');
    for (var j = 0; j < optionEls.length; j++) {
      optionEls[j].addEventListener('click', function () {
        handleAnswer(this.getAttribute('data-option'));
      });
    }
  }

  function handleAnswer(selectedOption) {
    if (_state.waitingForConfirm || !_state.isRoundActive) return;
    _state.waitingForConfirm = true;

    var question = _state.roundQuestions[_state.currentQuestionIndex];
    var correctAnswer = question.answer || question.correctAnswer || '';
    var isCorrect = (selectedOption === correctAnswer);

    var adaptiveState = AdaptiveSystem.getState();
    if (!adaptiveState.today_answered_ids) adaptiveState.today_answered_ids = [];
    if (adaptiveState.today_answered_ids.indexOf(question.id) === -1) {
      adaptiveState.today_answered_ids.push(question.id);
    }
    adaptiveState = AdaptiveSystem.recordAnswer(adaptiveState, isCorrect);

    if (!isCorrect) StateManager.addToWrongBook(question);
    StateManager.updateStats(isCorrect, adaptiveState.current_streak_in_round || 0);

    if (isCorrect) {
      _state.roundCorrectCount++;
      safeCall('StreakCounter', 'update', adaptiveState.current_streak_in_round || 0);
      if ((adaptiveState.current_streak_in_round || 0) >= 3) {
        safeCall('StreakCounter', 'showCombo', adaptiveState.current_streak_in_round);
      }
    } else {
      safeCall('StreakCounter', 'reset');
    }

    var estimatedScore = ScoringSystem.calculateScore(_state.roundCorrectCount, _state.currentQuestionIndex + 1);
    var currentRank = ScoringSystem.getRank(estimatedScore);

    safeCall('QuizCard', 'showFeedback', isCorrect, {
      correctAnswer: correctAnswer,
      explanation: question.explanation || ''
    });

    if (!window.QuizCard || typeof window.QuizCard.showFeedback !== 'function') {
      showFallbackFeedback(isCorrect, correctAnswer, question.explanation);
    }

    safeCall('QuizCard', 'highlightOption', selectedOption, isCorrect);

    var feedbackVoice = ScoringSystem.getFeedbackVoice(currentRank, isCorrect);
    VoiceEngine.speak(feedbackVoice, { emotion: isCorrect ? 'excited' : 'comfort' });
  }

  function showFallbackFeedback(isCorrect, correctAnswer, explanation) {
    var container = $('#quiz-feedback');
    if (!container) {
      var parent = $('#quiz-card-container');
      if (parent) {
        container = document.createElement('div');
        container.id = 'quiz-feedback';
        parent.appendChild(container);
      }
    }
    if (!container) return;

    container.className = isCorrect ? 'feedback-correct' : 'feedback-wrong';
    container.innerHTML =
      '<div class="feedback-header">' +
        '<span class="feedback-icon">' + (isCorrect ? '✅' : '❌') + '</span>' +
        '<span class="feedback-title">' + (isCorrect ? '回答正确！' : '回答错误') + '</span>' +
      '</div>' +
      (!isCorrect ? '<div class="feedback-correct-answer">正确答案：' + escapeHtml(correctAnswer) + '</div>' : '') +
      (explanation ? '<div class="feedback-explanation">' + escapeHtml(explanation) + '</div>' : '') +
      '<button class="btn-next-question">下一题 →</button>';
    container.style.display = 'block';

    var nextBtn = container.querySelector('.btn-next-question');
    if (nextBtn) {
      nextBtn.addEventListener('click', function () {
        container.style.display = 'none';
        nextQuestion();
      });
    }
  }

  function nextQuestion() {
    _state.waitingForConfirm = false;
    _state.currentQuestionIndex++;
    if (_state.currentQuestionIndex >= _state.roundQuestions.length) {
      endRound(_state.roundCorrectCount);
    } else {
      renderCurrentQuestion();
    }
  }

  function endRound(correctCount) {
    _state.isRoundActive = false;
    _state.waitingForConfirm = false;

    var totalQuestions = _state.roundQuestions.length;
    var score = ScoringSystem.calculateScore(correctCount, totalQuestions);
    var rank = ScoringSystem.getRank(score);
    var encouragement = ScoringSystem.getEncouragementText(rank, correctCount);

    var historyStats = StateManager.getHistoryStats();
    var achievementStats = {
      bestScore: Math.max(score, historyStats.bestScore || 0),
      currentStreak: historyStats.maxStreak || 0,
      totalCorrect: historyStats.totalCorrect || 0,
      unlockedTiers: getUnlockedTiers(),
      existingAchievements: (StateManager.getAchievements() || []).map(function (a) { return a.id; })
    };

    var achievementResult = ScoringSystem.checkAchievements(achievementStats);

    if (achievementResult.newAchievements && achievementResult.newAchievements.length > 0) {
      for (var i = 0; i < achievementResult.newAchievements.length; i++) {
        StateManager.unlockAchievement(achievementResult.newAchievements[i].id);
      }
    }

    if (score > (historyStats.bestScore || 0)) {
      historyStats.bestScore = score;
      StateManager.save('happy_history_stats', historyStats);
    }

    saveUnlockedTier(rank.tier);

    safeCall('RankReveal', 'show', {
      score: score, rank: rank, correctCount: correctCount,
      totalQuestions: totalQuestions, encouragement: encouragement,
      newAchievements: achievementResult.newAchievements,
      onDismiss: function () { safeCall('RankReveal', 'hide'); switchPage('home'); }
    });

    if (!window.RankReveal || typeof window.RankReveal.show !== 'function') {
      showFallbackRoundResult(score, rank, correctCount, totalQuestions, encouragement, achievementResult.newAchievements);
    }

    VoiceEngine.speak(encouragement, { emotion: score >= 60 ? 'excited' : 'encourage' });
  }

  function showFallbackRoundResult(score, rank, correctCount, totalQuestions, encouragement, newAchievements) {
    var container = $('#quiz-result-overlay');
    if (!container) {
      container = document.createElement('div');
      container.id = 'quiz-result-overlay';
      container.className = 'result-overlay';
      document.body.appendChild(container);
    }

    var achHtml = '';
    if (newAchievements && newAchievements.length > 0) {
      achHtml = '<div class="new-achievements"><h3>🎉 新成就解锁！</h3>';
      for (var i = 0; i < newAchievements.length; i++) {
        achHtml += '<div class="achievement-item"><span class="achievement-icon">' +
          newAchievements[i].icon + '</span><span class="achievement-name">' +
          escapeHtml(newAchievements[i].name) + '</span></div>';
      }
      achHtml += '</div>';
    }

    container.innerHTML =
      '<div class="result-card">' +
        '<div class="result-rank-emoji" style="font-size:4rem;">' + rank.emoji + '</div>' +
        '<div class="result-rank-title" style="color:' + rank.color + ';">' + escapeHtml(rank.title) + '</div>' +
        '<div class="result-score">' + score + '分</div>' +
        '<div class="result-detail">答对 ' + correctCount + ' / ' + totalQuestions + ' 题</div>' +
        '<div class="result-encouragement">' + escapeHtml(encouragement) + '</div>' +
        achHtml +
        '<button class="btn-back-home">返回首页</button>' +
      '</div>';
    container.style.display = 'flex';

    var backBtn = container.querySelector('.btn-back-home');
    if (backBtn) {
      backBtn.addEventListener('click', function () {
        container.style.display = 'none';
        switchPage('home');
      });
    }
  }

  function showQuizError(message) {
    var container = $('#quiz-card-container');
    if (container) {
      container.innerHTML = '<div class="quiz-error"><p>' + escapeHtml(message) +
        '</p><button class="btn-back-home-error">返回首页</button></div>';
      var btn = container.querySelector('.btn-back-home-error');
      if (btn) btn.addEventListener('click', function () { switchPage('home'); });
    }
  }

  // ==================== 语音交互集成 ====================

  function bindMicButton(question) {
    setTimeout(function () {
      var micBtn = $('#btn-mic') || $('.mic-btn');
      if (!micBtn) return;

      var newMic = micBtn.cloneNode(true);
      micBtn.parentNode.replaceChild(newMic, micBtn);

      newMic.addEventListener('click', function () {
        if (_state.waitingForConfirm) return;
        newMic.classList.add('listening');
        newMic.textContent = '🎤 正在听...';

        VoiceEngine.startListening(
          function (transcript) {
            newMic.classList.remove('listening');
            newMic.textContent = '🎤 语音回答';

            var optionTexts = {};
            var labels = ['A', 'B', 'C', 'D'];
            var options = question.options || [];
            for (var i = 0; i < options.length; i++) optionTexts[labels[i]] = options[i];

            var correctAnswer = question.answer || question.correctAnswer || '';
            var matchResult = VoiceEngine.matchAnswer(transcript, correctAnswer, { optionTexts: optionTexts });

            if (matchResult.confidence >= VOICE_CONFIDENCE_THRESHOLD && matchResult.matchedOption) {
              handleAnswer(matchResult.matchedOption);
            } else {
              VoiceEngine.speak('没听清，请再说一次或点击选项', { emotion: 'normal' });
              showToast('没听清，请再说一次或点击选项');
            }
          },
          function (error) {
            newMic.classList.remove('listening');
            newMic.textContent = '🎤 语音回答';
            console.warn('[App] Voice recognition error:', error);
            showToast('语音识别失败，请点击选项作答');
          }
        );
      });
    }, 100);
  }

  // ==================== 段位页(rank) ====================

  function getUnlockedTiers() {
    var tiers = StateManager.load('happy_history_unlocked_tiers');
    return Array.isArray(tiers) ? tiers : [];
  }

  function saveUnlockedTier(tier) {
    var tiers = getUnlockedTiers();
    if (tiers.indexOf(tier) === -1) {
      tiers.push(tier);
      StateManager.save('happy_history_unlocked_tiers', tiers);
    }

    var history = StateManager.load('happy_history_rank_history') || [];
    var today = new Date();
    var dateStr = today.getFullYear() + '-' +
      String(today.getMonth() + 1).padStart(2, '0') + '-' +
      String(today.getDate()).padStart(2, '0');
    var stats = StateManager.getHistoryStats();
    var rankInfo = ScoringSystem.getRank(stats.bestScore || 0);

    history.push({
      date: dateStr, tier: tier, rankTitle: rankInfo.title,
      score: stats.bestScore || 0, timestamp: today.toISOString()
    });
    StateManager.save('happy_history_rank_history', history);
  }

  function renderRankPage() {
    var historyStats = StateManager.getHistoryStats();
    var bestScore = historyStats.bestScore || 0;
    var currentRank = ScoringSystem.getRank(bestScore);
    var unlockedTiers = getUnlockedTiers();

    var currentRankEl = $('#rank-current');
    if (currentRankEl) {
      currentRankEl.innerHTML =
        '<div class="rank-display">' +
          '<div class="rank-emoji" style="font-size:3rem;">' + currentRank.emoji + '</div>' +
          '<div class="rank-title" style="color:' + currentRank.color + ';">' + escapeHtml(currentRank.title) + '</div>' +
          '<div class="rank-score">最高分：' + bestScore + '</div>' +
        '</div>';
    }

    var galleryEl = $('#rank-gallery');
    if (galleryEl) {
      var html = '';
      for (var i = 0; i < RANK_TIERS.length; i++) {
        var t = RANK_TIERS[i];
        var isUnlocked = unlockedTiers.indexOf(t.tier) !== -1;
        html += '<div class="tier-item ' + (isUnlocked ? 'tier-unlocked' : 'tier-locked') +
          '" style="opacity:' + (isUnlocked ? '1' : '0.3') + ';">' +
          '<div class="tier-emoji">' + t.emoji + '</div>' +
          '<div class="tier-title" style="color:' + t.color + ';">' + escapeHtml(t.title) + '</div>' +
          '<div class="tier-badge">' + (isUnlocked ? '已解锁' : '未解锁') + '</div></div>';
      }
      galleryEl.innerHTML = html;
    }

    var historyEl = $('#rank-history');
    if (historyEl) {
      var rankHistory = StateManager.load('happy_history_rank_history') || [];
      if (rankHistory.length === 0) {
        historyEl.innerHTML = '<p class="empty-hint">暂无段位记录，快去答题吧！</p>';
      } else {
        var hHtml = '';
        var recent = rankHistory.slice(-10).reverse();
        for (var r = 0; r < recent.length; r++) {
          var rec = recent[r];
          hHtml += '<div class="rank-record">' +
            '<span class="record-date">' + escapeHtml(rec.date || '') + '</span>' +
            '<span class="record-rank">' + escapeHtml(rec.rankTitle || '') + '</span>' +
            '<span class="record-score">' + (rec.score || 0) + '分</span></div>';
        }
        historyEl.innerHTML = hHtml;
      }
    }
  }

  // ==================== 个人页(profile) ====================

  function renderProfilePage() {
    var stats = StateManager.getHistoryStats();

    var statsEl = $('#profile-stats');
    if (statsEl) {
      statsEl.innerHTML =
        '<div class="stat-grid">' +
          '<div class="stat-item"><span class="stat-value">' + (stats.totalAnswered || 0) + '</span><span class="stat-label">总答题数</span></div>' +
          '<div class="stat-item"><span class="stat-value">' + (stats.accuracy || 0) + '%</span><span class="stat-label">正确率</span></div>' +
          '<div class="stat-item"><span class="stat-value">' + (stats.maxStreak || 0) + '</span><span class="stat-label">最高连胜</span></div>' +
          '<div class="stat-item"><span class="stat-value">' + (stats.totalCorrect || 0) + '</span><span class="stat-label">累计答对</span></div>' +
        '</div>';
    }

    renderWrongBook();
    renderAchievements();
    bindDataOperations();
    renderAboutInfo();
  }

  function renderWrongBook() {
    var container = $('#profile-wrong-book');
    if (!container) return;

    var wrongBook = StateManager.getWrongBook();
    if (wrongBook.length === 0) {
      container.innerHTML = '<p class="empty-hint">🎉 暂无错题，继续保持！</p>';
      return;
    }

    var html = '<div class="wrong-book-header"><h3>📝 错题本 (' + wrongBook.length + ')</h3></div><div class="wrong-book-list">';
    for (var i = 0; i < wrongBook.length; i++) {
      var q = wrongBook[i];
      html += '<div class="wrong-item" data-id="' + escapeHtml(q.id) + '">' +
        '<div class="wrong-question"><span class="wrong-dynasty">' + escapeHtml(q.dynasty || '') +
        '</span><span class="wrong-text">' + escapeHtml(q.question || q.text || '') + '</span></div>' +
        '<button class="btn-remove-wrong" data-id="' + escapeHtml(q.id) + '">已掌握 ✕</button></div>';
    }
    html += '</div>';
    container.innerHTML = html;

    var removeBtns = container.querySelectorAll('.btn-remove-wrong');
    for (var j = 0; j < removeBtns.length; j++) {
      removeBtns[j].addEventListener('click', function () {
        StateManager.removeFromWrongBook(this.getAttribute('data-id'));
        renderWrongBook();
      });
    }
  }

  function renderAchievements() {
    var container = $('#profile-achievements');
    if (!container) return;

    var unlockedAchievements = StateManager.getAchievements();
    var unlockedIds = {};
    for (var i = 0; i < unlockedAchievements.length; i++) {
      unlockedIds[unlockedAchievements[i].id] = true;
    }

    var stats = StateManager.getHistoryStats();
    var achievementResult = ScoringSystem.checkAchievements({
      bestScore: stats.bestScore || 0,
      currentStreak: stats.maxStreak || 0,
      totalCorrect: stats.totalCorrect || 0,
      unlockedTiers: getUnlockedTiers(),
      existingAchievements: Object.keys(unlockedIds)
    });

    var allAchievements = achievementResult.allAchievements || [];
    if (allAchievements.length === 0) {
      container.innerHTML = '<p class="empty-hint">暂无成就信息</p>';
      return;
    }

    var html = '<h3>🏅 成就墙</h3><div class="achievement-grid">';
    for (var j = 0; j < allAchievements.length; j++) {
      var ach = allAchievements[j];
      html += '<div class="achievement-badge ' + (ach.unlocked ? 'achievement-unlocked' : 'achievement-locked') +
        '" style="opacity:' + (ach.unlocked ? '1' : '0.4') + ';">' +
        '<div class="badge-icon">' + ach.icon + '</div>' +
        '<div class="badge-name">' + escapeHtml(ach.name) + '</div>' +
        '<div class="badge-desc">' + escapeHtml(ach.description) + '</div></div>';
    }
    html += '</div>';
    container.innerHTML = html;
  }

  function bindDataOperations() {
    var exportBtn = $('#btn-export-data');
    if (exportBtn) {
      var newExport = exportBtn.cloneNode(true);
      exportBtn.parentNode.replaceChild(newExport, exportBtn);
      newExport.addEventListener('click', function () {
        var jsonStr = StateManager.exportData();
        var blob = new Blob([jsonStr], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'happy-history-backup-' + new Date().toISOString().slice(0, 10) + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('数据导出成功');
      });
    }

    var importBtn = $('#btn-import-data');
    var importFile = $('#import-file-input');
    if (importBtn && importFile) {
      var newImport = importBtn.cloneNode(true);
      importBtn.parentNode.replaceChild(newImport, importBtn);
      var newFile = importFile.cloneNode(true);
      importFile.parentNode.replaceChild(newFile, importFile);

      newImport.addEventListener('click', function () { newFile.click(); });
      newFile.addEventListener('change', function () {
        if (!this.files || !this.files[0]) return;
        var reader = new FileReader();
        reader.onload = function (e) {
          var success = StateManager.importData(e.target.result);
          if (success) {
            showToast('数据导入成功，页面即将刷新');
            setTimeout(function () { location.reload(); }, 1500);
          } else {
            showToast('数据导入失败，请检查文件格式');
          }
        };
        reader.readAsText(this.files[0]);
      });
    }
  }

  function renderAboutInfo() {
    var aboutEl = $('#profile-about');
    if (!aboutEl) return;
    aboutEl.innerHTML =
      '<div class="about-section">' +
        '<h3>关于</h3>' +
        '<p>快乐学历史 v1.0</p>' +
        '<p>让历史学习变得有趣！通过自适应难度、语音交互和段位系统，每天进步一点点。</p>' +
        '<p class="about-copy">© 2024 Happy History</p>' +
      '</div>';
  }

  // ==================== 初始化 ====================

  function init() {
    console.log('[App] Initializing...');

    // 加载题库
    QuizEngine.loadQuizData()
      .then(function () {
        console.log('[App] Quiz data loaded.');
      })
      .catch(function (err) {
        console.error('[App] Failed to load quiz data:', err);
        showToast('题库加载失败，请检查网络后刷新');
      });

    // 初始化语音引擎
    VoiceEngine.init();
    _state.voiceSupported = VoiceEngine.isSupported();

    // 监听语音不支持事件
    window.addEventListener('voiceEngine:unsupported', function () {
      _state.voiceSupported = false;
    });

    // 初始化当日自适应状态
    AdaptiveSystem.initDailyState();

    // 绑定底部导航
    bindNavigation();

    // 渲染首页
    renderHomePage();

    console.log('[App] Initialization complete. Voice supported:', _state.voiceSupported);
  }

  // ==================== 暴露公共API ====================

  window.App = {
    switchPage: switchPage,
    startRound: startRound,
    getState: function () { return _state; }
  };

  // ==================== DOMContentLoaded 启动 ====================

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
