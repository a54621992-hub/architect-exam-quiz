// 建築師法規 40天衝刺刷題系統 - 核心邏輯 (800題 + 60張記憶翻牌卡)
const app = {
  // 狀態
  state: {
    answeredTotal: 0,
    correctTotal: 0,
    todayAnswered: 0,
    lastDate: "",
    mistakes: {}, // { [qId]: { streak: 0, count: 1 } }
    favorites: [], // [qId]
    currentQuiz: [],
    currentIndex: 0,
    quizMode: "daily", // 'daily', 'mistake', 'category', 'mock', 'favorites'
    hasAnswered: false,
    quizCorrectCount: 0,
    fcIndex: 0,
    fcCategory: "ALL",
    currentCards: [],
    mockTimeLeft: 0,
    mockTimerId: null
  },

  init() {
    this.loadState();
    this.updateCountdown();
    this.renderDashboard();
    this.bindKeyboard();
    this.renderCategoryList();
    this.initFlashcardCategories();
  },

  // 1. 考期倒數 (目標: 2026/11/14)
  updateCountdown() {
    const targetDate = new Date("2026-11-14T08:00:00");
    const today = new Date();
    const diffTime = targetDate - today;
    const diffDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    const badge = document.getElementById("countdownBadge");
    if (badge) {
      badge.innerHTML = `⏳ 剩 <b>${diffDays}</b> 天`;
    }
  },

  // 2. 本地儲存與載入
  loadState() {
    try {
      const saved = localStorage.getItem("ARCH_LAW_EXAM_STATE");
      if (saved) {
        const parsed = JSON.parse(saved);
        this.state.answeredTotal = parsed.answeredTotal || 0;
        this.state.correctTotal = parsed.correctTotal || 0;
        this.state.mistakes = parsed.mistakes || {};
        this.state.favorites = parsed.favorites || [];
        this.state.lastDate = parsed.lastDate || "";
        this.state.todayAnswered = parsed.todayAnswered || 0;
      }
      const savedFcIdx = localStorage.getItem("ARCH_LAW_LAST_FC_INDEX");
      if (savedFcIdx !== null) {
        this.state.fcIndex = parseInt(savedFcIdx, 10) || 0;
      }
    } catch (e) {
      console.warn("Load state error:", e);
    }

    // 檢查每日重置
    const todayStr = new Date().toISOString().split("T")[0];
    if (this.state.lastDate !== todayStr) {
      this.state.todayAnswered = 0;
      this.state.lastDate = todayStr;
      this.saveState();
    }
  },

  saveState() {
    try {
      const toSave = {
        answeredTotal: this.state.answeredTotal,
        correctTotal: this.state.correctTotal,
        mistakes: this.state.mistakes,
        favorites: this.state.favorites,
        lastDate: this.state.lastDate,
        todayAnswered: this.state.todayAnswered
      };
      localStorage.setItem("ARCH_LAW_EXAM_STATE", JSON.stringify(toSave));
    } catch (e) {
      console.warn("Save state error:", e);
    }
  },

  // 3. 儀表板與及格雷達渲染 (800 題規模)
  renderDashboard() {
    const totalAns = this.state.answeredTotal;
    const totalCorrect = this.state.correctTotal;
    const acc = totalAns > 0 ? (totalCorrect / totalAns) * 100 : 0;
    const estimatedScore = acc.toFixed(1);

    document.getElementById("totalAnsweredCount").innerText = totalAns;
    document.getElementById("overallAccuracy").innerText = acc.toFixed(0) + "%";
    document.getElementById("estimatedScore").innerText = estimatedScore;

    const progressFill = document.getElementById("scoreProgressBar");
    const indicator = document.getElementById("passStatusIndicator");

    // 以 60 分為基準
    const percentBar = Math.min(100, (acc / 100) * 100);
    progressFill.style.width = percentBar + "%";

    if (acc >= 60 && totalAns >= 20) {
      indicator.className = "pass-indicator pass";
      indicator.innerText = "🏆 穩健及格 (安全)";
      progressFill.style.background = "linear-gradient(90deg, #10b981, #059669)";
    } else {
      indicator.className = "pass-indicator risk";
      const gap = (60 - acc).toFixed(1);
      indicator.innerText = totalAns < 20 ? "初始累積中" : `衝刺中 (距及格差 ${gap}分)`;
      progressFill.style.background = "linear-gradient(90deg, #3b82f6, #f59e0b)";
    }

    // 今日進度
    const todayTarget = 20;
    const todayPercent = Math.min(100, (this.state.todayAnswered / todayTarget) * 100);
    const todayTaskEl = document.getElementById("todayTaskText");
    if (this.state.todayAnswered >= todayTarget) {
      todayTaskEl.innerText = `${this.state.todayAnswered} / ${todayTarget} 題 (已達標 🎉)`;
      todayTaskEl.style.color = "#10b981";
    } else {
      todayTaskEl.innerText = `${this.state.todayAnswered} / ${todayTarget} 題`;
      todayTaskEl.style.color = "#38bdf8";
    }
    document.getElementById("todayProgressBar").style.width = todayPercent + "%";

    // 錯題計數
    const mistakeCount = Object.keys(this.state.mistakes).length;
    document.getElementById("mistakeBadgeCount").innerText = mistakeCount;

    // 收藏計數
    const favCount = (this.state.favorites || []).length;
    const favEl = document.getElementById("favoritesBadgeCount");
    if (favEl) favEl.innerText = favCount;
  },

  // 4. 視圖導航
  showView(viewId) {
    document.querySelectorAll(".view-section").forEach(sec => {
      sec.classList.remove("active");
    });
    const target = document.getElementById(viewId);
    if (target) {
      target.classList.add("active");
      window.scrollTo(0, 0);
    }
  },

  showDashboard() {
    this.stopMockTimer();
    this.renderDashboard();
    this.showView("view-dashboard");
  },

  // 5. 抽題演算法 (800 題規模)
  // 每日 20 題速刷
  startDailyQuiz() {
    this.stopMockTimer();
    this.state.quizMode = "daily";
    this.state.currentIndex = 0;
    this.state.quizCorrectCount = 0;

    // 從 800 題隨機抽 20 題 (兼顧歷屆與新增題目)
    const shuffled = [...RAW_QUESTIONS].sort(() => 0.5 - Math.random());
    this.state.currentQuiz = shuffled.slice(0, 20);

    this.showView("view-quiz");
    this.renderQuestion();
  },

  // 錯題大屠殺
  startMistakeQuiz() {
    this.stopMockTimer();
    const mistakeIds = Object.keys(this.state.mistakes);
    if (mistakeIds.length === 0) {
      alert("太棒了！目前錯題本空空如也，沒有待消滅的錯題！");
      return;
    }

    this.state.quizMode = "mistake";
    this.state.currentIndex = 0;
    this.state.quizCorrectCount = 0;

    // 篩選錯題
    const filtered = RAW_QUESTIONS.filter(q => mistakeIds.includes(q.id));
    this.state.currentQuiz = filtered.sort(() => 0.5 - Math.random()).slice(0, 20);

    this.showView("view-quiz");
    this.renderQuestion();
  },

  // 重點標記收藏刷題
  startFavoritesQuiz() {
    this.stopMockTimer();
    const favIds = this.state.favorites || [];
    if (favIds.length === 0) {
      alert("目前尚無標記收藏的題目！可在平時刷題時點擊右上角「☆ 收藏」加入！");
      return;
    }

    this.state.quizMode = "favorites";
    this.state.currentIndex = 0;
    this.state.quizCorrectCount = 0;

    // 篩選收藏題目
    const filtered = RAW_QUESTIONS.filter(q => favIds.includes(q.id));
    this.state.currentQuiz = filtered.sort(() => 0.5 - Math.random());

    this.showView("view-quiz");
    this.renderQuestion();
  },

  // 十大專題選單
  renderCategoryList() {
    const container = document.getElementById("categoryListContainer");
    if (!container) return;

    // 統計各考點題目數
    const catMap = {};
    RAW_QUESTIONS.forEach(q => {
      if (!catMap[q.cat_id]) {
        catMap[q.cat_id] = { name: q.cat_name, law: q.law, count: 0 };
      }
      catMap[q.cat_id].count++;
    });

    let html = "";
    Object.keys(catMap).sort().forEach(catId => {
      const item = catMap[catId];
      html += `
        <div class="action-card" style="padding: 12px 16px; margin: 0;" onclick="app.startCategoryQuiz('${catId}')">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <b style="color: #60a5fa;">${item.name}</b>
              <div style="font-size: 0.8rem; color: var(--text-muted);">${item.law}</div>
            </div>
            <span class="cat-pill">${item.count} 題</span>
          </div>
        </div>
      `;
    });
    container.innerHTML = html;
  },

  showCategoryModal() {
    document.getElementById("categoryModal").classList.add("active");
  },

  closeCategoryModal() {
    document.getElementById("categoryModal").classList.remove("active");
  },

  startCategoryQuiz(catId) {
    this.stopMockTimer();
    this.closeCategoryModal();
    this.state.quizMode = "category";
    this.state.currentIndex = 0;
    this.state.quizCorrectCount = 0;

    const filtered = RAW_QUESTIONS.filter(q => q.cat_id === catId);
    this.state.currentQuiz = filtered.sort(() => 0.5 - Math.random()).slice(0, 20);

    this.showView("view-quiz");
    this.renderQuestion();
  },

  // 80 題全真模擬考 (120 分鐘限時)
  startMockExam() {
    if (!confirm("即將開始 80 題全真模擬考！測驗時間共 120 分鐘，是否確認開始？")) {
      return;
    }
    this.stopMockTimer();
    this.state.quizMode = "mock";
    this.state.currentIndex = 0;
    this.state.quizCorrectCount = 0;

    // 抽 80 題
    const shuffled = [...RAW_QUESTIONS].sort(() => 0.5 - Math.random());
    this.state.currentQuiz = shuffled.slice(0, 80);

    this.showView("view-quiz");
    this.startMockTimer();
    this.renderQuestion();
  },

  // 計時器邏輯
  startMockTimer() {
    this.stopMockTimer();
    // 120 分鐘 = 7200 秒
    this.state.mockTimeLeft = 120 * 60;
    const badge = document.getElementById("mockTimerBadge");
    if (badge) {
      badge.style.display = "inline-flex";
      badge.innerHTML = `⏱️ ${this.formatMockTime(this.state.mockTimeLeft)}`;
    }
    this.state.mockTimerId = setInterval(() => {
      this.state.mockTimeLeft--;
      if (this.state.mockTimeLeft <= 0) {
        this.stopMockTimer();
        if (badge) badge.innerHTML = `⏱️ 00:00`;
        alert("⏰ 120 分鐘測驗時間到！系統將自動為您交卷結算！");
        this.finishQuiz();
      } else {
        if (badge) {
          badge.innerHTML = `⏱️ ${this.formatMockTime(this.state.mockTimeLeft)}`;
        }
      }
    }, 1000);
  },

  stopMockTimer() {
    if (this.state.mockTimerId) {
      clearInterval(this.state.mockTimerId);
      this.state.mockTimerId = null;
    }
    const badge = document.getElementById("mockTimerBadge");
    if (badge) {
      badge.style.display = "none";
    }
  },

  formatMockTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  },

  // 收藏功能邏輯
  toggleFavorite() {
    const q = this.state.currentQuiz[this.state.currentIndex];
    if (!q) return;
    if (!this.state.favorites) this.state.favorites = [];
    const idx = this.state.favorites.indexOf(q.id);
    if (idx >= 0) {
      this.state.favorites.splice(idx, 1);
    } else {
      this.state.favorites.push(q.id);
    }
    this.saveState();
    this.updateFavoriteButton();
    const favEl = document.getElementById("favoritesBadgeCount");
    if (favEl) favEl.innerText = this.state.favorites.length;
  },

  updateFavoriteButton() {
    const btn = document.getElementById("btnBookmark");
    if (!btn) return;
    const q = this.state.currentQuiz[this.state.currentIndex];
    if (!q) return;
    const isFav = (this.state.favorites || []).includes(q.id);
    if (isFav) {
      btn.innerHTML = "★ 已收藏";
      btn.style.background = "#fbbf24";
      btn.style.color = "#0f172a";
      btn.style.borderColor = "#fbbf24";
      btn.style.fontWeight = "bold";
    } else {
      btn.innerHTML = "☆ 收藏";
      btn.style.background = "transparent";
      btn.style.color = "#fbbf24";
      btn.style.borderColor = "#fbbf24";
      btn.style.fontWeight = "normal";
    }
  },

  // 6. 渲染當前題目
  renderQuestion() {
    this.state.hasAnswered = false;
    const q = this.state.currentQuiz[this.state.currentIndex];
    const total = this.state.currentQuiz.length;
    const curr = this.state.currentIndex + 1;

    document.getElementById("quizProgressNum").innerText = `${curr} / ${total}`;
    document.getElementById("quizCatTag").innerText = q.cat_name || "營建法規";
    
    // 來源與年份標籤
    let sourceLabel = `${q.year}年 第${q.q_num}題`;
    if (q.source_type) {
      sourceLabel = `[${q.source_type}] ${sourceLabel}`;
    }
    if (q.answer === '#') {
      sourceLabel += ` [考選部一律給分]`;
    }
    document.getElementById("quizYearTag").innerText = sourceLabel;

    const hotTag = document.getElementById("quizHotTag");
    hotTag.style.display = q.is_hot ? "inline-block" : "none";

    // 模擬考計時器 Badge 控制
    const timerBadge = document.getElementById("mockTimerBadge");
    if (timerBadge) {
      timerBadge.style.display = this.state.quizMode === "mock" ? "inline-flex" : "none";
    }

    document.getElementById("quizQuestionText").innerText = q.stem;

    // 更新收藏按鈕狀態 (防禦性呼叫)
    if (typeof this.updateFavoriteButton === "function") {
      this.updateFavoriteButton();
    }

    // 選項渲染
    const optList = document.getElementById("quizOptionsList");
    optList.innerHTML = "";

    const keys = ["A", "B", "C", "D"];
    keys.forEach((k) => {
      const text = (q.options && q.options[k]) ? q.options[k] : "";
      const btn = document.createElement("button");
      btn.className = "option-btn";
      btn.id = `optBtn_${k}`;
      btn.onclick = () => this.handleAnswer(k);
      btn.innerHTML = `
        <span class="opt-letter">${k}</span>
        <span style="flex: 1;">${text}</span>
      `;
      optList.appendChild(btn);
    });

    // 隱藏解析卡與下一題
    const expCard = document.getElementById("quizExplanationCard");
    expCard.classList.remove("show");
    document.getElementById("btnNextQuestion").disabled = true;

    // 預設解析內容
    document.getElementById("expLawRef").innerText = q.law || "相關法規綜合條文";
    
    // 秒殺關鍵字與解析
    let keyPhrase = q.explanation ? q.explanation : `正確解答為 (${q.answer})。`;
    if (q.answer === '#') {
      keyPhrase = q.explanation || "<b>【考選部官方公告】</b>：本題考選部官方公告全體一律給分（代號 #）。因法規適用爭議或題幹選項疑義，全部選項均核計分數。";
    }
    if (q.analysis_key) {
      keyPhrase = `<div style="margin-bottom: 6px;"><b style="color: #fbbf24;">【核心記憶 / 正確數值】</b>：<span style="color: #fef08a;">${q.analysis_key}</span></div>${keyPhrase}`;
    }
    document.getElementById("expKeyText").innerHTML = keyPhrase;

    let trapPhrase = `注意題幹是問「何者錯誤」還是「何者正確」；小心『得』與『應』之法律效果差異。`;
    if (q.answer === '#') {
      trapPhrase = `⚠️ <b>考選部公告給分</b>：本題為歷史爭議題，作答任一選項均核計答對分數。`;
    } else if (q.is_hot) {
      trapPhrase = `🔥 <b>最新修法重點</b>：本考點為近年修法政策焦點，請依現行法規最新規定為準。`;
    }
    document.getElementById("expTrapText").innerHTML = trapPhrase;
  },

  // 7. 作答反饋判定
  handleAnswer(selectedKey) {
    if (this.state.hasAnswered) return;
    this.state.hasAnswered = true;

    const q = this.state.currentQuiz[this.state.currentIndex];
    const isAllPass = (q.answer === '#');
    const isCorrect = isAllPass || (selectedKey.toUpperCase() === q.answer.toUpperCase());

    // 更新累積統計
    this.state.answeredTotal++;
    this.state.todayAnswered++;
    if (isCorrect) {
      this.state.correctTotal++;
      this.state.quizCorrectCount++;
    }

    // 更新按鈕樣式
    const selectedBtn = document.getElementById(`optBtn_${selectedKey}`);
    const correctBtn = q.answer !== '#' ? document.getElementById(`optBtn_${q.answer}`) : null;

    if (isAllPass) {
      if (selectedBtn) selectedBtn.classList.add("correct");
    } else if (isCorrect) {
      if (selectedBtn) selectedBtn.classList.add("correct");
      // 若在錯題本中答對，增加 streak
      if (this.state.mistakes[q.id]) {
        this.state.mistakes[q.id].streak = (this.state.mistakes[q.id].streak || 0) + 1;
        // 連對 2 次消滅出庫
        if (this.state.mistakes[q.id].streak >= 2) {
          delete this.state.mistakes[q.id];
        }
      }
    } else {
      if (selectedBtn) selectedBtn.classList.add("wrong");
      if (correctBtn) correctBtn.classList.add("correct");
      // 記錄錯題
      if (!this.state.mistakes[q.id]) {
        this.state.mistakes[q.id] = { streak: 0, count: 1 };
      } else {
        this.state.mistakes[q.id].streak = 0;
        this.state.mistakes[q.id].count++;
      }
    }

    // 禁用所有按鈕點擊，未選中的按鈕半透明
    const optButtons = document.querySelectorAll(".option-btn");
    optButtons.forEach(btn => {
      btn.style.pointerEvents = "none";
      if (!btn.classList.contains("correct") && !btn.classList.contains("wrong")) {
        btn.style.opacity = "0.55";
      }
    });

    this.saveState();

    // 展開解析卡片
    document.getElementById("quizExplanationCard").classList.add("show");
    document.getElementById("btnNextQuestion").disabled = false;
  },

  // 8. 下一題
  nextQuestion() {
    this.state.currentIndex++;
    if (this.state.currentIndex < this.state.currentQuiz.length) {
      this.renderQuestion();
    } else {
      this.finishQuiz();
    }
  },

  // 9. 結算測驗
  finishQuiz() {
    this.stopMockTimer();
    const total = this.state.currentQuiz.length;
    const correct = this.state.quizCorrectCount;
    const acc = total > 0 ? (correct / total) * 100 : 0;
    const score = (acc).toFixed(1);

    document.getElementById("resultScore").innerText = score;
    document.getElementById("resultAccuracy").innerText = acc.toFixed(0) + "%";

    const emoji = document.getElementById("resultEmoji");
    const title = document.getElementById("resultTitle");
    const subtitle = document.getElementById("resultSubtitle");

    if (acc >= 60) {
      emoji.innerText = "🏆";
      title.innerText = "及格通過！太優秀了！";
      subtitle.innerText = `答對 ${correct} 題 / 共 ${total} 題，已達 60 分保底門檻！`;
    } else {
      emoji.innerText = "💪";
      title.innerText = "完成本輪練習！繼續衝刺！";
      subtitle.innerText = `答對 ${correct} 題 / 共 ${total} 題，再接再厲消滅錯題！`;
    }

    this.showView("view-result");
  },

  // 10. 數字翻牌卡邏輯 (支援 60 張卡片 + 進度記憶 + 分類篩選)
  initFlashcardCategories() {
    const pillContainer = document.getElementById("fcCategoryPills");
    if (!pillContainer) return;

    const cats = ["ALL", "技術規則", "無障礙", "都更危老", "建築法", "採購營造", "建築師法", "國土計畫"];
    let html = "";
    cats.forEach(c => {
      const activeClass = c === this.state.fcCategory ? "active" : "";
      const label = c === "ALL" ? "全部 (記憶進度)" : c;
      html += `<button class="fc-pill-btn ${activeClass}" onclick="app.setFcCategory('${c}')">${label}</button>`;
    });
    pillContainer.innerHTML = html;
  },

  setFcCategory(cat) {
    this.state.fcCategory = cat;
    this.initFlashcardCategories();
    this.applyFlashcardFilter();
  },

  applyFlashcardFilter() {
    if (this.state.fcCategory === "ALL") {
      this.state.currentCards = [...FLASHCARDS];
      // 讀取上次記憶進度
      const savedIdx = localStorage.getItem("ARCH_LAW_LAST_FC_INDEX");
      let idx = savedIdx !== null ? parseInt(savedIdx, 10) : 0;
      if (idx >= this.state.currentCards.length || idx < 0) idx = 0;
      this.state.fcIndex = idx;
    } else {
      this.state.currentCards = FLASHCARDS.filter(c => c.cat === this.state.fcCategory);
      this.state.fcIndex = 0;
    }
    this.renderFlashcard();
  },

  showFlashcards() {
    this.stopMockTimer();
    this.applyFlashcardFilter();
    this.showView("view-flashcards");
  },

  renderFlashcard() {
    if (!this.state.currentCards || this.state.currentCards.length === 0) return;
    const card = this.state.currentCards[this.state.fcIndex];
    const total = this.state.currentCards.length;
    const curr = this.state.fcIndex + 1;

    document.getElementById("flashcardCounter").innerText = `${curr} / ${total}`;
    document.getElementById("fcCatTag").innerText = card.cat + " · " + card.topic;
    document.getElementById("fcLawTag").innerText = card.law;
    document.getElementById("fcQuestion").innerText = card.front;
    document.getElementById("fcAnswer").innerText = card.back;
    document.getElementById("fcTrap").innerText = "⚠️ " + card.trap;

    const el = document.getElementById("flashcardElement");
    el.classList.remove("flipped");

    // 若為全部模式，記憶當前進度
    if (this.state.fcCategory === "ALL") {
      localStorage.setItem("ARCH_LAW_LAST_FC_INDEX", this.state.fcIndex);
    }
  },

  flipFlashcard() {
    const el = document.getElementById("flashcardElement");
    el.classList.toggle("flipped");
  },

  nextFlashcard() {
    if (this.state.fcIndex < this.state.currentCards.length - 1) {
      this.state.fcIndex++;
    } else {
      this.state.fcIndex = 0;
    }
    this.renderFlashcard();
  },

  prevFlashcard() {
    if (this.state.fcIndex > 0) {
      this.state.fcIndex--;
    } else {
      this.state.fcIndex = this.state.currentCards.length - 1;
    }
    this.renderFlashcard();
  },

  // 11. 全鍵盤盲打支援
  bindKeyboard() {
    window.addEventListener("keydown", e => {
      const activeView = document.querySelector(".view-section.active");
      if (!activeView) return;

      // 刷題視圖快捷鍵
      if (activeView.id === "view-quiz") {
        const key = e.key.toUpperCase();
        if (["1", "2", "3", "4", "A", "B", "C", "D"].includes(key)) {
          let optKey = key;
          if (key === "1") optKey = "A";
          if (key === "2") optKey = "B";
          if (key === "3") optKey = "C";
          if (key === "4") optKey = "D";
          this.handleAnswer(optKey);
        } else if (e.code === "Space") {
          e.preventDefault();
          const nextBtn = document.getElementById("btnNextQuestion");
          if (nextBtn && !nextBtn.disabled) {
            this.nextQuestion();
          }
        } else if (key === "S" || key === "F") {
          // 快捷鍵 S 或 F 收藏/取消收藏
          this.toggleFavorite();
        }
      }
      
      // 翻牌卡視圖快捷鍵
      else if (activeView.id === "view-flashcards") {
        if (e.code === "Space" || e.code === "Enter") {
          e.preventDefault();
          this.flipFlashcard();
        } else if (e.code === "ArrowRight" || e.key.toUpperCase() === "D") {
          e.preventDefault();
          this.nextFlashcard();
        } else if (e.code === "ArrowLeft" || e.key.toUpperCase() === "A") {
          e.preventDefault();
          this.prevFlashcard();
        }
      }
    });
  },

  // 12. 跨裝置進度無縫同步
  openSyncModal() {
    document.getElementById("syncModal").classList.add("active");
  },

  closeSyncModal() {
    document.getElementById("syncModal").classList.remove("active");
  },

  exportSyncCode() {
    const data = {
      answeredTotal: this.state.answeredTotal,
      correctTotal: this.state.correctTotal,
      mistakes: this.state.mistakes,
      favorites: this.state.favorites || [],
      lastDate: this.state.lastDate,
      todayAnswered: this.state.todayAnswered,
      lastFcIndex: this.state.fcIndex,
      timestamp: Date.now()
    };
    const code = btoa(encodeURIComponent(JSON.stringify(data)));
    const textarea = document.getElementById("syncCodeArea");
    textarea.value = code;
    textarea.select();
    navigator.clipboard.writeText(code).then(() => {
      alert("✅ 已成功複製進度代碼！打開手機進入本頁點『同步』並貼上即可！");
    }).catch(() => {
      alert("請手動選取文字並複製！");
    });
  },

  importSyncCode() {
    const code = document.getElementById("syncCodeArea").value.trim();
    if (!code) {
      alert("請先在文字框貼上代碼！");
      return;
    }
    try {
      const jsonStr = decodeURIComponent(atob(code));
      const parsed = JSON.parse(jsonStr);
      this.state.answeredTotal = parsed.answeredTotal || 0;
      this.state.correctTotal = parsed.correctTotal || 0;
      this.state.mistakes = parsed.mistakes || {};
      this.state.favorites = parsed.favorites || [];
      this.state.lastDate = parsed.lastDate || "";
      this.state.todayAnswered = parsed.todayAnswered || 0;
      if (parsed.lastFcIndex !== undefined) {
        this.state.fcIndex = parsed.lastFcIndex;
        localStorage.setItem("ARCH_LAW_LAST_FC_INDEX", parsed.lastFcIndex);
      }
      this.saveState();
      this.renderDashboard();
      this.closeSyncModal();
      alert("🎉 進度同步還原成功！所有答題、收藏與錯題紀錄已更新！");
    } catch (e) {
      alert("❌ 代碼格式不正確，請確認完整複製！");
    }
  },

  // 14. 強制清空快取更新版本
  forceRefresh() {
    if (!confirm("確定要強制檢查並更新至最新題庫與小卡版本嗎？（您的答題紀錄將妥善保留）")) {
      return;
    }
    const promises = [];
    if ('serviceWorker' in navigator) {
      promises.push(
        navigator.serviceWorker.getRegistrations().then(regs => {
          return Promise.all(regs.map(r => r.unregister()));
        })
      );
    }
    if ('caches' in window) {
      promises.push(
        caches.keys().then(keys => {
          return Promise.all(keys.map(k => caches.delete(k)));
        })
      );
    }
    Promise.all(promises).then(() => {
      window.location.reload(true);
    }).catch(() => {
      window.location.reload(true);
    });
  }
};

// 啟動應用
window.addEventListener("DOMContentLoaded", () => {
  app.init();
});
