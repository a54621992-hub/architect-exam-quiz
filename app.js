// 建築師法規 40天衝刺刷題系統 - 核心邏輯
const app = {
  // 狀態
  state: {
    answeredTotal: 0,
    correctTotal: 0,
    todayAnswered: 0,
    lastDate: "",
    mistakes: {}, // { [qId]: { streak: 0, count: 1 } }
    currentQuiz: [],
    currentIndex: 0,
    quizMode: "daily", // 'daily', 'mistake', 'category', 'mock'
    hasAnswered: false,
    quizCorrectCount: 0,
    fcIndex: 0
  },

  init() {
    this.loadState();
    this.updateCountdown();
    this.renderDashboard();
    this.bindKeyboard();
    this.renderCategoryList();
  },

  // 1. 考期倒數 (目標: 2026/11/14)
  updateCountdown() {
    const targetDate = new Date("2026-11-14T08:00:00");
    const today = new Date();
    const diffTime = targetDate - today;
    const diffDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    const badge = document.getElementById("countdownBadge");
    if (badge) {
      badge.innerHTML = `⏳ 距考期剩 <b>${diffDays}</b> 天`;
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
        this.state.lastDate = parsed.lastDate || "";
        this.state.todayAnswered = parsed.todayAnswered || 0;
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
        lastDate: this.state.lastDate,
        todayAnswered: this.state.todayAnswered
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
    document.getElementById("todayTaskText").innerText = `${this.state.todayAnswered} / ${todayTarget} 題`;
    document.getElementById("todayProgressBar").style.width = todayPercent + "%";

    // 錯題計數
    const mistakeCount = Object.keys(this.state.mistakes).length;
    document.getElementById("mistakeBadgeCount").innerText = mistakeCount;
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
    this.renderDashboard();
    this.showView("view-dashboard");
  },

  // 5. 抽題演算法
  // 每日 20 題速刷
  startDailyQuiz() {
    this.state.quizMode = "daily";
    this.state.currentIndex = 0;
    this.state.quizCorrectCount = 0;

    // 從 400 題隨機抽 20 題
    const shuffled = [...RAW_QUESTIONS].sort(() => 0.5 - Math.random());
    this.state.currentQuiz = shuffled.slice(0, 20);

    this.showView("view-quiz");
    this.renderQuestion();
  },

  // 錯題大屠殺
  startMistakeQuiz() {
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
    this.closeCategoryModal();
    this.state.quizMode = "category";
    this.state.currentIndex = 0;
    this.state.quizCorrectCount = 0;

    const filtered = RAW_QUESTIONS.filter(q => q.cat_id === catId);
    this.state.currentQuiz = filtered.sort(() => 0.5 - Math.random()).slice(0, 20);

    this.showView("view-quiz");
    this.renderQuestion();
  },

  // 80 題全真模擬考
  startMockExam() {
    if (!confirm("即將開始 80 題全真模擬考！測驗時間共 120 分鐘，是否確認開始？")) {
      return;
    }
    this.state.quizMode = "mock";
    this.state.currentIndex = 0;
    this.state.quizCorrectCount = 0;

    // 抽 80 題
    const shuffled = [...RAW_QUESTIONS].sort(() => 0.5 - Math.random());
    this.state.currentQuiz = shuffled.slice(0, 80);

    this.showView("view-quiz");
    this.renderQuestion();
  },

  // 6. 渲染當前題目
  renderQuestion() {
    this.state.hasAnswered = false;
    const q = this.state.currentQuiz[this.state.currentIndex];
    const total = this.state.currentQuiz.length;
    const curr = this.state.currentIndex + 1;

    document.getElementById("quizProgressNum").innerText = `${curr} / ${total}`;
    document.getElementById("quizCatTag").innerText = q.cat_name || "營建法規";
    document.getElementById("quizYearTag").innerText = `${q.year}年 第${q.q_num}題`;

    const hotTag = document.getElementById("quizHotTag");
    hotTag.style.display = q.is_hot ? "inline-block" : "none";

    document.getElementById("quizQuestionText").innerText = q.stem;

    // 選項渲染
    const optList = document.getElementById("quizOptionsList");
    optList.innerHTML = "";

    const keys = ["A", "B", "C", "D"];
    keys.forEach((k, idx) => {
      const text = q.options[k] || "";
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
    document.getElementById("expLawRef").innerText = q.law || "相關法規";
    
    // 生成三秒秒殺關鍵字
    let keyPhrase = `正確解答為 (${q.answer})。`;
    if (q.stem.includes("罰鍰")) {
      keyPhrase += `罰鍰金額題：請牢記該法法定額度，避免被級距數字誤導。`;
    } else if (q.stem.includes("無障礙")) {
      keyPhrase += `無障礙核心：坡度不得大於 1:12，迴轉空間直徑不得小於 150 cm。`;
    } else if (q.stem.includes("防火區劃")) {
      keyPhrase += `防火區劃原則每 1500 m²，有自動滅火加倍為 3000 m²。`;
    } else {
      keyPhrase += `熟記條文之法定主體、程序與排除例外條件。`;
    }
    document.getElementById("expKeyText").innerText = keyPhrase;

    let trapPhrase = `注意題幹是問「何者錯誤」還是「何者正確」；小心『得』與『應』之法律效果差異。`;
    document.getElementById("expTrapText").innerText = trapPhrase;
  },

  // 7. 作答反饋判定
  handleAnswer(selectedKey) {
    if (this.state.hasAnswered) return;
    this.state.hasAnswered = true;

    const q = this.state.currentQuiz[this.state.currentIndex];
    const isCorrect = selectedKey.toUpperCase() === q.answer.toUpperCase();

    // 更新累積統計
    this.state.answeredTotal++;
    this.state.todayAnswered++;
    if (isCorrect) {
      this.state.correctTotal++;
      this.state.quizCorrectCount++;
    }

    // 更新按鈕樣式
    const selectedBtn = document.getElementById(`optBtn_${selectedKey}`);
    const correctBtn = document.getElementById(`optBtn_${q.answer}`);

    if (isCorrect) {
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

  // 10. 數字翻牌卡邏輯
  showFlashcards() {
    this.state.fcIndex = 0;
    this.showView("view-flashcards");
    this.renderFlashcard();
  },

  renderFlashcard() {
    const card = FLASHCARDS[this.state.fcIndex];
    const total = FLASHCARDS.length;
    const curr = this.state.fcIndex + 1;

    document.getElementById("flashcardCounter").innerText = `${curr} / ${total}`;
    document.getElementById("fcCatTag").innerText = card.cat;
    document.getElementById("fcLawTag").innerText = card.law;
    document.getElementById("fcQuestion").innerText = card.front;
    document.getElementById("fcAnswer").innerText = card.back;
    document.getElementById("fcTrap").innerText = "⚠️ " + card.trap;

    const el = document.getElementById("flashcardElement");
    el.classList.remove("flipped");
  },

  flipFlashcard() {
    const el = document.getElementById("flashcardElement");
    el.classList.toggle("flipped");
  },

  nextFlashcard() {
    if (this.state.fcIndex < FLASHCARDS.length - 1) {
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
      this.state.fcIndex = FLASHCARDS.length - 1;
    }
    this.renderFlashcard();
  },

  // 11. 全鍵盤盲打支援
  bindKeyboard() {
    window.addEventListener("keydown", e => {
      const activeView = document.querySelector(".view-section.active");
      if (!activeView || activeView.id !== "view-quiz") return;

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
      lastDate: this.state.lastDate,
      todayAnswered: this.state.todayAnswered,
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
      this.state.lastDate = parsed.lastDate || "";
      this.state.todayAnswered = parsed.todayAnswered || 0;
      this.saveState();
      this.renderDashboard();
      this.closeSyncModal();
      alert("🎉 進度同步還原成功！所有答題與錯題紀錄已更新！");
    } catch (e) {
      alert("❌ 代碼格式不正確，請確認完整複製！");
    }
  }
};

// 啟動應用
window.addEventListener("DOMContentLoaded", () => {
  app.init();
});
