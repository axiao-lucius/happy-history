/**
 * StreakCounter — 连胜计数器组件
 * 显示当前连胜数、火焰图标变化、连击特效
 */
;(function () {
  'use strict';

  var CONTAINER_SELECTOR = '#streak-container';

  /* ---------- helpers ---------- */

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  /** 根据连胜数返回对应火焰emoji */
  function flameIcon(streak) {
    if (streak >= 5) return '🔥🔥🔥'; // 大火
    if (streak >= 3) return '🔥🔥';   // 中火
    if (streak >= 1) return '🔥';     // 小火苗
    return '';
  }

  /** 获取或创建容器 */
  function getOrCreateContainer() {
    var container = document.querySelector(CONTAINER_SELECTOR);
    if (!container) {
      container = el('div', 'streak-counter');
      // TODO: 添加到main.css — .streak-counter { position:fixed; top:var(--space-md); right:var(--space-md); z-index:50; display:flex; align-items:center; gap:var(--space-sm); padding:var(--space-sm) var(--space-md); background:var(--color-card-bg); border:1px solid var(--color-border); border-radius:var(--radius-lg); backdrop-filter:blur(4px); transition:transform 0.3s; }
      container.style.cssText = 'position:fixed;top:1rem;right:1rem;z-index:50;display:flex;align-items:center;gap:0.5rem;padding:0.5rem 1rem;background:rgba(245,240,232,0.85);border:1px solid rgba(44,44,44,0.15);border-radius:12px;backdrop-filter:blur(4px);transition:transform 0.3s;';
      document.body.appendChild(container);
    }
    return container;
  }

  /* ---------- core API ---------- */

  var StreakCounter = {

    _prevStreak: 0,

    /**
     * update(currentStreak, completedStreaks)
     * @param {number} currentStreak   - 当前连胜数
     * @param {Array}  completedStreaks - 历史已完成的连胜记录（可选）
     */
    update: function (currentStreak, completedStreaks) {
      var container = getOrCreateContainer();
      container.innerHTML = '';

      if (currentStreak <= 0) {
        container.style.display = 'none';
        StreakCounter._prevStreak = 0;
        return;
      }

      container.style.display = 'flex';

      // 火焰图标
      var flame = el('span');
      // TODO: 添加到main.css — .streak-flame { font-size:var(--fs-xl); transition:transform 0.3s; }
      flame.style.cssText = 'font-size:1.5rem;transition:transform 0.3s;';
      flame.className = 'streak-flame';
      flame.textContent = flameIcon(currentStreak);
      container.appendChild(flame);

      // 连胜数字
      var numEl = el('span');
      // TODO: 添加到main.css — .streak-number { font-size:var(--fs-2xl); font-weight:700; color:var(--color-vermilion); line-height:1; }
      numEl.style.cssText = 'font-size:2rem;font-weight:700;color:#C0392B;line-height:1;';
      numEl.className = 'streak-number';
      numEl.textContent = currentStreak;
      container.appendChild(numEl);

      // "连胜"标签
      var label = el('span', '', '连胜');
      // TODO: 添加到main.css — .streak-label { font-size:var(--fs-xs); color:rgba(44,44,44,0.6); }
      label.style.cssText = 'font-size:0.75rem;color:rgba(44,44,44,0.6);';
      container.appendChild(label);

      // comboGold动画触发：连胜数增加时
      if (currentStreak > StreakCounter._prevStreak && currentStreak >= 2) {
        container.style.animation = 'none';
        // 强制重排以重启动画
        void container.offsetWidth;
        // TODO: 添加到main.css — .streak-counter.combo-active { animation:comboGold 0.6s ease-out; }
        container.style.animation = 'comboGold 0.6s ease-out';
        StreakCounter.showCombo(currentStreak);
      }

      StreakCounter._prevStreak = currentStreak;
    },

    /**
     * showCombo(count) — 显示连击特效
     * "X连击!"文字上浮消散 + 金色粒子效果
     */
    showCombo: function (count) {
      var container = getOrCreateContainer();

      // --- 连击文字 ---
      var comboText = el('div', 'combo-particle', count + '连击!');
      // TODO: 添加到main.css — .combo-text { position:absolute; top:-2rem; left:50%; transform:translateX(-50%); white-space:nowrap; color:var(--color-gold); font-size:var(--fs-xl); font-weight:700; pointer-events:none; animation:comboGold 0.8s ease-out forwards; }
      comboText.style.cssText = 'position:absolute;top:-2rem;left:50%;transform:translateX(-50%);white-space:nowrap;color:#D4A574;font-size:1.5rem;font-weight:700;pointer-events:none;animation:comboGold 0.8s ease-out forwards;';
      container.style.position = container.style.position || 'fixed';
      container.appendChild(comboText);

      // --- 金色粒子效果 (CSS实现) ---
      var particleCount = Math.min(count * 3, 18); // 粒子数量随连击数增长，上限18
      for (var i = 0; i < particleCount; i++) {
        var particle = el('span', 'combo-particle');
        // 随机分布的粒子
        var angle = (Math.PI * 2 * i) / particleCount;
        var dist = 30 + Math.random() * 40;
        var tx = Math.cos(angle) * dist;
        var ty = Math.sin(angle) * dist - 20;
        // TODO: 添加到main.css — .streak-particle { position:absolute; width:6px; height:6px; border-radius:50%; background:var(--color-gold); pointer-events:none; animation:particleFly 0.7s ease-out forwards; }
        particle.style.cssText = 'position:absolute;width:6px;height:6px;border-radius:50%;background:#D4A574;pointer-events:none;' +
          'left:50%;top:50%;' +
          'animation:particleFly 0.7s ease-out forwards;' +
          '--tx:' + tx + 'px;--ty:' + ty + 'px;';
        container.appendChild(particle);
      }

      // 注入粒子关键帧（如果尚未存在）
      if (!document.getElementById('streak-particle-keyframes')) {
        var styleSheet = document.createElement('style');
        styleSheet.id = 'streak-particle-keyframes';
        // TODO: 添加到main.css — @keyframes particleFly { 0%{opacity:1;transform:translate(0,0) scale(1)} 100%{opacity:0;transform:translate(var(--tx),var(--ty)) scale(0)} }
        styleSheet.textContent = '@keyframes particleFly{0%{opacity:1;transform:translate(0,0) scale(1)}100%{opacity:0;transform:translate(var(--tx),var(--ty)) scale(0)}}';
        document.head.appendChild(styleSheet);
      }

      // 清理动画元素
      setTimeout(function () {
        if (comboText.parentNode) comboText.parentNode.removeChild(comboText);
        var particles = container.querySelectorAll('.combo-particle');
        particles.forEach(function (p) {
          if (p.parentNode) p.parentNode.removeChild(p);
        });
      }, 900);
    },

    /**
     * reset() — 重置显示
     */
    reset: function () {
      StreakCounter._prevStreak = 0;
      var container = document.querySelector(CONTAINER_SELECTOR);
      if (container) {
        container.innerHTML = '';
        container.style.display = 'none';
      }
    }
  };

  // 导出到全局
  window.StreakCounter = StreakCounter;
})();
