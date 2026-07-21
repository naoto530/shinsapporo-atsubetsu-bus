const DAY_TYPES = {
  weekday: "平日",
  saturday: "土曜",
  holiday: "日曜・祝日"
};

const HOLIDAY_OVERRIDES = {
  "2026-01-01": "元日",
  "2026-01-12": "成人の日",
  "2026-02-11": "建国記念の日",
  "2026-02-23": "天皇誕生日",
  "2026-03-20": "春分の日",
  "2026-04-29": "昭和の日",
  "2026-05-03": "憲法記念日",
  "2026-05-04": "みどりの日",
  "2026-05-05": "こどもの日",
  "2026-05-06": "振替休日",
  "2026-07-20": "海の日",
  "2026-08-11": "山の日",
  "2026-09-21": "敬老の日",
  "2026-09-22": "国民の休日",
  "2026-09-23": "秋分の日",
  "2026-10-12": "スポーツの日",
  "2026-11-03": "文化の日",
  "2026-11-23": "勤労感謝の日",
  "2027-01-01": "元日",
  "2027-01-11": "成人の日",
  "2027-02-11": "建国記念の日",
  "2027-02-23": "天皇誕生日",
  "2027-03-21": "春分の日",
  "2027-03-22": "振替休日",
  "2027-04-29": "昭和の日",
  "2027-05-03": "憲法記念日",
  "2027-05-04": "みどりの日",
  "2027-05-05": "こどもの日",
  "2027-07-19": "海の日",
  "2027-08-11": "山の日",
  "2027-09-20": "敬老の日",
  "2027-09-23": "秋分の日",
  "2027-10-11": "スポーツの日",
  "2027-11-03": "文化の日",
  "2027-11-23": "勤労感謝の日"
};

const STORAGE_KEY = "atsubetsu-bus-timetable";
const STORAGE_FETCHED_AT = "atsubetsu-bus-fetched-at";
const BABY_MESSAGE_KEY = "atsubetsu-bus-baby-message";

const BABY_MESSAGES = [
  "だっこ、まだかな！",
  "おかえり、まってるよ！",
  "はやくお顔みたいな！",
  "バスさん、すいすい行ってね！",
  "ただいまの声、ききたいな！",
  "玄関の音、きこえるかな！",
  "にこにこ用意してるよ！",
  "だっこされたら、ふにゃってなるよ！",
  "今日はいっぱい見つめたいな！",
  "おてて、にぎってほしいな！",
  "帰ってきたら、にぱってするよ！",
  "会えたら、ほっとするかも！",
  "おかえりって感じたいな！",
  "ねんねする前に会えたらうれしいな！",
  "足音、まだかなまだかな！",
  "今日もいっぱいがんばったね！",
  "お顔見たら、安心するよ！",
  "抱っこチャージしたいな！",
  "帰り道、ゆっくり安全にね！",
  "でも、ちょっと早めがいいな！",
  "ただいま待ちしてるよ！",
  "ほっぺ、ぷにってしてね！",
  "笑顔、しまっておいたよ！",
  "会えたら、目で追っちゃうよ！",
  "おかえりの顔、見せてね！",
  "今日は甘えたい気分だよ！",
  "帰ってきたら、じーっと見るよ！",
  "帰ってくる気がしてるよ！",
  "おかえり練習、できたよ！",
  "会えたら、ほっぺ動くよ！",
  "今日も待ってた顔するよ！",
  "目が合ったら、うれしいよ！",
  "ただいまには、にこってするよ！",
  "おかえりの瞬間、すきだよ！",
  "だっこ席、空けてあるよ！",
  "今日はだっこ長めがいいな！",
  "おみやげは、なでなででいいよ！",
  "会えるまで、むにむに待つよ！",
  "玄関のほう、見ちゃうよ！",
  "帰ってきたら、声きかせてね！",
  "おつかれさまって思ってるよ！",
  "バス降りたら、もうすぐだね！",
  "あと何分かな、わくわく！",
  "おかえりしたら、拍手したいな！",
  "笑顔の準備、できたよ！",
  "だっこでただいま、したいな！",
  "今日はお話ききたいな！",
  "帰ってきたら、そばにいてね！",
  "会えたら、うれしくなっちゃう！",
  "なーたん、ここで待ってるよ！"
];

