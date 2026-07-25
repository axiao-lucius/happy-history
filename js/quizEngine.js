/**
 * quizEngine.js — 题库加载与索引引擎
 * 负责加载、缓存和检索历史题目数据
 */
(function () {
  'use strict';

  var _cache = null;
  var _organizedIndex = {};
  var _allQuestions = [];
  var _loadingPromise = null;

  /**
   * 构建朝代+难度的组合索引
   */
  function buildIndex(data) {
    _organizedIndex = {};
    _allQuestions = [];

    var questions = data.questions || data;
    if (!Array.isArray(questions)) return;

    for (var i = 0; i < questions.length; i++) {
      var q = questions[i];
      _allQuestions.push(q);

      var dynasty = q.dynasty || 'unknown';
      var difficulty = q.difficulty || 'D1';
      var key = dynasty + '::' + difficulty;

      if (!_organizedIndex[key]) {
        _organizedIndex[key] = [];
      }
      _organizedIndex[key].push(q);
    }
  }

  /**
   * 加载题库JSON数据，解析并缓存
   * @returns {Promise<Object>} 题库数据
   */
  function loadQuizData() {
    if (_cache) {
      return Promise.resolve(_cache);
    }
    if (_loadingPromise) {
      return _loadingPromise;
    }

    _loadingPromise = fetch('data/k12-history-quiz-v3.json')
      .then(function (response) {
        if (!response.ok) {
          throw new Error('Failed to load quiz data: ' + response.status);
        }
        return response.json();
      })
      .then(function (data) {
        _cache = data;
        buildIndex(data);
        _loadingPromise = null;
        return data;
      })
      .catch(function (err) {
        _loadingPromise = null;
        console.error('[QuizEngine] loadQuizData error:', err);
        throw err;
      });

    return _loadingPromise;
  }

  /**
   * 按朝代和难度获取题目
   * @param {string} dynasty - 朝代名称
   * @param {string} [difficulty] - 难度等级 D1-D5，不传则返回该朝代所有题目
   * @returns {Array} 匹配的题目数组
   */
  function getQuestionsByDynasty(dynasty, difficulty) {
    if (!_cache) {
      console.warn('[QuizEngine] Data not loaded. Call loadQuizData() first.');
      return [];
    }

    if (difficulty) {
      var key = dynasty + '::' + difficulty;
      return (_organizedIndex[key] || []).slice();
    }

    // 返回该朝代所有难度的题目
    var result = [];
    var keys = Object.keys(_organizedIndex);
    for (var i = 0; i < keys.length; i++) {
      if (keys[i].indexOf(dynasty + '::') === 0) {
        result = result.concat(_organizedIndex[keys[i]]);
      }
    }
    return result;
  }

  /**
   * Fisher-Yates 洗牌算法
   */
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i];
      a[i] = a[j];
      a[j] = tmp;
    }
    return a;
  }

  /**
   * 按难度范围和朝代权重随机抽题
   * @param {number} count - 需要抽取的题目数量
   * @param {Object} difficultyRange - 难度范围 {min: 'D1', max: 'D5'}
   * @param {Array<string>} [excludeIds] - 排除的题目ID列表
   * @param {Object} [dynastyWeights] - 朝代权重 {dynasty: weight}
   * @returns {Array} 抽取的题目数组
   */
  function getRandomQuestions(count, difficultyRange, excludeIds, dynastyWeights) {
    if (!_cache || _allQuestions.length === 0) {
      console.warn('[QuizEngine] Data not loaded.');
      return [];
    }

    var minD = difficultyRange && difficultyRange.min != null ? (typeof difficultyRange.min === 'number' ? difficultyRange.min : parseInt(String(difficultyRange.min).replace('D', ''), 10)) : 1;
    var maxD = difficultyRange && difficultyRange.max != null ? (typeof difficultyRange.max === 'number' ? difficultyRange.max : parseInt(String(difficultyRange.max).replace('D', ''), 10)) : 5;

    var excludeSet = {};
    if (excludeIds && Array.isArray(excludeIds)) {
      for (var e = 0; e < excludeIds.length; e++) {
        excludeSet[excludeIds[e]] = true;
      }
    }

    // 筛选符合难度范围的候选题目
    var candidates = [];
    for (var i = 0; i < _allQuestions.length; i++) {
      var q = _allQuestions[i];
      var rawD = q.difficulty;
      var dLevel = (typeof rawD === 'number') ? rawD : parseInt((rawD || 'D1').replace('D', ''), 10);
      if (dLevel >= minD && dLevel <= maxD) {
        if (!excludeSet[q.id]) {
          candidates.push(q);
        }
      }
    }

    if (candidates.length === 0) return [];

    // 如果有朝代权重，按权重加权抽样
    if (dynastyWeights && typeof dynastyWeights === 'object') {
      var weighted = [];
      for (var w = 0; w < candidates.length; w++) {
        var cq = candidates[w];
        var weight = dynastyWeights[cq.dynasty] || 1;
        for (var r = 0; r < weight; r++) {
          weighted.push(cq);
        }
      }
      if (weighted.length > 0) {
        candidates = weighted;
      }
    }

    var shuffled = shuffle(candidates);

    // 去重（加权后可能有重复）
    var seen = {};
    var result = [];
    for (var s = 0; s < shuffled.length && result.length < count; s++) {
      if (!seen[shuffled[s].id]) {
        seen[shuffled[s].id] = true;
        result.push(shuffled[s]);
      }
    }

    return result;
  }

  /**
   * 返回一道D1题目作为每日首题
   * @returns {Object|null} D1难度题目
   */
  function getDailyFirstQuestion() {
    if (!_cache || _allQuestions.length === 0) {
      console.warn('[QuizEngine] Data not loaded.');
      return null;
    }

    var d1Questions = [];
    for (var i = 0; i < _allQuestions.length; i++) {
      var d = _allQuestions[i].difficulty;
      if (d === 'D1' || d === 1) {
        d1Questions.push(_allQuestions[i]);
      }
    }

    if (d1Questions.length === 0) return null;

    var idx = Math.floor(Math.random() * d1Questions.length);
    return d1Questions[idx];
  }

  // 导出到全局
  window.QuizEngine = {
    loadQuizData: loadQuizData,
    getQuestionsByDynasty: getQuestionsByDynasty,
    getRandomQuestions: getRandomQuestions,
    getDailyFirstQuestion: getDailyFirstQuestion
  };
})();
