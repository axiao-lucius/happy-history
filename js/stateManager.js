/**
 * stateManager.js — 状态持久化管理
 * 统一管理localStorage中的数据存取、错题本、成就和历史统计
 */
(function () {
  'use strict';

  var KEYS = {
    WRONG_BOOK: 'happy_history_wrong_book',
    ACHIEVEMENTS: 'happy_history_achievements',
    STATS: 'happy_history_stats',
    EXPORT_PREFIX: 'happy_history_'
  };

  /**
   * JSON序列化存入localStorage
   * @param {string} key - 存储键名
   * @param {*} value - 要存储的值
   */
  function save(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error('[StateManager] save error for key "' + key + '":', e);
    }
  }

  /**
   * 从localStorage读取并解析
   * @param {string} key - 存储键名
   * @returns {*} 解析后的值，不存在返回null
   */
  function load(key) {
    try {
      var raw = localStorage.getItem(key);
      if (raw === null) return null;
      return JSON.parse(raw);
    } catch (e) {
      console.error('[StateManager] load error for key "' + key + '":', e);
      return null;
    }
  }

  /**
   * 清除指定key
   * @param {string} key - 存储键名
   */
  function clear(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.error('[StateManager] clear error for key "' + key + '":', e);
    }
  }

  // ==================== 错题本 ====================

  /**
   * 获取错题本数组
   * @returns {Array} 错题列表
   */
  function getWrongBook() {
    return load(KEYS.WRONG_BOOK) || [];
  }

  /**
   * 添加错题（按ID去重）
   * @param {Object} question - 题目对象（需包含id字段）
   */
  function addToWrongBook(question) {
    if (!question || !question.id) return;

    var book = getWrongBook();
    // 检查是否已存在
    for (var i = 0; i < book.length; i++) {
      if (book[i].id === question.id) {
        // 更新已有记录（可能题目内容有更新）
        book[i] = question;
        save(KEYS.WRONG_BOOK, book);
        return;
      }
    }
    book.push(question);
    save(KEYS.WRONG_BOOK, book);
  }

  /**
   * 移除已掌握的错题
   * @param {string} questionId - 题目ID
   */
  function removeFromWrongBook(questionId) {
    var book = getWrongBook();
    var filtered = [];
    for (var i = 0; i < book.length; i++) {
      if (book[i].id !== questionId) {
        filtered.push(book[i]);
      }
    }
    save(KEYS.WRONG_BOOK, filtered);
  }

  // ==================== 成就系统 ====================

  /**
   * 获取成就列表
   * @returns {Array} 已解锁的成就列表
   */
  function getAchievements() {
    return load(KEYS.ACHIEVEMENTS) || [];
  }

  /**
   * 解锁成就（按ID去重）
   * @param {string} id - 成就ID
   */
  function unlockAchievement(id) {
    if (!id) return;

    var achievements = getAchievements();
    for (var i = 0; i < achievements.length; i++) {
      if (achievements[i].id === id) return; // 已解锁
    }
    achievements.push({
      id: id,
      unlockedAt: new Date().toISOString()
    });
    save(KEYS.ACHIEVEMENTS, achievements);
  }

  // ==================== 历史统计 ====================

  /**
   * 获取历史统计数据
   * @returns {Object} 统计信息
   */
  function getHistoryStats() {
    var stats = load(KEYS.STATS);
    if (!stats) {
      stats = {
        totalAnswered: 0,
        totalCorrect: 0,
        accuracy: 0,
        maxStreak: 0,
        totalSessions: 0,
        firstPlayDate: new Date().toISOString(),
        lastPlayDate: new Date().toISOString()
      };
      save(KEYS.STATS, stats);
    }
    return stats;
  }

  /**
   * 更新统计数据（内部辅助方法）
   * @param {boolean} isCorrect - 本次答题是否正确
   * @param {number} currentStreak - 当前连胜数
   */
  function updateStats(isCorrect, currentStreak) {
    var stats = getHistoryStats();
    stats.totalAnswered++;
    if (isCorrect) {
      stats.totalCorrect++;
    }
    stats.accuracy = stats.totalAnswered > 0
      ? Math.round((stats.totalCorrect / stats.totalAnswered) * 10000) / 100
      : 0;
    if (currentStreak > stats.maxStreak) {
      stats.maxStreak = currentStreak;
    }
    stats.lastPlayDate = new Date().toISOString();
    save(KEYS.STATS, stats);
  }

  // ==================== 数据导入导出 ====================

  /**
   * 导出所有数据为JSON字符串
   * @returns {string} JSON格式的所有数据
   */
  function exportData() {
    var data = {};
    var keysToExport = [
      'happy_history_state',
      KEYS.WRONG_BOOK,
      KEYS.ACHIEVEMENTS,
      KEYS.STATS
    ];

    for (var i = 0; i < keysToExport.length; i++) {
      var k = keysToExport[i];
      var val = localStorage.getItem(k);
      if (val !== null) {
        try {
          data[k] = JSON.parse(val);
        } catch (e) {
          data[k] = val;
        }
      }
    }

    data._exportTime = new Date().toISOString();
    data._version = '1.0';
    return JSON.stringify(data, null, 2);
  }

  /**
   * 导入数据
   * @param {string} jsonStr - JSON格式的数据字符串
   * @returns {boolean} 是否导入成功
   */
  function importData(jsonStr) {
    try {
      var data = JSON.parse(jsonStr);
      if (!data || typeof data !== 'object') {
        console.error('[StateManager] importData: invalid data format');
        return false;
      }

      var importedCount = 0;
      var keys = Object.keys(data);
      for (var i = 0; i < keys.length; i++) {
        var k = keys[i];
        // 只导入已知前缀的key，跳过元数据
        if (k.indexOf('happy_history_') === 0) {
          save(k, data[k]);
          importedCount++;
        }
      }

      console.log('[StateManager] importData: imported ' + importedCount + ' keys');
      return true;
    } catch (e) {
      console.error('[StateManager] importData error:', e);
      return false;
    }
  }

  // 导出到全局
  window.StateManager = {
    save: save,
    load: load,
    clear: clear,
    getWrongBook: getWrongBook,
    addToWrongBook: addToWrongBook,
    removeFromWrongBook: removeFromWrongBook,
    getAchievements: getAchievements,
    unlockAchievement: unlockAchievement,
    getHistoryStats: getHistoryStats,
    updateStats: updateStats,
    exportData: exportData,
    importData: importData
  };
})();