const state = {
  timetable: null,
  activeView: "next",
  activeScheduleType: "weekday",
  isLiveNow: true,
  dataSource: "loading",
  lastFetchedAt: null
};

const elements = {
  connectionSignal: document.getElementById("connectionSignal"),
  connectionText: document.getElementById("connectionText"),
  currentClock: document.getElementById("currentClock"),
  currentDayType: document.getElementById("currentDayType"),
  dateInput: document.getElementById("dateInput"),
  timeInput: document.getElementById("timeInput"),
  useNowButton: document.getElementById("useNowButton"),
  searchButton: document.getElementById("searchButton"),
  refreshDataButton: document.getElementById("refreshDataButton"),
  tabs: document.querySelectorAll(".tab"),
  nextView: document.getElementById("nextView"),
  scheduleView: document.getElementById("scheduleView"),
  searchContext: document.getElementById("searchContext"),
  dataVersion: document.getElementById("dataVersion"),
  notice: document.getElementById("notice"),
  resultList: document.getElementById("resultList"),
  segments: document.querySelectorAll(".segment"),
  scheduleList: document.getElementById("scheduleList"),
  babyLine: document.getElementById("babyLine"),
  toast: document.getElementById("toast")
};

init();

function init() {
  setInputsToNow();
  setBabyMessage();
  bindEvents();
  updateClock();
  loadTimetable();
  registerServiceWorker();

  setInterval(() => {
    updateClock();
    if (state.isLiveNow) {
      setInputsToNow(false);
      render();
    }
  }, 30000);
}

function setBabyMessage() {
  if (!elements.babyLine) return;
  elements.babyLine.textContent = pickBabyMessage();
}

function pickBabyMessage() {
  let previous = "";

  try {
    previous = localStorage.getItem(BABY_MESSAGE_KEY) || "";
  } catch (error) {
    previous = "";
  }

  const candidates = BABY_MESSAGES.filter((message) => message !== previous);
  const pool = candidates.length > 0 ? candidates : BABY_MESSAGES;
  const message = pool[Math.floor(Math.random() * pool.length)] || BABY_MESSAGES[0];

  try {
    localStorage.setItem(BABY_MESSAGE_KEY, message);
  } catch (error) {
    // localStorage may be unavailable in some private browsing modes.
  }

  return message;
}

function bindEvents() {
  elements.useNowButton.addEventListener("click", () => {
    state.isLiveNow = true;
    setInputsToNow();
    render();
    showToast("現在日時に戻しました");
  });

  elements.searchButton.addEventListener("click", () => {
    state.isLiveNow = false;
    render();
  });

  elements.refreshDataButton.addEventListener("click", async () => {
    await loadTimetable(true);
  });

  [elements.dateInput, elements.timeInput].forEach((input) => {
    input.addEventListener("change", () => {
      state.isLiveNow = false;
      render();
    });
  });

  elements.tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      state.activeView = tab.dataset.view;
      renderTabs();
    });
  });

  elements.segments.forEach((segment) => {
    segment.addEventListener("click", () => {
      state.activeScheduleType = segment.dataset.dayType;
      renderSchedule();
      renderSegments();
    });
  });

  window.addEventListener("online", () => {
    updateConnection();
    loadTimetable(true);
  });
  window.addEventListener("offline", updateConnection);
}

