// 建築師法規衝刺刷題系統 - 核心邏輯 v2.5 (110~114年歷屆 400 題 + 條文命題 200 題 + 數字翻牌卡 59 張)
// 錯題、收藏查找用：歷屆真題＋條文命題（條文命題不混入每日順刷、專題與模擬考）
const ALL_QUESTIONS = RAW_QUESTIONS.concat(typeof NLM_QUESTIONS !== "undefined" ? NLM_QUESTIONS : []);

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
    quizMode: "daily", // 'daily', 'nlm', 'mistake', 'category', 'mock', 'mini', 'favorites'
    currentCatId: "",
    seqIndex: 0, // 依年份順序刷題進度指標（114→110）
    nlmSeqIndex: 0, // 條文命題順刷進度指標
    shuffleOptions: false, // 選項隨機洗牌開關
    currentOptMap: { A: "A", B: "B", C: "C", D: "D" }, // 顯示選項 -> 原始選項映射
    hasAnswered: false,
    quizCorrectCount: 0,
    fcIndex: 0,
    fcCategory: "ALL",
    currentCards: [],
    mockTimeLeft: 0,
    mockTimerId: null
  },

  // 取得台灣本地日期字串 (UTC+8)，確保午夜 00:00 準時重置每日進度
  getLocalDateStr() {
    const twTime = new Date(Date.now() + 8 * 3600 * 1000);
    return twTime.toISOString().split("T")[0];
  },

  init() {
    this.loadState();
    this.updateCountdown();
    this.renderDashboard();
    this.bindKeyboard();
    this.renderCategoryList();
    this.initFlashcardCategories();
    this.updateShuffleButton();
  },

  // 1. 考期倒數 (目標: 2026/11/14)
  updateCountdown() {
    const targetDate = new Date("2026-11-14T08:00:00+08:00");
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
        this.state.seqIndex = parsed.seqIndex || 0;
        this.state.nlmSeqIndex = parsed.nlmSeqIndex || 0;
        this.state.shuffleOptions = Boolean(parsed.shuffleOptions);
      }
      const savedFcIdx = localStorage.getItem("ARCH_LAW_LAST_FC_INDEX");
      if (savedFcIdx !== null) {
        this.state.fcIndex = parseInt(savedFcIdx, 10) || 0;
      }
    } catch (e) {
      console.warn("Load state error:", e);
    }

    // 清除題庫已移除題目殘留之錯題與收藏
    const validIds = new Set(ALL_QUESTIONS.map(q => q.id));
    Object.keys(this.state.mistakes).forEach(id => {
      if (!validIds.has(id)) delete this.state.mistakes[id];
    });
    this.state.favorites = (this.state.favorites || []).filter(id => validIds.has(id));

    // 檢查每日重置 (以台灣時間 UTC+8 午夜為準)
    const todayStr = this.getLocalDateStr();
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
        todayAnswered: this.state.todayAnswered,
        seqIndex: this.state.seqIndex,
        nlmSeqIndex: this.state.nlmSeqIndex,
        shuffleOptions: this.state.shuffleOptions
      };
      localStorage.setItem("ARCH_LAW_EXAM_STATE", JSON.stringify(toSave));
    } catch (e) {
      console.warn("Save state error:", e);
    }
  },

  // 3. 儀表板與及格雷達渲染
  renderDashboard() {
    const totalAns = this.state.answeredTotal;
    const totalCorrect = this.state.correctTotal;
    const acc = totalAns > 0 ? (totalCorrect / totalAns) * 100 : 0;
    const estimatedScore = acc.toFixed(1);

    document.getElementById("totalAnsweredCount").innerText = totalAns;
    document.getElementById("overallAccuracy").innerText = acc.toFixed(0) + "%";
    document.getElementById("estimatedScore").innerText = estimatedScore;

    const seqEl = document.getElementById("seqProgressCount");
    if (seqEl) seqEl.innerText = Math.min(this.state.seqIndex, RAW_QUESTIONS.length);
    const nlmEl = document.getElementById("nlmProgressCount");
    const nlmTotal = typeof NLM_QUESTIONS !== "undefined" ? NLM_QUESTIONS.length : 200;
    if (nlmEl) nlmEl.innerText = Math.min(this.state.nlmSeqIndex, nlmTotal);

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
    const todayTarget = this.DAILY_COUNT;
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

  // 依當前模式再刷一輪
  repeatCurrentMode() {
    const mode = this.state.quizMode;
    if (mode === "nlm") return this.startNlmQuiz();
    if (mode === "mistake") return this.startMistakeQuiz();
    if (mode === "favorites") return this.startFavoritesQuiz();
    if (mode === "category" && this.state.currentCatId) return this.startCategoryQuiz(this.state.currentCatId);
    if (mode === "mini") return this.startMiniMock();
    if (mode === "mock") return this.startMockExam();
    return this.startDailyQuiz();
  },

  // 5. 抽題演算法
  DAILY_COUNT: 30,

  // 依年份順序排列（114→110，同年依題號），確保 400 題全數覆蓋不重複
  getSequentialOrder() {
    return [...RAW_QUESTIONS].sort((a, b) => (b.year - a.year) || (a.q_num - b.q_num));
  },

  // 每日 30 題：依年份順序接續上次進度
  startDailyQuiz() {
    this.stopMockTimer();
    this.state.quizMode = "daily";
    this.state.currentIndex = 0;
    this.state.quizCorrectCount = 0;

    const ordered = this.getSequentialOrder();
    if (this.state.seqIndex >= ordered.length) {
      if (!confirm("🎉 400 題歷屆真題已全數刷完一輪！是否從 114 年第 1 題重新開始第二輪？（建議改刷「錯題大屠殺」）")) {
        return;
      }
      this.state.seqIndex = 0;
      this.saveState();
    }
    const start = this.state.seqIndex;
    this.state.currentQuiz = ordered.slice(start, start + this.DAILY_COUNT);

    this.showView("view-quiz");
    this.renderQuestion();
  },

  // 條文命題：每回 20 題，依題號接續上次進度
  startNlmQuiz() {
    this.stopMockTimer();
    const list = typeof NLM_QUESTIONS !== "undefined" ? NLM_QUESTIONS : [];
    if (list.length === 0) {
      alert("條文命題題庫尚未載入！");
      return;
    }
    if (this.state.nlmSeqIndex >= list.length) {
      if (!confirm(`🎉 ${list.length} 題條文命題已全數刷完一輪！是否從第 1 題重新開始？`)) {
        return;
      }
      this.state.nlmSeqIndex = 0;
      this.saveState();
    }
    this.state.quizMode = "nlm";
    this.state.currentIndex = 0;
    this.state.quizCorrectCount = 0;
    const start = this.state.nlmSeqIndex;
    this.state.currentQuiz = list.slice(start, start + 20);

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

    const filtered = ALL_QUESTIONS.filter(q => mistakeIds.includes(q.id));
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

    const filtered = ALL_QUESTIONS.filter(q => favIds.includes(q.id));
    this.state.currentQuiz = filtered.sort(() => 0.5 - Math.random());

    this.showView("view-quiz");
    this.renderQuestion();
  },

  // 十大專題選單
  renderCategoryList() {
    const container = document.getElementById("categoryListContainer");
    if (!container) return;

    const catDescMap = {
      "CAT01": "建築技術規則（設計施工編：防火、避難、特定建築物）",
      "CAT02": "都市更新條例、危老重建條例、都市計畫法",
      "CAT03": "建築法（執照申請、施工勘驗、使用管理、罰則）",
      "CAT04": "政府採購法、營造業法、公共工程管理",
      "CAT05": "建築物無障礙設施設計規範、身心障礙者權益保障",
      "CAT06": "建築師法、專業倫理與簽證責任",
      "CAT07": "國土計畫法、區域計畫法、非都市土地使用管制",
      "CAT08": "綠建築基準、智慧建築、建築能效與基地保水",
      "CAT09": "文化資產保存法、古蹟歷史建築紀念建築修復再利用",
      "CAT10": "山坡地建築管理、公寓大廈管理條例、室內裝修管理"
    };

    const catMap = {};
    RAW_QUESTIONS.forEach(q => {
      if (!catMap[q.cat_id]) {
        catMap[q.cat_id] = {
          name: q.cat_name,
          desc: catDescMap[q.cat_id] || (q.law ? q.law.split("§")[0] : "營建法規"),
          count: 0
        };
      }
      catMap[q.cat_id].count++;
    });

    let html = "";
    Object.keys(catMap).sort().forEach(catId => {
      const item = catMap[catId];
      html += `
        <div class="action-card" style="padding: 12px 16px; margin: 0;" onclick="app.startCategoryQuiz('${catId}')">
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px;">
            <div>
              <b style="color: #60a5fa;">${item.name}</b>
              <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">${item.desc}</div>
            </div>
            <span class="cat-pill" style="flex-shrink: 0;">${item.count} 題</span>
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
    this.state.currentCatId = catId;
    this.state.currentIndex = 0;
    this.state.quizCorrectCount = 0;

    const filtered = RAW_QUESTIONS.filter(q => q.cat_id === catId);
    this.state.currentQuiz = filtered.sort(() => 0.5 - Math.random()).slice(0, 20);

    this.showView("view-quiz");
    this.renderQuestion();
  },

  // 20 題 30 分鐘迷你模考（與正式考試同配速：每題 1.5 分鐘）
  startMiniMock() {
    if (!confirm("即將開始 20 題迷你模考！限時 30 分鐘（正式考試配速每題 1.5 分鐘），錯題優先出題，是否確認開始？")) {
      return;
    }
    this.stopMockTimer();
    this.state.quizMode = "mini";
    this.state.currentIndex = 0;
    this.state.quizCorrectCount = 0;

    const mistakeIds = new Set(Object.keys(this.state.mistakes));
    const mistakeQs = ALL_QUESTIONS.filter(q => mistakeIds.has(q.id)).sort(() => 0.5 - Math.random()).slice(0, 10);
    const pickedIds = new Set(mistakeQs.map(q => q.id));
    const others = RAW_QUESTIONS.filter(q => !pickedIds.has(q.id)).sort(() => 0.5 - Math.random()).slice(0, 20 - mistakeQs.length);
    this.state.currentQuiz = [...mistakeQs, ...others].sort(() => 0.5 - Math.random());

    this.showView("view-quiz");
    this.startMockTimer(30);
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

    const shuffled = [...RAW_QUESTIONS].sort(() => 0.5 - Math.random());
    this.state.currentQuiz = shuffled.slice(0, 80);

    this.showView("view-quiz");
    this.startMockTimer(120);
    this.renderQuestion();
  },

  // 計時器邏輯
  startMockTimer(minutes) {
    this.stopMockTimer();
    this.state.mockTimeLeft = minutes * 60;
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
        alert(`⏰ ${minutes} 分鐘測驗時間到！系統將自動為您交卷結算！`);
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

  // 選項隨機洗牌開關
  toggleOptionShuffle() {
    this.state.shuffleOptions = !this.state.shuffleOptions;
    this.saveState();
    this.updateShuffleButton();
    if (!this.state.hasAnswered && this.state.currentQuiz.length > 0) {
      this.renderQuestion();
    }
  },

  updateShuffleButton() {
    const btn = document.getElementById("btnShuffleOpt");
    if (!btn) return;
    if (this.state.shuffleOptions) {
      btn.innerHTML = "🔀 洗牌: 開";
      btn.style.background = "rgba(56, 189, 248, 0.2)";
      btn.style.color = "#38bdf8";
      btn.style.borderColor = "#38bdf8";
      btn.style.fontWeight = "bold";
    } else {
      btn.innerHTML = "🔀 洗牌: 關";
      btn.style.background = "transparent";
      btn.style.color = "#94a3b8";
      btn.style.borderColor = "#475569";
      btn.style.fontWeight = "normal";
    }
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

  // HTML 跳脫輔助
  escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  },

  // 6. 渲染當前題目
  renderQuestion() {
    this.state.hasAnswered = false;
    const q = this.state.currentQuiz[this.state.currentIndex];
    const total = this.state.currentQuiz.length;
    const curr = this.state.currentIndex + 1;

    document.getElementById("quizProgressNum").innerText = `${curr} / ${total}`;
    document.getElementById("quizCatTag").innerText = q.cat_name || "營建法規";

    let sourceLabel = q.year ? `${q.year}年 第${q.q_num}題` : `第${q.q_num}題`;
    if (q.source_type) {
      sourceLabel = `[${q.source_type}] ${sourceLabel}`;
    }
    if (q.answer === '#') {
      sourceLabel += ` [考選部一律給分]`;
    }
    document.getElementById("quizYearTag").innerText = sourceLabel;

    const hotTag = document.getElementById("quizHotTag");
    hotTag.style.display = q.is_hot ? "inline-block" : "none";

    // 模擬考與迷你模考計時器 Badge 控制 (修正 mini 模式計時器隱藏問題)
    const timerBadge = document.getElementById("mockTimerBadge");
    if (timerBadge) {
      timerBadge.style.display = (this.state.quizMode === "mock" || this.state.quizMode === "mini") ? "inline-flex" : "none";
    }

    document.getElementById("quizQuestionText").innerText = q.stem;

    this.updateFavoriteButton();
    this.updateShuffleButton();

    // 建立選項映射 (支援選項隨機洗牌)
    const keys = ["A", "B", "C", "D"];
    let origKeys = [...keys];
    if (this.state.shuffleOptions) {
      for (let i = origKeys.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [origKeys[i], origKeys[j]] = [origKeys[j], origKeys[i]];
      }
    }
    this.state.currentOptMap = {};
    keys.forEach((dispK, idx) => {
      this.state.currentOptMap[dispK] = origKeys[idx];
    });

    // 選項渲染
    const optList = document.getElementById("quizOptionsList");
    optList.innerHTML = "";

    keys.forEach((dispK) => {
      const origK = this.state.currentOptMap[dispK];
      const text = (q.options && q.options[origK]) ? q.options[origK] : "";
      const btn = document.createElement("button");
      btn.className = "option-btn";
      btn.id = `optBtn_${dispK}`;
      btn.dataset.origKey = origK;
      btn.onclick = () => this.handleAnswer(dispK);
      btn.innerHTML = `
        <span class="opt-letter">${dispK}</span>
        <span class="opt-text-body" style="flex: 1;">${this.escapeHtml(text)}</span>
      `;
      optList.appendChild(btn);
    });

    // 隱藏解析卡與下一題
    const expCard = document.getElementById("quizExplanationCard");
    expCard.classList.remove("show");
    document.getElementById("btnNextQuestion").disabled = true;

    // 預設解析內容 (三層結構化排版：核心記憶 / 詳解判析 / 法條原文)
    document.getElementById("expLawRef").innerText = q.law || "相關法規綜合條文";

    let rawExp = q.explanation ? q.explanation : `正確解答為 (${q.answer})。`;
    if (q.answer === '#') {
      rawExp = q.explanation || "【考選部官方公告】：本題考選部官方公告全體一律給分（代號 #）。因法規適用爭議或題幹選項疑義，全部選項均核計分數。";
    }

    let detailPart = rawExp;
    let quotePart = "";
    if (rawExp.includes("【條文原句】")) {
      const parts = rawExp.split("【條文原句】");
      detailPart = parts[0].trim();
      quotePart = parts.slice(1).join("【條文原句】").trim();
    }

    let expHtml = "";
    if (q.analysis_key) {
      expHtml += `<div class="exp-key-box"><b>💡 【核心記憶 / 秒殺判準】</b>：${this.escapeHtml(q.analysis_key)}</div>`;
    }
    expHtml += `<div class="exp-detail-box"><b>📝 【詳解與選項判析】</b>：
${this.escapeHtml(detailPart)}</div>`;
    if (quotePart) {
      expHtml += `<div class="exp-quote-box"><b>📜 【法條原文對照】</b>：
${this.escapeHtml(quotePart)}</div>`;
    }
    document.getElementById("expKeyText").innerHTML = expHtml;

    let trapPhrase = `注意題幹是問「何者錯誤」還是「何者正確」；小心『得』與『應』之法律效果差異。`;
    if (q.answer === '#') {
      trapPhrase = `⚠️ <b>考選部公告給分</b>：本題為歷史爭議題，作答任一選項均核計答對分數。`;
    } else if (q.is_hot) {
      trapPhrase = `🔥 <b>最新修法重點</b>：本考點為近年修法政策焦點，請依現行法規最新規定為準。`;
    }
    document.getElementById("expTrapText").innerHTML = trapPhrase;
  },

  // 7. 作答反饋判定
  handleAnswer(selectedDispKey) {
    if (this.state.hasAnswered) return;
    this.state.hasAnswered = true;

    const q = this.state.currentQuiz[this.state.currentIndex];
    const selectedOrigKey = (this.state.currentOptMap && this.state.currentOptMap[selectedDispKey]) || selectedDispKey;
    const isAllPass = (q.answer === '#');
    const acceptedOrig = (q.accept || [q.answer]).map(k => k.toUpperCase());
    const isCorrect = isAllPass || acceptedOrig.includes(selectedOrigKey.toUpperCase());

    // 更新累積統計
    if (this.state.quizMode === "daily") this.state.seqIndex++;
    if (this.state.quizMode === "nlm") this.state.nlmSeqIndex++;
    this.state.answeredTotal++;
    this.state.todayAnswered++;
    if (isCorrect) {
      this.state.correctTotal++;
      this.state.quizCorrectCount++;
    }

    // 找出所有對應正解的顯示按鈕
    const keys = ["A", "B", "C", "D"];
    const acceptedDispKeys = keys.filter(dk => acceptedOrig.includes((this.state.currentOptMap[dk] || dk).toUpperCase()));
    const selectedBtn = document.getElementById(`optBtn_${selectedDispKey}`);

    if (isAllPass) {
      if (selectedBtn) selectedBtn.classList.add("correct");
    } else if (isCorrect) {
      if (selectedBtn) selectedBtn.classList.add("correct");
      acceptedDispKeys.forEach(dk => {
        const b = document.getElementById(`optBtn_${dk}`);
        if (b) b.classList.add("correct");
      });
      if (this.state.mistakes[q.id]) {
        this.state.mistakes[q.id].streak = (this.state.mistakes[q.id].streak || 0) + 1;
        if (this.state.mistakes[q.id].streak >= 2) {
          delete this.state.mistakes[q.id];
        }
      }
    } else {
      if (selectedBtn) selectedBtn.classList.add("wrong");
      acceptedDispKeys.forEach(dk => {
        const b = document.getElementById(`optBtn_${dk}`);
        if (b) b.classList.add("correct");
      });
      if (!this.state.mistakes[q.id]) {
        this.state.mistakes[q.id] = { streak: 0, count: 1 };
      } else {
        this.state.mistakes[q.id].streak = 0;
        this.state.mistakes[q.id].count++;
      }
    }

    // 若啟用選項洗牌，作答後顯示 [原X] 標記，方便對照詳解中的 (A)(B)(C)(D)
    if (this.state.shuffleOptions) {
      keys.forEach(dk => {
        const origK = this.state.currentOptMap[dk];
        const btn = document.getElementById(`optBtn_${dk}`);
        if (btn) {
          const textBody = btn.querySelector(".opt-text-body");
          if (textBody && !textBody.querySelector(".orig-opt-tag")) {
            textBody.innerHTML = `<span class="orig-opt-tag">原${origK}</span>` + textBody.innerHTML;
          }
        }
      });
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

  // 10. 數字翻牌卡邏輯 (支援進度記憶 + 分類篩選)
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
          this.toggleFavorite();
        }
      } else if (activeView.id === "view-flashcards") {
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
      seqIndex: this.state.seqIndex,
      nlmSeqIndex: this.state.nlmSeqIndex,
      shuffleOptions: this.state.shuffleOptions,
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
      this.state.seqIndex = parsed.seqIndex || 0;
      this.state.nlmSeqIndex = parsed.nlmSeqIndex || 0;
      if (parsed.shuffleOptions !== undefined) {
        this.state.shuffleOptions = Boolean(parsed.shuffleOptions);
      }
      if (parsed.lastFcIndex !== undefined) {
        this.state.fcIndex = parsed.lastFcIndex;
        localStorage.setItem("ARCH_LAW_LAST_FC_INDEX", parsed.lastFcIndex);
      }
      this.saveState();
      this.renderDashboard();
      this.updateShuffleButton();
      this.closeSyncModal();
      alert("🎉 進度同步還原成功！所有答題、收藏與錯題紀錄已更新！");
    } catch (e) {
      alert("❌ 代碼格式不正確，請確認完整複製！");
    }
  },

  // 13. 強制清空快取更新版本
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
