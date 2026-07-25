/**
 * ScoringSystem - 计分与段位系统
 * 提供分数计算、段位评定、鼓励文案、成就检查等功能
 */
(function () {
  'use strict';

  // ============ 段位配置 ============
  var RANK_CONFIG = [
    { minScore: 100, title: '荣耀王者·史学宗师', emoji: '👑', tier: 'king_glory', color: '#FFD700' },
    { minScore: 80,  title: '最强王者·博古通今', emoji: '⭐', tier: 'king_strong', color: '#FF6B6B' },
    { minScore: 60,  title: '至尊星耀·学有所成', emoji: '💎', tier: 'star',        color: '#9B59B6' },
    { minScore: 40,  title: '永恒钻石·初窥门径', emoji: '🔷', tier: 'diamond',     color: '#3498DB' },
    { minScore: 20,  title: '尊贵铂金·再接再厉', emoji: '🥉', tier: 'platinum',    color: '#1ABC9C' },
    { minScore: 0,   title: '不屈青铜·从头再来', emoji: '🛡️', tier: 'bronze',      color: '#95A5A6' }
  ];

  // ============ 成就定义 ============
  var ACHIEVEMENTS = [
    {
      id: 'first_perfect',
      name: '初露锋芒',
      description: '首次获得满分100分',
      icon: '🏆',
      check: function (stats) {
        return stats.bestScore >= 100;
      }
    },
    {
      id: 'streak_7_days',
      name: '持之以恒',
      description: '连续7天打卡学习',
      icon: '🔥',
      check: function (stats) {
        return stats.currentStreak >= 7;
      }
    },
    {
      id: 'correct_100',
      name: '百题斩将',
      description: '累计答对100道题',
      icon: '💯',
      check: function (stats) {
        return stats.totalCorrect >= 100;
      }
    },
    {
      id: 'all_ranks',
      name: '段位收藏家',
      description: '解锁全部段位',
      icon: '🎖️',
      check: function (stats) {
        if (!stats.unlockedTiers || !Array.isArray(stats.unlockedTiers)) return false;
        var allTiers = ['king_glory', 'king_strong', 'star', 'diamond', 'platinum', 'bronze'];
        for (var i = 0; i < allTiers.length; i++) {
          if (stats.unlockedTiers.indexOf(allTiers[i]) === -1) return false;
        }
        return true;
      }
    },
    {
      id: 'streak_30_days',
      name: '月度学霸',
      description: '连续30天打卡学习',
      icon: '📅',
      check: function (stats) {
        return stats.currentStreak >= 30;
      }
    },
    {
      id: 'correct_500',
      name: '学富五车',
      description: '累计答对500道题',
      icon: '📚',
      check: function (stats) {
        return stats.totalCorrect >= 500;
      }
    }
  ];

  // ============ 鼓励文案库 ============
  var ENCOURAGEMENT_TEXTS = {
    king_glory: [
      '太厉害了！你就是历史小天才！🎉',
      '完美表现！史学宗师名不虚传！',
      '满分通关，无人能敌！'
    ],
    king_strong: [
      '非常棒！距离满分只差一步啦！💪',
      '博古通今，实力超群！',
      '继续保持，王者之路就在前方！'
    ],
    star: [
      '不错哦！已经掌握了大部分知识！✨',
      '学有所成，继续加油！',
      '星耀闪耀，你很棒！'
    ],
    diamond: [
      '有进步空间，继续努力哦！💎',
      '初窥门径，未来可期！',
      '基础打得不错，再接再厉！'
    ],
    platinum: [
      '别灰心，多练习就能进步！🌟',
      '每一次尝试都是成长的机会！',
      '再接再厉，你可以的！'
    ],
    bronze: [
      '没关系，从头再来也是一种勇气！🛡️',
      '不怕失败，勇敢的你最棒！',
      '万事开头难，坚持下去就好！'
    ]
  };

  // ============ 连胜额外鼓励 ============
  var STREAK_ENCOURAGEMENTS = [
    { minStreak: 10, text: '连续{streak}次答对，势不可挡！🔥🔥🔥' },
    { minStreak: 5,  text: '连对{streak}题，手感火热！🔥🔥' },
    { minStreak: 3,  text: '连对{streak}题，状态不错！🔥' }
  ];

  // ============ 核心API ============

  var ScoringSystem = {

    /**
     * 计算得分：每题20分，满分100
     * @param {number} correctCount - 答对题数
     * @param {number} totalQuestions - 总题数
     * @returns {number} 得分 (0-100)
     */
    calculateScore: function (correctCount, totalQuestions) {
      if (!totalQuestions || totalQuestions <= 0) return 0;
      var score = Math.round((correctCount / totalQuestions) * 100);
      return Math.max(0, Math.min(100, score));
    },

    /**
     * 根据分数返回段位信息
     * @param {number} score - 分数 (0-100)
     * @returns {{title: string, emoji: string, tier: string, color: string}}
     */
    getRank: function (score) {
      score = Math.max(0, Math.min(100, score || 0));
      for (var i = 0; i < RANK_CONFIG.length; i++) {
        if (score >= RANK_CONFIG[i].minScore) {
          // 返回副本避免外部修改
          var rank = RANK_CONFIG[i];
          return {
            title: rank.title,
            emoji: rank.emoji,
            tier: rank.tier,
            color: rank.color
          };
        }
      }
      // fallback
      var fallback = RANK_CONFIG[RANK_CONFIG.length - 1];
      return {
        title: fallback.title,
        emoji: fallback.emoji,
        tier: fallback.tier,
        color: fallback.color
      };
    },

    /**
     * 根据段位和连胜返回鼓励文案
     * @param {Object} rank - 段位对象 (getRank返回值)
     * @param {number} streakCount - 当前连胜次数
     * @returns {string} 鼓励文案
     */
    getEncouragementText: function (rank, streakCount) {
      var tier = (rank && rank.tier) ? rank.tier : 'bronze';
      var texts = ENCOURAGEMENT_TEXTS[tier] || ENCOURAGEMENT_TEXTS.bronze;
      var baseText = texts[Math.floor(Math.random() * texts.length)];

      // 如果有连胜，追加连胜鼓励
      if (streakCount && streakCount >= 3) {
        for (var i = 0; i < STREAK_ENCOURAGEMENTS.length; i++) {
          if (streakCount >= STREAK_ENCOURAGEMENTS[i].minStreak) {
            var streakText = STREAK_ENCOURAGEMENTS[i].text.replace('{streak}', streakCount);
            return baseText + ' ' + streakText;
          }
        }
      }

      return baseText;
    },

    /**
     * 返回反馈语音文本
     * @param {Object} rank - 段位对象
     * @param {boolean} isCorrect - 本题是否答对
     * @returns {string} 适合语音播报的反馈文本
     */
    getFeedbackVoice: function (rank, isCorrect) {
      if (isCorrect) {
        var tier = (rank && rank.tier) ? rank.tier : 'bronze';
        switch (tier) {
          case 'king_glory':
            return '太棒了！回答完全正确！';
          case 'king_strong':
            return '非常好！答对了！';
          case 'star':
            return '不错，答对了！';
          case 'diamond':
            return '好的，这题答对了！';
          default:
            return '答对了，继续加油！';
        }
      } else {
        var tier2 = (rank && rank.tier) ? rank.tier : 'bronze';
        switch (tier2) {
          case 'king_glory':
          case 'king_strong':
            return '这道题没答对，不过没关系，继续挑战！';
          case 'star':
          case 'diamond':
            return '这题答错了，别灰心，下一题加油！';
          default:
            return '没关系，答错也是学习的过程，继续加油！';
        }
      }
    },

    /**
     * 检查是否解锁新成就
     * @param {Object} stats - 用户统计数据
     * @param {number} stats.bestScore - 历史最高分
     * @param {number} stats.currentStreak - 当前连胜天数/次数
     * @param {number} stats.totalCorrect - 累计答对题数
     * @param {string[]} stats.unlockedTiers - 已解锁的段位列表
     * @param {string[]} [stats.existingAchievements] - 已获得的成就ID列表
     * @returns {{newAchievements: Array, allAchievements: Array}}
     */
    checkAchievements: function (stats) {
      stats = stats || {};
      var existing = stats.existingAchievements || [];
      var newAchievements = [];
      var allAchievements = [];

      for (var i = 0; i < ACHIEVEMENTS.length; i++) {
        var achievement = ACHIEVEMENTS[i];
        var unlocked = false;

        try {
          unlocked = achievement.check(stats);
        } catch (e) {
          console.warn('[ScoringSystem] 成就检查出错:', achievement.id, e);
        }

        var info = {
          id: achievement.id,
          name: achievement.name,
          description: achievement.description,
          icon: achievement.icon,
          unlocked: unlocked,
          isNew: unlocked && existing.indexOf(achievement.id) === -1
        };

        allAchievements.push(info);

        if (info.isNew) {
          newAchievements.push(info);
        }
      }

      return {
        newAchievements: newAchievements,
        allAchievements: allAchievements
      };
    }
  };

  // ============ 暴露到全局 ============
  window.ScoringSystem = ScoringSystem;

})();
