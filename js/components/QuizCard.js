/**
 * QuizCard — 答题卡片组件
 * 渲染题目、选项、反馈动画，依赖 VoiceEngine / QuizEngine
 */
;(function () {
  'use strict';

  var CONTAINER_SELECTOR = '#quiz-container';
  var FEEDBACK_DELAY = 3000; // 3秒后自动进入下一题

  /* ---------- helpers ---------- */

  function getContainer() {
    return document.querySelector(CONTAINER_SELECTOR);
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  /** 生成难度星级字符串 */
  function difficultyStars(level) {
    var n = Math.min(Math.max(parseInt(level, 10) || 1, 1), 5);
    return '★'.repeat(n) + '☆'.repeat(5 - n);
  }

  /* ---------- core API ---------- */

  var QuizCard = {

    /**
     * render(question, index, total)
     * @param {Object} question - { text, options:[], dynasty, difficulty }
     * @param {number} index   - 当前题号 (0-based)
     * @param {number} total   - 总题数
     */
    render: function (question, index, total) {
      var container = getContainer();
      if (!container) return;
      container.innerHTML = '';

      // --- 卡片容器 ---
      var card = el('div', 'card quiz-card');

      // 顶部信息栏：题号 + 朝代标签 + 难度
      var header = el('div');
      // TODO: 添加到main.css — .quiz-card-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:var(--space-sm); font-size:var(--fs-sm); }
      header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;font-size:0.875rem;';

      var progressLabel = el('span', '', '第' + (index + 1) + '/' + total + '题');
      var dynastyTag = el('span', 'text-vermilion', question.dynasty || '');
      // TODO: 添加到main.css — .dynasty-tag { padding:2px 8px; border:1px solid var(--color-vermilion); border-radius:var(--radius-sm); font-size:var(--fs-xs); }
      dynastyTag.style.cssText = 'padding:2px 8px;border:1px solid var(--color-vermilion);border-radius:4px;font-size:0.75rem;';
      var stars = el('span', 'text-gold', difficultyStars(question.difficulty));

      header.appendChild(progressLabel);
      header.appendChild(dynastyTag);
      header.appendChild(stars);
      card.appendChild(header);

      // --- 进度条 ---
      var progressBar = el('div', 'quiz-progress');
      var progressFill = el('div', 'quiz-progress-bar');
      progressFill.style.width = ((index + 1) / total * 100) + '%';
      progressBar.appendChild(progressFill);
      card.appendChild(progressBar);

      // --- 题目文本 ---
      var questionText = el('div', 'quiz-question', question.text);
      card.appendChild(questionText);

      // --- 选项列表 ---
      var optionsWrap = el('div', 'quiz-options');
      var letters = ['A', 'B', 'C', 'D'];
      (question.options || []).forEach(function (opt, i) {
        var btn = el('div', 'quiz-option option-btn');
        btn.setAttribute('data-letter', letters[i]);
        btn.textContent = letters[i] + '. ' + opt;
        btn.addEventListener('click', function () {
          QuizCard.onSelect(letters[i]);
        });
        optionsWrap.appendChild(btn);
      });
      card.appendChild(optionsWrap);

      // --- 语音输入按钮 ---
      var voiceBtn = el('button', 'btn btn-block mt-md');
      // TODO: 添加到main.css — .voice-btn { display:flex; align-items:center; justify-content:center; gap:6px; }
      voiceBtn.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:6px;';
      voiceBtn.innerHTML = '<span style="font-size:1.3rem">🎙️</span> 语音作答';
      voiceBtn.addEventListener('click', function () {
        if (window.VoiceEngine && typeof window.VoiceEngine.startListening === 'function') {
          window.VoiceEngine.startListening();
        }
      });
      card.appendChild(voiceBtn);

      container.appendChild(card);
    },

    /**
     * onSelect(letter) — 选项点击回调，由外部或内部调用
     */
    onSelect: function (letter) {
      if (window.QuizEngine && typeof window.QuizEngine.handleAnswer === 'function') {
        window.QuizEngine.handleAnswer(letter);
      }
    },

    /**
     * showFeedback(isCorrect, explanation)
     * 正确：绿色墨晕 + 鼓励文案 + 语音播报
     * 错误：红色印章抖动 + 解析展示 + 安慰语音
     */
    showFeedback: function (isCorrect, explanation) {
      var container = getContainer();
      if (!container) return;

      // 高亮所有选项的正确/错误状态
      var options = container.querySelectorAll('.quiz-option');
      options.forEach(function (opt) {
        opt.style.pointerEvents = 'none'; // 禁止再次点击
      });

      // 创建反馈覆盖层
      var overlay = el('div');
      // TODO: 添加到main.css — .feedback-overlay { position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center; z-index:10; border-radius:var(--radius-lg); }
      overlay.style.cssText = 'position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:10;border-radius:12px;background:rgba(245,240,232,0.92);backdrop-filter:blur(2px);';

      var icon = el('div');
      icon.style.fontSize = '3rem';

      var message = el('p');
      message.style.cssText = 'font-size:1.25rem;margin-top:0.5rem;text-align:center;padding:0 1rem;';

      var explanationEl = el('p');
      // TODO: 添加到main.css — .feedback-explanation { font-size:var(--fs-sm); color:rgba(44,44,44,0.7); margin-top:var(--space-sm); padding:0 var(--space-md); text-align:center; }
      explanationEl.style.cssText = 'font-size:0.875rem;color:rgba(44,44,44,0.7);margin-top:0.5rem;padding:0 1rem;text-align:center;max-width:90%;';

      if (isCorrect) {
        overlay.classList.add('feedback-correct');
        icon.textContent = '✅';
        // 绿色墨晕动画
        icon.style.animation = 'inkSpreadGreen 0.5s ease forwards';
        var encourages = ['太棒了！', '答对了！', '真厉害！', '博学多才！'];
        message.textContent = encourages[Math.floor(Math.random() * encourages.length)];
        message.classList.add('text-vermilion');
        explanationEl.textContent = explanation || '';

        // 语音播报鼓励
        if (window.VoiceEngine && typeof window.VoiceEngine.speak === 'function') {
          window.VoiceEngine.speak(message.textContent);
        }
      } else {
        overlay.classList.add('feedback-wrong');
        icon.textContent = '❌';
        // 红色印章抖动
        icon.style.animation = 'stampShake 0.4s ease';
        message.textContent = '没关系，继续加油！';
        message.classList.add('text-indigo');
        explanationEl.textContent = explanation || '';

        // 安慰语音
        if (window.VoiceEngine && typeof window.VoiceEngine.speak === 'function') {
          window.VoiceEngine.speak('没关系，' + (explanation || '让我们看看正确答案'));
        }
      }

      overlay.appendChild(icon);
      overlay.appendChild(message);
      if (explanation) overlay.appendChild(explanationEl);

      // 将overlay定位到card上
      var card = container.querySelector('.quiz-card');
      if (card) {
        card.style.position = 'relative';
        card.appendChild(overlay);
      } else {
        container.appendChild(overlay);
      }

      // "继续"按钮（备用，3秒后若未自动跳转则显示）
      var continueBtn = el('button', 'btn btn-primary mt-md', '继续');
      continueBtn.style.display = 'none';
      continueBtn.addEventListener('click', function () {
        if (window.QuizEngine && typeof window.QuizEngine.nextQuestion === 'function') {
          window.QuizEngine.nextQuestion();
        }
      });
      overlay.appendChild(continueBtn);

      // 3秒后自动进入下一题，否则显示继续按钮
      var timer = setTimeout(function () {
        if (window.QuizEngine && typeof window.QuizEngine.nextQuestion === 'function') {
          window.QuizEngine.nextQuestion();
        } else {
          continueBtn.style.display = '';
        }
      }, FEEDBACK_DELAY);

      // 保存timer以便reset时清除
      QuizCard._feedbackTimer = timer;
    },

    /**
     * highlightOption(optionLetter, isCorrect)
     * 高亮选中的选项
     */
    highlightOption: function (optionLetter, isCorrect) {
      var container = getContainer();
      if (!container) return;
      var options = container.querySelectorAll('.quiz-option');
      options.forEach(function (opt) {
        if (opt.getAttribute('data-letter') === optionLetter) {
          opt.classList.add(isCorrect ? 'correct' : 'wrong');
        }
      });
    },

    /**
     * reset() — 清空容器准备下一题
     */
    reset: function () {
      if (QuizCard._feedbackTimer) {
        clearTimeout(QuizCard._feedbackTimer);
        QuizCard._feedbackTimer = null;
      }
      var container = getContainer();
      if (container) container.innerHTML = '';
    },

    _feedbackTimer: null
  };

  // 导出到全局
  window.QuizCard = QuizCard;
})();
