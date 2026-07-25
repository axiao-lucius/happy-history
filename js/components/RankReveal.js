/**
 * RankReveal — 段位揭晓动画组件
 * 全屏段位揭晓：水墨扩散 + emoji弹出 + 打字机称号 + 分数滚动
 */
;(function () {
  'use strict';

  /* ---------- helpers ---------- */

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  /** 数字滚动动画: 0 → target */
  function animateCount(targetEl, target, duration) {
    var start = 0;
    var startTime = null;
    function step(ts) {
      if (!startTime) startTime = ts;
      var progress = Math.min((ts - startTime) / duration, 1);
      // easeOutCubic
      var eased = 1 - Math.pow(1 - progress, 3);
      targetEl.textContent = Math.round(eased * target);
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /** 打字机效果：逐字显示文本 */
  function typewriterEffect(targetEl, text, speed) {
    targetEl.textContent = '';
    var i = 0;
    function tick() {
      if (i < text.length) {
        targetEl.textContent += text.charAt(i);
        i++;
        setTimeout(tick, speed);
      }
    }
    tick();
  }

  /* ---------- core API ---------- */

  var RankReveal = {

    _overlay: null,

    /**
     * show(score, rank, streakCount)
     * @param {number} score       - 最终得分
     * @param {Object} rank        - { emoji, title }
     * @param {number} streakCount - 连胜数（可选）
     */
    show: function (score, rank, streakCount) {
      // 移除旧层
      RankReveal.hide();

      var overlay = el('div', 'rank-reveal');
      // TODO: 添加到main.css — .rank-reveal { position:fixed; inset:0; z-index:1000; display:flex; flex-direction:column; align-items:center; justify-content:center; background:rgba(44,44,44,0.85); animation:fadeIn 0.6s ease; }
      overlay.style.cssText = 'position:fixed;inset:0;z-index:1000;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(44,44,44,0.85);animation:fadeIn 0.6s ease;';

      // --- 水墨扩散背景效果 ---
      var inkBg = el('div');
      // TODO: 添加到main.css — .rank-reveal-ink { position:absolute; width:200vmax; height:200vmax; border-radius:50%; background:radial-gradient(circle, rgba(245,240,232,0.15) 0%, transparent 70%); animation:inkExpand 1.2s ease-out forwards; pointer-events:none; }
      inkBg.style.cssText = 'position:absolute;width:200vmax;height:200vmax;border-radius:50%;background:radial-gradient(circle,rgba(245,240,232,0.15) 0%,transparent 70%);animation:inkExpand 1.2s ease-out forwards;pointer-events:none;';
      overlay.appendChild(inkBg);

      // 注入inkExpand关键帧（如果尚未存在）
      if (!document.getElementById('rank-reveal-keyframes')) {
        var styleSheet = document.createElement('style');
        styleSheet.id = 'rank-reveal-keyframes';
        // TODO: 添加到main.css — @keyframes inkExpand { from{transform:scale(0);opacity:0} to{transform:scale(1);opacity:1} }
        // TODO: 添加到main.css — @keyframes rankEmojiPop { 0%{transform:scale(0);opacity:0} 60%{transform:scale(1.5)} 100%{transform:scale(1);opacity:1} }
        styleSheet.textContent = '@keyframes inkExpand{from{transform:scale(0);opacity:0}to{transform:scale(1);opacity:1}}' +
          '@keyframes rankEmojiPop{0%{transform:scale(0);opacity:0}60%{transform:scale(1.5)}100%{transform:scale(1);opacity:1}}';
        document.head.appendChild(styleSheet);
      }

      // --- 段位 Emoji ---
      var emojiEl = el('div', 'rank-badge');
      emojiEl.textContent = rank.emoji || '🏅';
      // TODO: 添加到main.css — .rank-reveal .rank-badge { width:120px; height:120px; font-size:3.5rem; animation:rankEmojiPop 0.8s 0.4s ease both; }
      emojiEl.style.cssText = 'width:120px;height:120px;font-size:3.5rem;animation:rankEmojiPop 0.8s 0.4s ease both;';
      overlay.appendChild(emojiEl);

      // --- 称号文字（打字机效果）---
      var titleEl = el('h2');
      // TODO: 添加到main.css — .rank-reveal-title { color:var(--color-gold); font-size:var(--fs-2xl); margin-top:var(--space-lg); min-height:2.5rem; }
      titleEl.style.cssText = 'color:#D4A574;font-size:2rem;margin-top:1.5rem;min-height:2.5rem;text-align:center;';
      overlay.appendChild(titleEl);
      // 延迟启动打字机，等emoji弹出完成
      setTimeout(function () {
        typewriterEffect(titleEl, rank.title || '未知段位', 120);
      }, 1200);

      // --- 分数滚动 ---
      var scoreWrap = el('div');
      // TODO: 添加到main.css — .rank-reveal-score { font-size:var(--fs-3xl); font-weight:700; color:#fff; margin-top:var(--space-md); }
      scoreWrap.style.cssText = 'font-size:2.5rem;font-weight:700;color:#fff;margin-top:1rem;';
      var scoreNum = el('span', '', '0');
      var scoreLabel = el('span', '', ' 分');
      scoreLabel.style.fontSize = '1rem';
      scoreWrap.appendChild(scoreNum);
      scoreWrap.appendChild(scoreLabel);
      overlay.appendChild(scoreWrap);
      // 延迟启动计数
      setTimeout(function () {
        animateCount(scoreNum, score, 1500);
      }, 800);

      // --- 连胜数 ---
      if (streakCount && streakCount > 1) {
        var streakEl = el('div');
        // TODO: 添加到main.css — .rank-reveal-streak { color:var(--color-vermilion); font-size:var(--fs-lg); margin-top:var(--space-sm); animation:fadeIn 0.5s 1.5s both; }
        streakEl.style.cssText = 'color:#C0392B;font-size:1.25rem;margin-top:0.5rem;animation:fadeIn 0.5s 1.5s both;';
        streakEl.textContent = '🔥 ' + streakCount + '连胜！';
        overlay.appendChild(streakEl);
      }

      // --- 底部按钮组 ---
      var btnGroup = el('div');
      // TODO: 添加到main.css — .rank-reveal-actions { display:flex; gap:var(--space-md); margin-top:var(--space-xl); animation:fadeIn 0.5s 2s both; }
      btnGroup.style.cssText = 'display:flex;gap:1rem;margin-top:2rem;animation:fadeIn 0.5s 2s both;';

      var replayBtn = el('button', 'btn btn-primary', '再来一轮');
      replayBtn.addEventListener('click', function () {
        RankReveal.hide();
        if (window.QuizEngine && typeof window.QuizEngine.startRound === 'function') {
          window.QuizEngine.startRound();
        }
      });

      var historyBtn = el('button', 'btn btn-vermilion', '查看战绩');
      historyBtn.addEventListener('click', function () {
        RankReveal.hide();
        if (window.StateManager && typeof window.StateManager.navigate === 'function') {
          window.StateManager.navigate('profile');
        }
      });

      btnGroup.appendChild(replayBtn);
      btnGroup.appendChild(historyBtn);
      overlay.appendChild(btnGroup);

      document.body.appendChild(overlay);
      RankReveal._overlay = overlay;
    },

    /**
     * hide() — 关闭动画层
     */
    hide: function () {
      if (RankReveal._overlay && RankReveal._overlay.parentNode) {
        RankReveal._overlay.parentNode.removeChild(RankReveal._overlay);
        RankReveal._overlay = null;
      }
    }
  };

  // 导出到全局
  window.RankReveal = RankReveal;
})();
