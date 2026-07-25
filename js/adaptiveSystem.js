/**
 * adaptiveSystem.js — 自适应难度递进算法
 * 根据用户答题表现动态调整题目难度配比
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'happy_history_state';

  /**
   * 获取今天的日期字符串 YYYY-MM-DD
   */
  function getTodayStr() {
    var d = new Date();
    var yyyy = d.getFullYear();
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    var dd = String(d.getDate()).padStart(2, '0');
    return yyyy + '-' + mm + '-' + dd;
  }

  /**
   * 创建默认状态对象
   */
  function createDefaultState() {
    return {
      current_streak_in_round: 0,
      completed_streaks_today: 0,
      total_completed_streaks: 0,
      today_answered_ids: [],
      last_question_result: null,
      session_high_diff_count: 0,
      date: getTodayStr()
    };
  }

  /**
   * 从localStorage读取用户状态
   * @returns {Object} 用户状态
   */
  function getState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var state = JSON.parse(raw);
        // 如果日期不是今天，自动重置当日状态
        if (state.date !== getTodayStr()) {
          state = initDailyState(state);
        }
        return state;
      }
    } catch (e) {
      console.error('[AdaptiveSystem] getState error:', e);
    }
    return createDefaultState();
  }

  /**
   * 持久化状态到localStorage
   * @param {Object} state - 用户状态
   */
  function saveState(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('[AdaptiveSystem] saveState error:', e);
    }
  }

  /**
   * 初始化/重置当日状态
   * 保留历史累计数据，重置当日计数
   * @param {Object} [existingState] - 已有状态（可选）
   * @returns {Object} 重置后的状态
   */
  function initDailyState(existingState) {
    var state = existingState || createDefaultState();
    state.current_streak_in_round = 0;
    state.completed_streaks_today = 0;
    state.today_answered_ids = [];
    state.last_question_result = null;
    state.session_high_diff_count = 0;
    state.date = getTodayStr();
    saveState(state);
    return state;
  }

  /**
   * 计算高难题配额
   * @param {number} completedStreaks - 已完成的连胜次数
   * @returns {number} 高难题目数量（D4-D5）
   */
  function getHighDiffCount(completedStreaks) {
    if (completedStreaks < 1) return 0;
    var count = Math.floor(completedStreaks / 3) + 1;
    return Math.min(count, 4);
  }

  /**
   * 根据当前状态计算下一批5道题的难度配比
   * @param {Object} state - 当前用户状态
   * @returns {Array<Object>} 包含5个难度配置的对象数组
   */
  function getNextBatch(state) {
    var batchSize = 5;
    var batch = [];

    // 每日首题强制D1（当今日已答题数为0时）
    var isFirstQuestion = (!state.today_answered_ids || state.today_answered_ids.length === 0);

    if (isFirstQuestion) {
      batch.push({ min: 'D1', max: 'D1' });
    }

    var remainingSlots = batchSize - batch.length;
    if (remainingSlots <= 0) return batch;

    var completedStreaks = state.completed_streaks_today || 0;

    // completed_streaks=0时全部D1-D2
    if (completedStreaks === 0) {
      for (var i = 0; i < remainingSlots; i++) {
        batch.push({ min: 'D1', max: 'D2' });
      }
      return batch;
    }

    // completed_streaks>=1时插入高难题
    var highDiffCount = getHighDiffCount(completedStreaks);
    // 确保不超过剩余槽位
    highDiffCount = Math.min(highDiffCount, remainingSlots);

    // 每轮至少1道基础题（D1-D2）
    var baseCount = Math.max(1, remainingSlots - highDiffCount);
    var midCount = remainingSlots - highDiffCount - baseCount;

    // 添加基础题
    for (var b = 0; b < baseCount; b++) {
      batch.push({ min: 'D1', max: 'D2' });
    }

    // 添加中等题（D3）
    for (var m = 0; m < midCount; m++) {
      batch.push({ min: 'D3', max: 'D3' });
    }

    // 添加高难题（D4-D5）
    for (var h = 0; h < highDiffCount; h++) {
      batch.push({ min: 'D4', max: 'D5' });
    }

    // 更新session高难计数
    state.session_high_diff_count = (state.session_high_diff_count || 0) + highDiffCount;

    return batch;
  }

  /**
   * 记录答题结果，更新连胜计数
   * @param {Object} state - 当前用户状态
   * @param {boolean} isCorrect - 是否答对
   * @returns {Object} 更新后的状态
   */
  function recordAnswer(state, isCorrect) {
    if (isCorrect) {
      state.current_streak_in_round = (state.current_streak_in_round || 0) + 1;
      state.last_question_result = true;

      // 达到5连则完成一次连胜
      if (state.current_streak_in_round >= 5) {
        state.completed_streaks_today = (state.completed_streaks_today || 0) + 1;
        state.total_completed_streaks = (state.total_completed_streaks || 0) + 1;
        state.current_streak_in_round = 0;
      }
    } else {
      state.current_streak_in_round = 0;
      state.last_question_result = false;
      // completed_streaks保留，不归零
    }

    saveState(state);
    return state;
  }

  // 导出到全局
  window.AdaptiveSystem = {
    getState: getState,
    saveState: saveState,
    initDailyState: initDailyState,
    getNextBatch: getNextBatch,
    recordAnswer: recordAnswer,
    getHighDiffCount: getHighDiffCount
  };
})();
