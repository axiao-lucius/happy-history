/**
 * VoiceEngine - 语音识别与合成引擎
 * 基于 Web Speech API，提供语音合成(TTS)和语音识别(STT)能力
 */
(function () {
  'use strict';

  // ============ 内部状态 ============
  var _synth = null;
  var _recognition = null;
  var _isSupported = false;
  var _isListening = false;

  // ============ 情感映射配置 ============
  var EMOTION_MAP = {
    encourage: { rate: 1.2, pitch: 1.3 },
    comfort:   { rate: 0.8, pitch: 0.7 },
    excited:   { rate: 1.1, pitch: 1.4 },
    normal:    { rate: 1.0, pitch: 1.0 }
  };

  // ============ 语气词过滤列表 ============
  var FILLER_WORDS = ['嗯', '啊', '是', '我觉得', '应该是', '那个', '这个', '就是', '然后', '对'];

  // ============ 工具函数 ============

  /**
   * 去除文本中的语气词
   */
  function removeFillers(text) {
    if (!text) return '';
    var cleaned = text;
    for (var i = 0; i < FILLER_WORDS.length; i++) {
      // 使用全局替换，忽略前后空白
      var escaped = FILLER_WORDS[i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      cleaned = cleaned.replace(new RegExp(escaped, 'g'), '');
    }
    return cleaned.trim();
  }

  /**
   * 从文本中提取选项字母 (A/B/C/D)
   */
  function extractOptionLetter(text) {
    if (!text) return null;
    var match = text.match(/[ABCDabcd]/);
    return match ? match[0].toUpperCase() : null;
  }

  /**
   * 计算两个字符串的相似度 (简单编辑距离)
   */
  function similarity(a, b) {
    if (!a || !b) return 0;
    a = a.toLowerCase();
    b = b.toLowerCase();
    if (a === b) return 1;
    if (a.indexOf(b) !== -1 || b.indexOf(a) !== -1) return 0.8;

    var longer = a.length > b.length ? a : b;
    var shorter = a.length > b.length ? b : a;
    var longerLen = longer.length;
    var shorterLen = shorter.length;

    if (longerLen === 0) return 1;

    var costs = [];
    for (var i = 0; i <= longerLen; i++) {
      var lastVal = i;
      for (var j = 0; j <= shorterLen; j++) {
        if (i === 0) {
          costs[j] = j;
        } else if (j > 0) {
          var newVal = costs[j - 1];
          if (longer.charAt(i - 1) !== shorter.charAt(j - 1)) {
            newVal = Math.min(Math.min(newVal, lastVal), costs[j]) + 1;
          }
          costs[j - 1] = lastVal;
          lastVal = newVal;
        }
      }
      if (i > 0) costs[shorterLen] = lastVal;
    }

    return (longerLen - costs[shorterLen]) / longerLen;
  }

  // ============ 核心API ============

  var VoiceEngine = {

    /**
     * 初始化 Web Speech API，检测浏览器支持情况
     */
    init: function () {
      // 检测语音合成支持
      if ('speechSynthesis' in window) {
        _synth = window.speechSynthesis;
        _isSupported = true;
      } else {
        _isSupported = false;
        console.warn('[VoiceEngine] 当前浏览器不支持 Web Speech API (speechSynthesis)');
        this._notifyUnsupported();
        return;
      }

      // 检测语音识别支持
      var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        _recognition = new SpeechRecognition();
        _recognition.lang = 'zh-CN';
        _recognition.continuous = false;
        _recognition.interimResults = false;
      } else {
        console.warn('[VoiceEngine] 当前浏览器不支持语音识别 (SpeechRecognition)');
      }

      console.log('[VoiceEngine] 初始化完成', {
        ttsSupported: !!_synth,
        sttSupported: !!_recognition
      });
    },

    /**
     * 语音合成朗读文本
     * @param {string} text - 要朗读的文本
     * @param {Object} options - 朗读选项 {rate, pitch, emotion}
     */
    speak: function (text, options) {
      if (!_synth) {
        console.warn('[VoiceEngine] 语音合成不可用');
        this._notifyUnsupported();
        return;
      }

      if (!text) return;

      options = options || {};
      var emotion = options.emotion || 'normal';
      var emotionConfig = EMOTION_MAP[emotion] || EMOTION_MAP.normal;

      // 取消当前正在播放的语音
      _synth.cancel();

      var utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-CN';
      utterance.rate = options.rate || emotionConfig.rate;
      utterance.pitch = options.pitch || emotionConfig.pitch;

      // 尝试选择中文语音
      var voices = _synth.getVoices();
      for (var i = 0; i < voices.length; i++) {
        if (voices[i].lang && voices[i].lang.indexOf('zh') !== -1) {
          utterance.voice = voices[i];
          break;
        }
      }

      _synth.speak(utterance);
    },

    /**
     * 开始语音识别
     * @param {Function} onResult - 识别成功回调 onResult(transcript)
     * @param {Function} onError - 识别失败回调 onError(error)
     */
    startListening: function (onResult, onError) {
      if (!_recognition) {
        console.warn('[VoiceEngine] 语音识别不可用');
        if (typeof onError === 'function') {
          onError({ type: 'not_supported', message: '当前浏览器不支持语音识别' });
        }
        return;
      }

      if (_isListening) {
        console.warn('[VoiceEngine] 已在识别中，请先停止');
        return;
      }

      _isListening = true;

      _recognition.onresult = function (event) {
        _isListening = false;
        if (event.results && event.results.length > 0) {
          var transcript = event.results[0][0].transcript;
          if (typeof onResult === 'function') {
            onResult(transcript);
          }
        }
      };

      _recognition.onerror = function (event) {
        _isListening = false;
        console.warn('[VoiceEngine] 语音识别错误:', event.error);
        if (typeof onError === 'function') {
          onError({ type: event.error, message: '语音识别出错: ' + event.error });
        }
      };

      _recognition.onend = function () {
        _isListening = false;
      };

      try {
        _recognition.start();
      } catch (e) {
        _isListening = false;
        console.warn('[VoiceEngine] 启动语音识别失败:', e);
        if (typeof onError === 'function') {
          onError({ type: 'start_failed', message: e.message });
        }
      }
    },

    /**
     * 停止语音识别
     */
    stopListening: function () {
      if (_recognition && _isListening) {
        _recognition.stop();
        _isListening = false;
      }
    },

    /**
     * 返回是否支持语音功能
     * @returns {boolean}
     */
    isSupported: function () {
      return _isSupported;
    },

    /**
     * 模糊匹配语音回答与正确答案
     * @param {string} spokenText - 用户语音识别文本
     * @param {string} correctAnswer - 正确答案（如 "A" 或完整答案文本）
     * @param {Object} options - 可选参数 {optionTexts: {A:'...', B:'...'}} 选项文本映射
     * @returns {{matched: boolean, confidence: number, matchedOption: string}}
     */
    matchAnswer: function (spokenText, correctAnswer, options) {
      options = options || {};
      var result = {
        matched: false,
        confidence: 0,
        matchedOption: ''
      };

      if (!spokenText || !correctAnswer) return result;

      // Step 1: 清理语气词
      var cleanedSpoken = removeFillers(spokenText);

      // Step 2: 提取选项字母
      var spokenOption = extractOptionLetter(cleanedSpoken);
      var correctOption = extractOptionLetter(correctAnswer);

      // Step 3: 直接匹配选项字母
      if (spokenOption && correctOption && spokenOption === correctOption) {
        result.matched = true;
        result.confidence = 1.0;
        result.matchedOption = spokenOption;
        return result;
      }

      // Step 4: 匹配选项文本关键词
      if (options.optionTexts && typeof options.optionTexts === 'object') {
        var bestMatch = null;
        var bestScore = 0;

        var keys = Object.keys(options.optionTexts);
        for (var i = 0; i < keys.length; i++) {
          var key = keys[i];
          var optionText = options.optionTexts[key];
          if (!optionText) continue;

          // 检查语音文本是否包含选项关键词
          var score = similarity(cleanedSpoken, optionText);

          // 也检查选项文本的子串匹配
          if (cleanedSpoken.indexOf(optionText) !== -1 || optionText.indexOf(cleanedSpoken) !== -1) {
            score = Math.max(score, 0.85);
          }

          if (score > bestScore) {
            bestScore = score;
            bestMatch = key;
          }
        }

        if (bestMatch && bestScore >= 0.5) {
          result.matched = (correctOption && bestMatch === correctOption) ||
                           (!correctOption && bestMatch === correctAnswer);
          result.confidence = bestScore;
          result.matchedOption = bestMatch;
          return result;
        }
      }

      // Step 5: 直接文本相似度匹配
      var directScore = similarity(cleanedSpoken, correctAnswer);
      if (directScore >= 0.6) {
        result.matched = true;
        result.confidence = directScore;
        result.matchedOption = correctOption || correctAnswer;
      }

      return result;
    },

    /**
     * 降级提示：通知UI层语音不可用
     * @private
     */
    _notifyUnsupported: function () {
      // 触发自定义事件，供UI层监听
      if (typeof window.dispatchEvent === 'function') {
        var event;
        try {
          event = new CustomEvent('voiceEngine:unsupported', {
            detail: { message: '当前浏览器不支持语音功能，请使用Chrome/Edge/Safari最新版' }
          });
        } catch (e) {
          // IE fallback
          event = document.createEvent('CustomEvent');
          event.initCustomEvent('voiceEngine:unsupported', true, true, {
            message: '当前浏览器不支持语音功能，请使用Chrome/Edge/Safari最新版'
          });
        }
        window.dispatchEvent(event);
      }
    }
  };

  // ============ 暴露到全局 ============
  window.VoiceEngine = VoiceEngine;

})();