async function loadTimetable(force = false) {
  const previousVersion = state.timetable?.metadata?.version;
  state.dataSource = "loading";
  renderDataStatus();

  try {
    const embeddedTimetable = readEmbeddedTimetable();
    if (!force && location.protocol === "file:" && embeddedTimetable) {
      state.timetable = embeddedTimetable;
      state.dataSource = "embedded";
      state.lastFetchedAt = new Date().toISOString();
      render();
      return;
    }

    const cacheBuster = force ? Date.now() : "latest";
    const response = await fetch(`data/timetable.json?cache=${cacheBuster}`, {
      cache: "no-store"
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const timetable = await response.json();
    validateTimetable(timetable);
    state.timetable = timetable;
    state.dataSource = "network";
    state.lastFetchedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(timetable));
    localStorage.setItem(STORAGE_FETCHED_AT, state.lastFetchedAt);

    if (force) {
      showToast("時刻表を更新しました");
    } else if (previousVersion && previousVersion !== timetable.metadata?.version) {
      showToast("新しい時刻表を読み込みました");
    }
  } catch (error) {
    const backup = localStorage.getItem(STORAGE_KEY);
    if (backup) {
      state.timetable = JSON.parse(backup);
      state.dataSource = "backup";
      state.lastFetchedAt = localStorage.getItem(STORAGE_FETCHED_AT);
      showToast("保存済みの時刻表を表示しています");
    } else if (readEmbeddedTimetable()) {
      state.timetable = readEmbeddedTimetable();
      state.dataSource = "embedded";
      state.lastFetchedAt = new Date().toISOString();
      showToast("プレビュー用の内蔵時刻表を表示しています");
    } else {
      state.timetable = {
        metadata: {
          name: "時刻表",
          version: "未取得",
          updatedAt: "",
          sourceNote: "時刻表を取得できませんでした。"
        },
        routes: []
      };
      state.dataSource = "empty";
      showToast("時刻表を取得できませんでした");
    }
  }

  updateConnection();
  render();
}

function readEmbeddedTimetable() {
  const element = document.getElementById("embeddedTimetable");
  const text = element?.textContent?.trim();
  if (!text) return null;

  const timetable = JSON.parse(text);
  validateTimetable(timetable);
  return timetable;
}

function validateTimetable(timetable) {
  if (!Array.isArray(timetable.routes)) {
    throw new Error("routes is required");
  }
}

function setInputsToNow(shouldUpdateClock = true) {
  const now = new Date();
  elements.dateInput.value = formatDateInput(now);
  elements.timeInput.value = formatTimeInput(now);
  if (shouldUpdateClock) updateClock();
}

function updateClock() {
  const now = new Date();
  elements.currentClock.textContent = `${formatDateLabel(now)} ${formatTimeInput(now)}`;
  const dayInfo = getServiceDayInfo(now);
  elements.currentDayType.textContent = dayInfo.holidayName
    ? `${dayInfo.label} (${dayInfo.holidayName})`
    : dayInfo.label;
  updateConnection();
}

function updateConnection() {
  const isOnline = navigator.onLine;
  elements.connectionSignal.classList.toggle("is-online", isOnline);
  elements.connectionSignal.classList.toggle("is-offline", !isOnline);

  if (!isOnline) {
    elements.connectionText.textContent = "オフライン";
    return;
  }

  elements.connectionText.textContent = state.dataSource === "backup" ? "保存データ" : "オンライン";
}

function render() {
  renderDataStatus();
  renderTabs();
  renderNextBuses();
  renderSchedule();
}

function renderDataStatus() {
  const metadata = state.timetable?.metadata;
  if (state.dataSource === "loading") {
    elements.dataVersion.textContent = "読込中";
    return;
  }

  const version = metadata?.version || "時刻表";
  const updatedAt = metadata?.updatedAt ? `更新 ${metadata.updatedAt}` : "";
  const sourceLabel =
    state.dataSource === "backup"
      ? "保存済み"
      : state.dataSource === "embedded"
        ? "プレビュー"
        : "最新版";
  elements.dataVersion.textContent = `${sourceLabel} / ${version}${updatedAt ? ` / ${updatedAt}` : ""}`;
}

function renderTabs() {
  elements.tabs.forEach((tab) => {
    tab.classList.toggle("is-active", tab.dataset.view === state.activeView);
  });
  elements.nextView.hidden = state.activeView !== "next";
  elements.scheduleView.hidden = state.activeView !== "schedule";
}

function renderSegments() {
  elements.segments.forEach((segment) => {
    segment.classList.toggle("is-active", segment.dataset.dayType === state.activeScheduleType);
  });
}

function renderNextBuses() {
  if (!state.timetable) return;

  const selected = getSelectedDateTime();
  const dayInfo = getServiceDayInfo(selected);
  const departures = getDeparturesForDate(selected)
    .filter((departure) => departure.minutesOfDay >= minutesFromDate(selected))
    .sort(compareDeparture);

  const dateLabel = formatDateLabel(selected);
  const holidayText = dayInfo.holidayName ? ` / ${dayInfo.holidayName}` : "";
  elements.searchContext.textContent = `${dateLabel} ${formatTimeInput(selected)}以降 / ${dayInfo.label}${holidayText}`;

  if (departures.length > 0) {
    elements.notice.hidden = true;
    elements.notice.textContent = "";
    elements.resultList.innerHTML = departures.map((departure) => renderBusCard(departure, selected)).join("");
    return;
  }

  const nextFirst = findNextFirstDeparture(selected);
  elements.resultList.innerHTML = nextFirst
    ? renderBusCard(nextFirst.departure, selected, nextFirst.offsetDays === 1 ? "翌日の始発" : "次の始発")
    : `<div class="empty-state">表示できる便がありません</div>`;

  if (nextFirst) {
    const nextDate = formatDateLabel(nextFirst.date);
    elements.notice.hidden = false;
    elements.notice.textContent = `本日の最終バスは終了しました。${nextDate}の始発を表示しています。`;
  } else {
    elements.notice.hidden = false;
    elements.notice.textContent = "時刻表に表示できる便がありません。";
  }
}

function renderSchedule() {
  if (!state.timetable) return;
  renderSegments();

  const routes = state.timetable.routes || [];
  if (routes.length === 0) {
    elements.scheduleList.innerHTML = `<div class="empty-state">時刻表データがありません</div>`;
    return;
  }

  elements.scheduleList.innerHTML = routes
    .map((route) => {
      const times = route.timetables?.[state.activeScheduleType] || [];
      return `
        <article class="schedule-card">
          <div class="schedule-head">
            <div>
              <p class="eyebrow">${escapeHtml(route.operator)}</p>
              <h3 class="schedule-title">${escapeHtml(route.routeName)}</h3>
            </div>
            <span class="lane-badge">${escapeHtml(route.lane)}</span>
          </div>
          <div class="route-meta">
            <span class="pill important">降車 ${escapeHtml(route.alightingStop)}</span>
            ${renderTravelTimePill(route)}
            <span class="pill">${DAY_TYPES[state.activeScheduleType]}</span>
          </div>
          <div class="time-grid">
            ${
              times.length > 0
                ? times.map((time) => `<span class="time-chip">${escapeHtml(time)}</span>`).join("")
                : `<span class="empty-state">この曜日の便はありません</span>`
            }
          </div>
        </article>
      `;
    })
    .join("");
}

function getDeparturesForDate(date) {
  const dayInfo = getServiceDayInfo(date);
  const dateKey = formatDateInput(date);
  const routes = state.timetable?.routes || [];

  return routes.flatMap((route) => {
    const times = route.timetables?.[dayInfo.type] || [];
    return times.map((time) => {
      const minutesOfDay = parseTimeToMinutes(time);
      return {
        ...route,
        serviceType: dayInfo.type,
        serviceLabel: dayInfo.label,
        holidayName: dayInfo.holidayName,
        time,
        dateKey,
        minutesOfDay,
        departureAt: combineDateAndMinutes(date, minutesOfDay)
      };
    });
  });
}

function findNextFirstDeparture(selected) {
  for (let offsetDays = 1; offsetDays <= 14; offsetDays += 1) {
    const date = addDays(selected, offsetDays);
    const departures = getDeparturesForDate(date).sort(compareDeparture);
    if (departures.length > 0) {
      return {
        offsetDays,
        date,
        departure: departures[0]
      };
    }
  }
  return null;
}

function renderBusCard(departure, baseDate, badgeText = "") {
  const waitMinutes = Math.max(
    0,
    Math.round((departure.departureAt.getTime() - baseDate.getTime()) / 60000)
  );
  const travelMinutes = getTravelTimeMinutes(departure);
  const alightingTime = travelMinutes
    ? formatTimeInput(addMinutes(departure.departureAt, travelMinutes))
    : "";
  const dayBadge = departure.holidayName
    ? `${departure.serviceLabel} (${departure.holidayName})`
    : departure.serviceLabel;

  return `
    <article class="bus-card" style="--route-color: ${escapeHtml(departure.color || "#006b5f")}">
      <div class="bus-main">
        <div class="time-block">
          <span class="departure-time">${escapeHtml(departure.time)}</span>
          <span class="wait-time">${formatWait(waitMinutes)}</span>
        </div>
        <div>
          <p class="route-title">${escapeHtml(departure.operator)} ${escapeHtml(departure.routeName)}</p>
          ${
            travelMinutes
              ? `<div class="trip-summary">
                  <span>所要 約${travelMinutes}分</span>
                  <span>降車目安 ${escapeHtml(alightingTime)}</span>
                </div>`
              : ""
          }
          <div class="route-meta">
            ${badgeText ? `<span class="pill important">${escapeHtml(badgeText)}</span>` : ""}
            <span class="pill important">${escapeHtml(departure.lane)}</span>
            <span class="pill">降車 ${escapeHtml(departure.alightingStop)}</span>
            <span class="pill">${escapeHtml(dayBadge)}</span>
          </div>
        </div>
      </div>
    </article>
  `;
}

function renderTravelTimePill(route) {
  const travelMinutes = getTravelTimeMinutes(route);
  return travelMinutes ? `<span class="pill">所要 約${travelMinutes}分</span>` : "";
}

function getTravelTimeMinutes(route) {
  const minutes = Number(route.travelTimeMinutes);
  return Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes) : null;
}

