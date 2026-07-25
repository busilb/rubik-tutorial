/* ============================================
   三阶魔方教程 - 游戏化交互脚本
   18关卡制闯关系统 + 完整互动体验
   ============================================ */

document.addEventListener('DOMContentLoaded', function () {

  /* -----------------------------------------------
     SECTION 1: GAME STATE
     ----------------------------------------------- */

  var TOTAL_LEVELS = 18;
  var STORAGE_KEY = 'rubik-game';

  var defaultState = {
    currentLevel: 1,
    completedLevels: [],
    quizScores: {},
    practiceCounters: {}
  };

  var gameState = loadState();

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return cloneState(defaultState);
      var parsed = JSON.parse(raw);
      // Validate structure
      if (
        typeof parsed !== 'object' || parsed === null ||
        typeof parsed.currentLevel !== 'number' ||
        !Array.isArray(parsed.completedLevels) ||
        typeof parsed.quizScores !== 'object' ||
        typeof parsed.practiceCounters !== 'object'
      ) {
        return cloneState(defaultState);
      }
      // Clamp currentLevel
      if (parsed.currentLevel < 1) parsed.currentLevel = 1;
      if (parsed.currentLevel > TOTAL_LEVELS) parsed.currentLevel = TOTAL_LEVELS;
      return parsed;
    } catch (e) {
      return cloneState(defaultState);
    }
  }

  function cloneState(s) {
    return {
      currentLevel: s.currentLevel,
      completedLevels: s.completedLevels.slice(),
      quizScores: JSON.parse(JSON.stringify(s.quizScores)),
      practiceCounters: JSON.parse(JSON.stringify(s.practiceCounters))
    };
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(gameState));
    } catch (e) {
      // localStorage may be full or disabled; silently ignore
    }
  }

  function resetGame() {
    gameState = cloneState(defaultState);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) { /* ignore */ }
    location.reload();
  }

  /* -----------------------------------------------
     SECTION 2: LEVEL ELEMENT DISCOVERY
     ----------------------------------------------- */

  // Try the specified structure first: section.level[data-level]
  var levelElements = document.querySelectorAll('section.level[data-level]');

  // Fallback: if no .level sections found, treat all step-sections + hero as levels
  var fallbackMode = false;
  var fallbackSections = [];
  if (levelElements.length === 0) {
    fallbackMode = true;
    var allSections = document.querySelectorAll('section[id]');
    for (var fi = 0; fi < allSections.length; fi++) {
      fallbackSections.push(allSections[fi]);
    }
    // Adjust total levels to match actual section count
    TOTAL_LEVELS = fallbackSections.length || 18;
  }

  function getLevelElement(n) {
    if (!fallbackMode) {
      return document.querySelector('section.level[data-level="' + n + '"]');
    }
    // Fallback: treat sections in order
    if (n >= 1 && n <= fallbackSections.length) {
      return fallbackSections[n - 1];
    }
    return null;
  }

  function getLevelNumber(el) {
    if (!fallbackMode) {
      var attr = el.getAttribute('data-level');
      return attr ? parseInt(attr, 10) : 0;
    }
    for (var i = 0; i < fallbackSections.length; i++) {
      if (fallbackSections[i] === el) return i + 1;
    }
    return 0;
  }

  function getAllLevelElements() {
    if (!fallbackMode) {
      return document.querySelectorAll('section.level[data-level]');
    }
    return fallbackSections;
  }

  /* -----------------------------------------------
     SECTION 3: LEVEL MANAGEMENT
     ----------------------------------------------- */

  function isLevelCompleted(n) {
    return gameState.completedLevels.indexOf(n) !== -1;
  }

  function isLevelUnlocked(n) {
    if (n <= 1) return true;
    return isLevelCompleted(n - 1);
  }

  function updateLevelUI() {
    var levels = getAllLevelElements();
    for (var i = 0; i < levels.length; i++) {
      var el = levels[i];
      var n = fallbackMode ? (i + 1) : parseInt(el.getAttribute('data-level'), 10);
      if (!n) continue;

      // Remove old classes
      el.classList.remove('locked', 'current', 'completed');

      // Remove any previously injected overlay
      var existingOverlay = el.querySelector('.level-lock-overlay');
      if (existingOverlay) {
        existingOverlay.parentNode.removeChild(existingOverlay);
      }

      if (isLevelCompleted(n)) {
        el.classList.add('completed');
      } else if (n === gameState.currentLevel && isLevelUnlocked(n)) {
        el.classList.add('current');
      } else if (!isLevelUnlocked(n)) {
        el.classList.add('locked');
        // Inject lock overlay
        var overlay = document.createElement('div');
        overlay.className = 'level-lock-overlay';
        overlay.innerHTML = '<div class="lock-icon">🔒</div><div class="lock-text">完成上一关解锁</div>';
        // Ensure section has position for overlay
        var pos = window.getComputedStyle(el).position;
        if (pos === 'static') {
          el.style.position = 'relative';
        }
        el.appendChild(overlay);
      }
    }

    updateProgress();
    updateCompleteButtons();
  }

  function completeLevel(n) {
    if (isLevelCompleted(n)) return;

    gameState.completedLevels.push(n);

    // Advance currentLevel
    if (n >= gameState.currentLevel && n < TOTAL_LEVELS) {
      gameState.currentLevel = n + 1;
    }

    saveState();
    updateLevelUI();
    showAchievementPopup(n);
  }

  /* -----------------------------------------------
     SECTION 4: PROGRESS BAR
     ----------------------------------------------- */

  function updateProgress() {
    var pct = (gameState.completedLevels.length / TOTAL_LEVELS) * 100;

    var progressFill = document.getElementById('progress-fill');
    if (progressFill) {
      progressFill.style.width = pct + '%';
    }

    // Also update existing sidebar progress bars (fallback compatibility)
    var sidebarFill = document.getElementById('progressFill');
    if (sidebarFill) {
      sidebarFill.style.width = pct + '%';
    }
    var mobileFill = document.getElementById('mobileProgressFill');
    if (mobileFill) {
      mobileFill.style.width = pct + '%';
    }

    var levelCounter = document.getElementById('level-counter');
    if (levelCounter) {
      levelCounter.textContent = '关卡 ' + gameState.completedLevels.length + '/' + TOTAL_LEVELS;
    }
  }

  /* -----------------------------------------------
     SECTION 5: QUIZ SYSTEM
     ----------------------------------------------- */

  // Quiz answer data for the existing HTML structure
  var quizAnswers = {
    1: { correct: 2, explain: '对！6个面，6种颜色：白、黄、红、橙、蓝、绿。' },
    2: { correct: 3, explain: '对！总共26个小块，但中心块不动（6个），所以可以动的是 12棱块 + 8角块 = 20个。' },
    3: { correct: 2, explain: '对！中心块永远不会换位置——它决定了每个面的颜色，是你的"坐标系"。' },
    4: { correct: 3, explain: '对！角块在3个面的交汇处，所以有3种颜色。棱块在2个面的交界处，有2种颜色。' },
    5: { correct: 2, explain: '对！目前世界纪录是3.13秒（2024年）。不过你的第一次还原，30分钟就很厉害了！' }
  };

  var quizDoneCount = 0;
  var quizCorrectCount = 0;

  function initQuizSystem() {
    var allQuizContainers = document.querySelectorAll('.quiz-options');

    for (var qi = 0; qi < allQuizContainers.length; qi++) {
      (function (container) {
        var quizId = container.getAttribute('data-quiz') || '';
        var correctAttr = container.getAttribute('data-correct');
        var correctIdx = correctAttr ? parseInt(correctAttr, 10) : 0;

        // For existing HTML: try to get quiz number from parent card ID
        var parentCard = container.closest('.quiz-card') || container.closest('.content-card');
        var cardId = parentCard ? parentCard.id : '';
        var qNum = 0;
        if (cardId) {
          var match = cardId.match(/\d+/);
          if (match) qNum = parseInt(match[0], 10);
        }

        // Use data-quiz as quiz ID, fallback to card-based number
        var effectiveId = quizId || ('quiz-' + qNum);

        // Restore answered state
        if (gameState.quizScores[effectiveId] !== undefined) {
          container.classList.add('answered');
          // Visually mark the correct answer
          var allBtns = container.querySelectorAll('.quiz-btn');
          for (var bi = 0; bi < allBtns.length; bi++) {
            var btnIdx = parseInt(allBtns[bi].getAttribute('data-idx'), 10);
            var correct = correctIdx || (quizAnswers[qNum] ? quizAnswers[qNum].correct : 0);
            if (btnIdx === correct) {
              allBtns[bi].classList.add('correct');
            }
          }
          // Show feedback if it exists
          var fb = document.getElementById('feedback' + qNum);
          if (fb && quizAnswers[qNum]) {
            if (gameState.quizScores[effectiveId]) {
              fb.innerHTML = '✅ ' + quizAnswers[qNum].explain;
              fb.className = 'quiz-feedback show correct-fb';
            } else {
              fb.innerHTML = '❌ 不对哦！' + quizAnswers[qNum].explain;
              fb.className = 'quiz-feedback show wrong-fb';
            }
          }
          quizDoneCount++;
          if (gameState.quizScores[effectiveId]) quizCorrectCount++;
          return;
        }

        var buttons = container.querySelectorAll('.quiz-btn');
        for (var bi = 0; bi < buttons.length; bi++) {
          (function (btn) {
            btn.addEventListener('click', function () {
              if (container.classList.contains('answered')) return;
              container.classList.add('answered');

              var idx = parseInt(btn.getAttribute('data-idx'), 10);
              var correct = correctIdx || (quizAnswers[qNum] ? quizAnswers[qNum].correct : 0);
              var isCorrect = (idx === correct);

              if (isCorrect) {
                btn.classList.add('correct');
                quizCorrectCount++;
              } else {
                btn.classList.add('wrong');
                // Highlight correct answer
                var allBtns = container.querySelectorAll('.quiz-btn');
                for (var ci = 0; ci < allBtns.length; ci++) {
                  if (parseInt(allBtns[ci].getAttribute('data-idx'), 10) === correct) {
                    allBtns[ci].classList.add('correct');
                  }
                }
              }

              // Show feedback
              var feedback = document.getElementById('feedback' + qNum);
              if (feedback && quizAnswers[qNum]) {
                if (isCorrect) {
                  feedback.innerHTML = '✅ ' + quizAnswers[qNum].explain;
                  feedback.className = 'quiz-feedback show correct-fb';
                } else {
                  feedback.innerHTML = '❌ 不对哦！' + quizAnswers[qNum].explain;
                  feedback.className = 'quiz-feedback show wrong-fb';
                }
              }

              // Also handle generic .quiz-feedback siblings
              var genericFeedback = container.parentNode.querySelector('.quiz-feedback');
              if (genericFeedback && genericFeedback !== feedback) {
                genericFeedback.classList.add('show');
                if (isCorrect) {
                  genericFeedback.classList.add('correct-fb');
                  genericFeedback.textContent = '回答正确！';
                } else {
                  genericFeedback.classList.add('wrong-fb');
                  genericFeedback.textContent = '再想想哦！';
                }
              }

              // Track score
              gameState.quizScores[effectiveId] = isCorrect;
              saveState();

              quizDoneCount++;

              // Show quiz result if all 5 original quizzes are done
              if (quizDoneCount >= 5) {
                var result = document.getElementById('quizResult');
                var scoreNum = document.getElementById('scoreNum');
                var comment = document.getElementById('quizComment');
                if (result && scoreNum) {
                  result.style.display = 'block';
                  scoreNum.textContent = quizCorrectCount;
                  if (comment) {
                    if (quizCorrectCount === 5) comment.textContent = '满分！你已经是魔方理论大师了！';
                    else if (quizCorrectCount >= 3) comment.textContent = '不错！对魔方已经有基本了解了。';
                    else comment.textContent = '没关系！看完教程就全懂了。';
                  }
                }
              }

              // Check if this level's quizzes are all done (for complete button enablement)
              checkLevelQuizCompletion(container);
              updateCompleteButtons();
            });
          })(buttons[bi]);
        }
      })(allQuizContainers[qi]);
    }
  }

  function checkLevelQuizCompletion(quizContainer) {
    // Find the parent level
    var levelEl = quizContainer.closest('section.level') || quizContainer.closest('section[id]');
    if (!levelEl) return;

    var quizzes = levelEl.querySelectorAll('.quiz-options');
    var allAnswered = true;
    for (var i = 0; i < quizzes.length; i++) {
      if (!quizzes[i].classList.contains('answered')) {
        allAnswered = false;
        break;
      }
    }

    if (allAnswered) {
      var completeBtn = levelEl.querySelector('.complete-btn');
      if (completeBtn && completeBtn.hasAttribute('data-requires-quiz')) {
        completeBtn.disabled = false;
        completeBtn.classList.remove('disabled');
      }
    }
  }

  function areLevelQuizzesComplete(levelEl) {
    var quizzes = levelEl.querySelectorAll('.quiz-options');
    if (quizzes.length === 0) return true;
    for (var i = 0; i < quizzes.length; i++) {
      if (!quizzes[i].classList.contains('answered')) return false;
    }
    return true;
  }

  /* -----------------------------------------------
     SECTION 6: PRACTICE COUNTERS
     ----------------------------------------------- */

  function initPracticeCounters() {
    // Handle buttons with .practice-btn class and data-target
    var practiceBtns = document.querySelectorAll('.practice-btn');
    for (var pi = 0; pi < practiceBtns.length; pi++) {
      (function (btn) {
        var target = parseInt(btn.getAttribute('data-target'), 10) || 10;
        var counterId = btn.getAttribute('data-counter-id') || ('practice-' + pi);
        var countDisplay = btn.parentNode.querySelector('.practice-count') ||
                           btn.closest('.practice-counter, .practice-box')
                             && btn.closest('.practice-counter, .practice-box').querySelector('.practice-count');

        // Restore count
        var count = gameState.practiceCounters[counterId] || 0;
        if (countDisplay) countDisplay.textContent = count;

        if (count >= target) {
          btn.textContent = '🎉 太棒了！已完成！';
          btn.disabled = true;
          btn.style.background = '#10B981';
        }

        btn.addEventListener('click', function () {
          if (count >= target) return;
          count++;
          gameState.practiceCounters[counterId] = count;
          saveState();

          if (countDisplay) countDisplay.textContent = count;

          if (count >= target) {
            btn.textContent = '🎉 太棒了！已完成！';
            btn.disabled = true;
            btn.style.background = '#10B981';
            updateCompleteButtons();
          } else {
            btn.textContent = '再来一遍！还剩 ' + (target - count) + ' 遍';
          }
        });
      })(practiceBtns[pi]);
    }

    // Handle the existing #practiceBtn (from original HTML)
    var legacyPracticeBtn = document.getElementById('practiceBtn');
    var legacyPracticeCount = document.getElementById('practiceCount');
    // Only init if not already handled by .practice-btn logic
    if (legacyPracticeBtn && !legacyPracticeBtn.classList.contains('practice-btn')) {
      var legacyTarget = 10;
      var legacyCounterId = 'legacy-practice';
      var legacyCount = gameState.practiceCounters[legacyCounterId] || 0;

      if (legacyPracticeCount) legacyPracticeCount.textContent = legacyCount;

      if (legacyCount >= legacyTarget) {
        legacyPracticeBtn.textContent = '太棒了！你已经掌握了基本手法！';
        legacyPracticeBtn.style.background = '#10B981';
        legacyPracticeBtn.disabled = true;
      }

      legacyPracticeBtn.addEventListener('click', function () {
        if (legacyCount >= legacyTarget) return;
        legacyCount++;
        gameState.practiceCounters[legacyCounterId] = legacyCount;
        saveState();

        if (legacyPracticeCount) legacyPracticeCount.textContent = legacyCount;

        if (legacyCount >= legacyTarget) {
          legacyPracticeBtn.textContent = '太棒了！你已经掌握了基本手法！';
          legacyPracticeBtn.style.background = '#10B981';
          legacyPracticeBtn.disabled = true;
          updateCompleteButtons();
        } else if (legacyCount >= 6) {
          legacyPracticeBtn.textContent = '魔方是不是回原了？继续！(' + (legacyTarget - legacyCount) + ' 遍)';
        } else {
          legacyPracticeBtn.textContent = '再来一遍！还剩 ' + (legacyTarget - legacyCount) + ' 遍';
        }
      });
    }
  }

  /* -----------------------------------------------
     SECTION 7: COMPLETE BUTTONS
     ----------------------------------------------- */

  function updateCompleteButtons() {
    var completeBtns = document.querySelectorAll('.complete-btn');
    for (var ci = 0; ci < completeBtns.length; ci++) {
      var btn = completeBtns[ci];
      var levelEl = btn.closest('section.level') || btn.closest('section[id]');
      if (!levelEl) continue;
      var levelNum = getLevelNumber(levelEl);
      if (!levelNum) continue;

      // Already completed
      if (isLevelCompleted(levelNum)) {
        btn.disabled = true;
        btn.textContent = '✅ 已完成';
        btn.classList.add('completed');
        continue;
      }

      // Check requirements
      var requiresQuiz = btn.hasAttribute('data-requires-quiz');
      var requiresPractice = btn.hasAttribute('data-requires-practice');
      var requiresChecklist = btn.hasAttribute('data-requires-checklist');
      var shouldEnable = true;

      if (requiresQuiz && !areLevelQuizzesComplete(levelEl)) {
        shouldEnable = false;
      }

      if (requiresPractice) {
        var practiceBtn2 = levelEl.querySelector('.practice-btn');
        if (practiceBtn2 && !practiceBtn2.disabled) {
          shouldEnable = false;
        }
      }

      if (requiresChecklist) {
        if (!isChecklistComplete(levelEl)) {
          shouldEnable = false;
        }
      }

      btn.disabled = !shouldEnable;
      if (!shouldEnable) {
        btn.classList.add('disabled');
      } else {
        btn.classList.remove('disabled');
      }
    }
  }

  function initCompleteButtons() {
    var completeBtns = document.querySelectorAll('.complete-btn');
    for (var ci = 0; ci < completeBtns.length; ci++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          if (btn.disabled) return;
          var levelEl = btn.closest('section.level') || btn.closest('section[id]');
          if (!levelEl) return;
          var levelNum = getLevelNumber(levelEl);
          if (!levelNum) return;
          completeLevel(levelNum);
        });
      })(completeBtns[ci]);
    }
  }

  /* -----------------------------------------------
     SECTION 8: ACHIEVEMENT POPUP
     ----------------------------------------------- */

  var achievementMessages = {
    // Phase 1: Introduction (levels 1-4)
    1: { name: '初识魔方', xp: 50, msg: '旅程开始了！每一位大师都从这里出发。' },
    2: { name: '趣味问答', xp: 100, msg: '你的魔方知识已经超过 90% 的人了！' },
    3: { name: '动力满满', xp: 50, msg: '知道为什么学，就不会轻易放弃！' },
    4: { name: '全局地图', xp: 100, msg: '看清全貌，接下来每一步都不会迷路。' },
    // Phase 2: Basics (levels 5-7)
    5: { name: '认识结构', xp: 150, msg: '6个中心、12个棱、8个角——你已经比大多数人更懂魔方了！' },
    6: { name: '握持姿势', xp: 100, msg: '正确的姿势是速度的基础！' },
    7: { name: '手感达人', xp: 200, msg: 'R U R\' U\' 已经刻在你的肌肉记忆里了！' },
    // Phase 3: Layer by Layer (levels 8-14)
    8: { name: '白色十字', xp: 300, msg: '第一步完成！地基打好了，后面会越来越顺。' },
    9: { name: '底层角块', xp: 300, msg: '整个底层都搞定了！你已经完成了最难理解的部分。' },
    10: { name: '中层棱块', xp: 350, msg: '前两层完成！魔方已经搞定三分之二了！' },
    11: { name: '黄色十字', xp: 300, msg: '顶面十字出现了！胜利在望！' },
    12: { name: '顶面全黄', xp: 300, msg: '一整面金灿灿的黄色——太漂亮了！' },
    13: { name: '角块归位', xp: 350, msg: '只差最后一步了！坚持住！' },
    14: { name: '大功告成', xp: 500, msg: '🎊 你做到了！魔方已经完全还原！你是最棒的！' },
    // Phase 4: Mastery (levels 15-18)
    15: { name: '公式速查', xp: 100, msg: '所有公式尽在掌握！' },
    16: { name: '进阶挑战', xp: 200, msg: '速度在提升，技巧在精进！' },
    17: { name: '理论大师', xp: 300, msg: '你已经理解了魔方背后的数学原理！' },
    18: { name: '魔方大师', xp: 500, msg: '🏆 全部关卡通关！你是真正的魔方大师！' }
  };

  function showAchievementPopup(levelNum) {
    var popup = document.getElementById('achievement-popup');
    if (!popup) {
      // Create popup if it doesn't exist
      popup = document.createElement('div');
      popup.id = 'achievement-popup';
      popup.className = 'achievement-popup';
      popup.innerHTML =
        '<div class="achievement-inner">' +
          '<div class="achievement-icon">🏆</div>' +
          '<div class="achievement-title"></div>' +
          '<div class="achievement-xp"></div>' +
          '<div class="achievement-msg"></div>' +
        '</div>';
      document.body.appendChild(popup);
    }

    var info = achievementMessages[levelNum] || {
      name: '关卡 ' + levelNum,
      xp: 100,
      msg: '太棒了！继续前进！'
    };

    var titleEl = popup.querySelector('.achievement-title');
    var xpEl = popup.querySelector('.achievement-xp');
    var msgEl = popup.querySelector('.achievement-msg');

    if (titleEl) titleEl.textContent = '🎖️ ' + info.name + ' — 通关！';
    if (xpEl) xpEl.textContent = '+' + info.xp + ' XP';
    if (msgEl) msgEl.textContent = info.msg;

    popup.classList.add('show');

    // Auto-hide after 3 seconds
    var hideTimer = setTimeout(function () {
      hideAchievementPopup(levelNum);
    }, 3000);

    // Click to dismiss
    var clickHandler = function () {
      clearTimeout(hideTimer);
      hideAchievementPopup(levelNum);
      popup.removeEventListener('click', clickHandler);
    };
    popup.addEventListener('click', clickHandler);
  }

  function hideAchievementPopup(completedLevel) {
    var popup = document.getElementById('achievement-popup');
    if (popup) {
      popup.classList.remove('show');
    }

    // Scroll to next level
    var nextLevel = completedLevel + 1;
    if (nextLevel <= TOTAL_LEVELS) {
      var nextEl = getLevelElement(nextLevel);
      if (nextEl) {
        setTimeout(function () {
          nextEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);
      }
    }
  }

  /* -----------------------------------------------
     SECTION 9: HINT SYSTEM
     ----------------------------------------------- */

  function initHintSystem() {
    var hintToggles = document.querySelectorAll('.hint-toggle');
    for (var hi = 0; hi < hintToggles.length; hi++) {
      (function (toggle) {
        toggle.addEventListener('click', function () {
          var hintContent = toggle.nextElementSibling;
          if (!hintContent) {
            // Try finding .hint-content sibling
            hintContent = toggle.parentNode.querySelector('.hint-content');
          }
          if (!hintContent) return;

          if (hintContent.classList.contains('expanded')) {
            hintContent.classList.remove('expanded');
            toggle.textContent = '显示提示';
          } else {
            hintContent.classList.add('expanded');
            toggle.textContent = '隐藏提示';
          }
        });
      })(hintToggles[hi]);
    }
  }

  /* -----------------------------------------------
     SECTION 10: CHECKLIST
     ----------------------------------------------- */

  function initChecklist() {
    var checklistItems = document.querySelectorAll('.checklist-item input[type="checkbox"]');
    for (var chi = 0; chi < checklistItems.length; chi++) {
      (function (checkbox) {
        checkbox.addEventListener('change', function () {
          var levelEl = checkbox.closest('section.level') || checkbox.closest('section[id]');
          if (!levelEl) return;

          if (isChecklistComplete(levelEl)) {
            var completeBtn = levelEl.querySelector('.complete-btn');
            if (completeBtn && completeBtn.hasAttribute('data-requires-checklist')) {
              completeBtn.disabled = false;
              completeBtn.classList.remove('disabled');
            }
          }
          updateCompleteButtons();
        });
      })(checklistItems[chi]);
    }
  }

  function isChecklistComplete(levelEl) {
    var checkboxes = levelEl.querySelectorAll('.checklist-item input[type="checkbox"]');
    if (checkboxes.length === 0) return true;
    for (var i = 0; i < checkboxes.length; i++) {
      if (!checkboxes[i].checked) return false;
    }
    return true;
  }

  /* -----------------------------------------------
     SECTION 11: SCROLL ANIMATIONS
     ----------------------------------------------- */

  function initScrollAnimations() {
    var cards = document.querySelectorAll('.card, .content-card');
    if (cards.length === 0) return;

    if (!('IntersectionObserver' in window)) {
      // Fallback: just make everything visible
      for (var i = 0; i < cards.length; i++) {
        cards[i].classList.add('visible');
      }
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (entries[i].isIntersecting) {
          entries[i].target.classList.add('visible');
        }
      }
    }, {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    });

    for (var i = 0; i < cards.length; i++) {
      observer.observe(cards[i]);
    }
  }

  /* -----------------------------------------------
     SECTION 12: NAVIGATION
     ----------------------------------------------- */

  function initNavigation() {
    // Sidebar nav link tracking (scroll-based)
    var sections = document.querySelectorAll('section[id]');
    var navLinks = document.querySelectorAll('.nav-link');

    function updateActiveLink() {
      var current = '';
      var scrollY = window.scrollY + 120;

      for (var i = 0; i < sections.length; i++) {
        if (sections[i].offsetTop <= scrollY) {
          current = sections[i].id;
        }
      }

      var activeIndex = 0;
      for (var j = 0; j < navLinks.length; j++) {
        navLinks[j].classList.remove('active');
        if (navLinks[j].getAttribute('href') === '#' + current) {
          navLinks[j].classList.add('active');
          activeIndex = j;
        }
      }

      // Update sidebar progress
      if (navLinks.length > 0) {
        var pct = ((activeIndex + 1) / navLinks.length) * 100;
        var sidebarFill = document.getElementById('progressFill');
        if (sidebarFill) sidebarFill.style.width = pct + '%';
        var mobileFill = document.getElementById('mobileProgressFill');
        if (mobileFill) mobileFill.style.width = pct + '%';
      }
    }

    window.addEventListener('scroll', updateActiveLink);
    updateActiveLink();

    // Smooth scroll for nav links
    for (var ni = 0; ni < navLinks.length; ni++) {
      (function (link) {
        link.addEventListener('click', function (e) {
          e.preventDefault();
          var targetId = link.getAttribute('href');
          if (!targetId || targetId.length < 2) return;
          var target = document.getElementById(targetId.slice(1));
          if (target) {
            // Check if target level is locked
            var levelNum = getLevelNumber(target);
            if (levelNum && !isLevelUnlocked(levelNum)) {
              return; // Don't scroll to locked levels
            }
            target.scrollIntoView({ behavior: 'smooth' });
          }
          // Close mobile sidebar
          var sidebar = document.getElementById('sidebar');
          if (sidebar) sidebar.classList.remove('open');
        });
      })(navLinks[ni]);
    }

    // Click on progress bar area to navigate to levels
    var progressBarArea = document.querySelector('.progress-bar');
    if (progressBarArea) {
      progressBarArea.addEventListener('click', function (e) {
        var rect = progressBarArea.getBoundingClientRect();
        var clickRatio = (e.clientX - rect.left) / rect.width;
        var targetLevel = Math.ceil(clickRatio * TOTAL_LEVELS);
        if (targetLevel < 1) targetLevel = 1;
        if (targetLevel > TOTAL_LEVELS) targetLevel = TOTAL_LEVELS;

        if (isLevelUnlocked(targetLevel)) {
          var el = getLevelElement(targetLevel);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth' });
          }
        }
      });
    }

    // Keyboard navigation: arrow keys between levels
    document.addEventListener('keydown', function (e) {
      // Don't interfere with inputs or textareas
      var tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        navigateLevel(1);
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        navigateLevel(-1);
      }
    });
  }

  function navigateLevel(direction) {
    // Find current visible level
    var currentVisibleLevel = 1;
    var scrollY = window.scrollY + 200;
    var allLevels = getAllLevelElements();

    for (var i = 0; i < allLevels.length; i++) {
      if (allLevels[i].offsetTop <= scrollY) {
        currentVisibleLevel = fallbackMode ? (i + 1) : parseInt(allLevels[i].getAttribute('data-level'), 10);
      }
    }

    // Also check section[id] for fallback
    if (allLevels.length === 0) {
      var sectionIds = [
        'hero', 'quiz', 'why', 'story', 'basics', 'holding', 'warmup',
        'step1', 'step2', 'step3', 'step4', 'step5', 'step6', 'step7',
        'cheatsheet'
      ];
      var currentIdx = 0;
      for (var si = sectionIds.length - 1; si >= 0; si--) {
        var sec = document.getElementById(sectionIds[si]);
        if (sec && sec.offsetTop <= scrollY) {
          currentIdx = si;
          break;
        }
      }
      var nextIdx = Math.max(0, Math.min(sectionIds.length - 1, currentIdx + direction));
      var nextSec = document.getElementById(sectionIds[nextIdx]);
      if (nextSec) {
        nextSec.scrollIntoView({ behavior: 'smooth' });
      }
      return;
    }

    var nextLevel = currentVisibleLevel + direction;
    if (nextLevel < 1) nextLevel = 1;
    if (nextLevel > TOTAL_LEVELS) nextLevel = TOTAL_LEVELS;

    if (isLevelUnlocked(nextLevel)) {
      var el = getLevelElement(nextLevel);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }

  /* -----------------------------------------------
     SECTION 13: MOBILE MENU
     ----------------------------------------------- */

  function initMobileMenu() {
    var menuToggle = document.getElementById('menu-toggle');
    var sidebar = document.getElementById('sidebar');

    if (menuToggle && sidebar) {
      menuToggle.addEventListener('click', function () {
        sidebar.classList.toggle('open');
      });

      // Close sidebar when clicking outside
      document.addEventListener('click', function (e) {
        if (sidebar.classList.contains('open') &&
            !sidebar.contains(e.target) &&
            e.target !== menuToggle) {
          sidebar.classList.remove('open');
        }
      });
    }
  }

  /* -----------------------------------------------
     SECTION 14: FORMULA CLICK ANIMATION
     ----------------------------------------------- */

  function initFormulaClicks() {
    var formulaMoves = document.querySelectorAll('.formula-move');
    for (var fi = 0; fi < formulaMoves.length; fi++) {
      (function (move) {
        move.addEventListener('click', function () {
          move.style.transform = 'scale(1.2)';
          setTimeout(function () {
            move.style.transform = 'scale(1)';
          }, 200);
        });
      })(formulaMoves[fi]);
    }
  }

  /* -----------------------------------------------
     SECTION 15: RESET BUTTON
     ----------------------------------------------- */

  function initResetButton() {
    var resetBtn = document.getElementById('reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', function () {
        if (confirm('确定要重置所有进度吗？这将清除你的闯关记录。')) {
          resetGame();
        }
      });
    }
  }

  /* -----------------------------------------------
     SECTION 16: INJECT ACHIEVEMENT POPUP STYLES
     ----------------------------------------------- */

  function injectStyles() {
    var style = document.createElement('style');
    style.textContent =
      /* Achievement popup */
      '.achievement-popup {' +
        'position: fixed;' +
        'top: 0; left: 0; right: 0; bottom: 0;' +
        'display: flex;' +
        'align-items: center;' +
        'justify-content: center;' +
        'z-index: 10000;' +
        'opacity: 0;' +
        'pointer-events: none;' +
        'transition: opacity 0.4s ease;' +
        'background: rgba(0,0,0,0.5);' +
      '}' +
      '.achievement-popup.show {' +
        'opacity: 1;' +
        'pointer-events: auto;' +
      '}' +
      '.achievement-inner {' +
        'background: linear-gradient(135deg, #1a1a2e, #16213e);' +
        'border: 2px solid #FFD500;' +
        'border-radius: 20px;' +
        'padding: 40px 50px;' +
        'text-align: center;' +
        'color: #fff;' +
        'max-width: 420px;' +
        'width: 90%;' +
        'box-shadow: 0 0 60px rgba(255,213,0,0.3);' +
        'transform: scale(0.8);' +
        'transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);' +
      '}' +
      '.achievement-popup.show .achievement-inner {' +
        'transform: scale(1);' +
      '}' +
      '.achievement-icon {' +
        'font-size: 64px;' +
        'margin-bottom: 16px;' +
        'animation: popBounce 0.6s ease;' +
      '}' +
      '.achievement-title {' +
        'font-size: 22px;' +
        'font-weight: 700;' +
        'margin-bottom: 12px;' +
        'color: #FFD500;' +
      '}' +
      '.achievement-xp {' +
        'font-size: 28px;' +
        'font-weight: 800;' +
        'color: #10B981;' +
        'margin-bottom: 12px;' +
        'animation: popBounce 0.6s ease 0.2s both;' +
      '}' +
      '.achievement-msg {' +
        'font-size: 16px;' +
        'color: #ccc;' +
        'line-height: 1.5;' +
      '}' +
      '@keyframes popBounce {' +
        '0% { transform: scale(0); }' +
        '60% { transform: scale(1.2); }' +
        '100% { transform: scale(1); }' +
      '}' +

      /* Level lock overlay */
      '.level-lock-overlay {' +
        'position: absolute;' +
        'top: 0; left: 0; right: 0; bottom: 0;' +
        'background: rgba(0,0,0,0.7);' +
        'display: flex;' +
        'flex-direction: column;' +
        'align-items: center;' +
        'justify-content: center;' +
        'z-index: 100;' +
        'border-radius: inherit;' +
        'backdrop-filter: blur(4px);' +
        '-webkit-backdrop-filter: blur(4px);' +
      '}' +
      '.level-lock-overlay .lock-icon {' +
        'font-size: 48px;' +
        'margin-bottom: 12px;' +
      '}' +
      '.level-lock-overlay .lock-text {' +
        'font-size: 16px;' +
        'color: #ccc;' +
        'font-weight: 600;' +
      '}' +

      /* Completed level indicator */
      'section.completed .section-header::after {' +
        'content: "✅ 已通关";' +
        'display: inline-block;' +
        'margin-left: 12px;' +
        'font-size: 14px;' +
        'background: #10B981;' +
        'color: #fff;' +
        'padding: 4px 12px;' +
        'border-radius: 20px;' +
        'vertical-align: middle;' +
      '}' +

      /* Current level glow */
      'section.current {' +
        'box-shadow: 0 0 0 3px rgba(255,213,0,0.3);' +
        'border-radius: 8px;' +
      '}' +

      /* Complete button states */
      '.complete-btn {' +
        'display: inline-block;' +
        'padding: 14px 36px;' +
        'font-size: 16px;' +
        'font-weight: 700;' +
        'border: none;' +
        'border-radius: 12px;' +
        'cursor: pointer;' +
        'background: linear-gradient(135deg, #FFD500, #F59E0B);' +
        'color: #1a1a2e;' +
        'transition: all 0.3s ease;' +
        'margin-top: 20px;' +
      '}' +
      '.complete-btn:hover:not(:disabled) {' +
        'transform: translateY(-2px);' +
        'box-shadow: 0 4px 20px rgba(255,213,0,0.4);' +
      '}' +
      '.complete-btn:disabled, .complete-btn.disabled {' +
        'opacity: 0.5;' +
        'cursor: not-allowed;' +
        'transform: none;' +
      '}' +
      '.complete-btn.completed {' +
        'background: #10B981;' +
        'color: #fff;' +
        'opacity: 1;' +
      '}' +

      /* Hint system */
      '.hint-content {' +
        'max-height: 0;' +
        'overflow: hidden;' +
        'transition: max-height 0.4s ease, padding 0.4s ease;' +
        'padding: 0 16px;' +
      '}' +
      '.hint-content.expanded {' +
        'max-height: 1000px;' +
        'padding: 16px;' +
      '}' +
      '.hint-toggle {' +
        'background: none;' +
        'border: 2px dashed #4A90D9;' +
        'color: #4A90D9;' +
        'padding: 8px 20px;' +
        'border-radius: 8px;' +
        'cursor: pointer;' +
        'font-size: 14px;' +
        'transition: all 0.3s ease;' +
      '}' +
      '.hint-toggle:hover {' +
        'background: rgba(74,144,217,0.1);' +
      '}';

    document.head.appendChild(style);
  }

  /* -----------------------------------------------
     SECTION 17: SCROLL TO CURRENT LEVEL ON LOAD
     ----------------------------------------------- */

  function scrollToCurrentLevel() {
    // Small delay to ensure layout is ready
    setTimeout(function () {
      // Only scroll if not at the very top (user might have navigated via URL hash)
      if (window.location.hash) return;

      var currentEl = getLevelElement(gameState.currentLevel);
      if (currentEl && gameState.currentLevel > 1) {
        currentEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 500);
  }

  /* -----------------------------------------------
     SECTION 18: INITIALIZATION
     ----------------------------------------------- */

  // Inject dynamic styles for gamification elements
  injectStyles();

  // Initialize all systems
  initQuizSystem();
  initPracticeCounters();
  initCompleteButtons();
  initHintSystem();
  initChecklist();
  initScrollAnimations();
  initNavigation();
  initMobileMenu();
  initFormulaClicks();
  initResetButton();

  // Apply game state to UI
  updateLevelUI();

  // Scroll to current level
  scrollToCurrentLevel();

  // Expose resetGame globally for console/button access
  window.resetGame = resetGame;
  window.gameState = gameState;

});