function getSelectedDateTime() {
  const dateValue = elements.dateInput.value || formatDateInput(new Date());
  const timeValue = elements.timeInput.value || formatTimeInput(new Date());
  const [year, month, day] = dateValue.split("-").map(Number);
  const [hour, minute] = timeValue.split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

function getServiceDayInfo(date) {
  const holidayName = getJapaneseHolidayName(date);
  if (holidayName || date.getDay() === 0) {
    return { type: "holiday", label: DAY_TYPES.holiday, holidayName };
  }
  if (date.getDay() === 6) {
    return { type: "saturday", label: DAY_TYPES.saturday, holidayName: "" };
  }
  return { type: "weekday", label: DAY_TYPES.weekday, holidayName: "" };
}

function getJapaneseHolidayName(date) {
  const key = formatDateInput(date);
  if (HOLIDAY_OVERRIDES[key]) return HOLIDAY_OVERRIDES[key];

  const holidays = buildJapaneseHolidays(date.getFullYear());
  return holidays.get(key) || "";
}

function buildJapaneseHolidays(year) {
  const base = new Map();
  addHoliday(base, year, 1, 1, "元日");
  addHoliday(base, year, 1, nthWeekdayOfMonth(year, 1, 1, 2), "成人の日");
  addHoliday(base, year, 2, 11, "建国記念の日");
  addHoliday(base, year, 2, 23, "天皇誕生日");
  addHoliday(base, year, 3, springEquinoxDay(year), "春分の日");
  addHoliday(base, year, 4, 29, "昭和の日");
  addHoliday(base, year, 5, 3, "憲法記念日");
  addHoliday(base, year, 5, 4, "みどりの日");
  addHoliday(base, year, 5, 5, "こどもの日");
  addHoliday(base, year, 7, nthWeekdayOfMonth(year, 7, 1, 3), "海の日");
  addHoliday(base, year, 8, 11, "山の日");
  addHoliday(base, year, 9, nthWeekdayOfMonth(year, 9, 1, 3), "敬老の日");
  addHoliday(base, year, 9, autumnEquinoxDay(year), "秋分の日");
  addHoliday(base, year, 10, nthWeekdayOfMonth(year, 10, 1, 2), "スポーツの日");
  addHoliday(base, year, 11, 3, "文化の日");
  addHoliday(base, year, 11, 23, "勤労感謝の日");

  const holidays = new Map(base);
  applySubstituteHolidays(year, base, holidays);
  applyCitizensHolidays(year, base, holidays);

  return holidays;
}

function addHoliday(map, year, month, day, name) {
  map.set(`${year}-${pad(month)}-${pad(day)}`, name);
}

function applySubstituteHolidays(year, base, holidays) {
  [...base.keys()]
    .sort()
    .forEach((key) => {
      const date = parseDateKey(key);
      if (date.getDay() !== 0) return;

      let substitute = addDays(date, 1);
      while (substitute.getFullYear() === year && holidays.has(formatDateInput(substitute))) {
        substitute = addDays(substitute, 1);
      }

      if (substitute.getFullYear() === year) {
        holidays.set(formatDateInput(substitute), "振替休日");
      }
    });
}

function applyCitizensHolidays(year, base, holidays) {
  for (let month = 1; month <= 12; month += 1) {
    const daysInMonth = new Date(year, month, 0).getDate();
    for (let day = 2; day < daysInMonth; day += 1) {
      const key = `${year}-${pad(month)}-${pad(day)}`;
      const previousKey = `${year}-${pad(month)}-${pad(day - 1)}`;
      const nextKey = `${year}-${pad(month)}-${pad(day + 1)}`;
      if (!holidays.has(key) && base.has(previousKey) && base.has(nextKey)) {
        holidays.set(key, "国民の休日");
      }
    }
  }
}

function nthWeekdayOfMonth(year, month, weekday, nth) {
  const first = new Date(year, month - 1, 1);
  const offset = (weekday - first.getDay() + 7) % 7;
  return 1 + offset + (nth - 1) * 7;
}

function springEquinoxDay(year) {
  if (year <= 2099) {
    return Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
  }
  return 20;
}

function autumnEquinoxDay(year) {
  if (year <= 2099) {
    return Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
  }
  return 23;
}

function compareDeparture(a, b) {
  return (
    a.departureAt - b.departureAt ||
    a.minutesOfDay - b.minutesOfDay ||
    String(a.lane).localeCompare(String(b.lane), "ja")
  );
}

function parseTimeToMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesFromDate(date) {
  return date.getHours() * 60 + date.getMinutes();
}

function combineDateAndMinutes(date, minutes) {
  const result = new Date(date);
  result.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return result;
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60000);
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function parseDateKey(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDateInput(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatTimeInput(date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDateLabel(date) {
  const dayNames = ["日", "月", "火", "水", "木", "金", "土"];
  return `${date.getMonth() + 1}/${date.getDate()}(${dayNames[date.getDay()]})`;
}

function formatWait(minutes) {
  if (minutes <= 0) return "まもなく";
  if (minutes < 60) return `あと${minutes}分`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `あと${hours}時間` : `あと${hours}時間${rest}分`;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    elements.toast.hidden = true;
  }, 2600);
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || location.protocol === "file:") return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {
      showToast("オフライン機能を開始できませんでした");
    });
  });
}
