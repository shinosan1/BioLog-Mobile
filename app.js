(function () {
  "use strict";

  var state = {
    todayDate: "",
    todayRecord: null,
    editingDate: "",
    dateEditDate: "",
    dateEditRecord: null,
    dateEditLoaded: false,
    pullRefreshing: false
  };

  var els = {};
  var THEME_STORAGE_KEY = "biolog_mobile_theme";
  var LIGHT_THEME_COLOR = "#2E7D32";
  var DARK_THEME_COLOR = "#102116";
  var TOP_SUMMARY_ITEMS = [
    { label: "体重", field: "weight", unit: "kg" },
    { label: "体温", field: "temperature", unit: "℃" },
    { label: "血圧", field: "blood_pressure", unit: "mmHg" },
    { label: "脈拍", field: "pulse", unit: "回/分" },
    { label: "体脂肪率", field: "body_fat", unit: "%" },
    { label: "基礎代謝量", field: "bmr", unit: "kcal" },
    { label: "筋肉量", field: "muscle_mass", unit: "kg" }
  ];

  function setStatus(message) {
    if (els.status) {
      els.status.textContent = message;
    }
  }

  function showMessage(target, message, type) {
    if (!target) {
      return;
    }

    target.textContent = message;
    target.className = "message message-" + type;
    target.hidden = false;
  }

  function clearMessage(target) {
    if (!target) {
      return;
    }

    target.textContent = "";
    target.hidden = true;
  }

  function normalizeTheme(theme) {
    return theme === "dark" || theme === "light" ? theme : "";
  }

  function readStoredTheme() {
    try {
      return normalizeTheme(window.localStorage.getItem(THEME_STORAGE_KEY));
    } catch (error) {
      return "";
    }
  }

  function preferredTheme() {
    if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
      return "dark";
    }
    return "light";
  }

  function initialTheme() {
    return normalizeTheme(document.documentElement.dataset.theme) || readStoredTheme() || preferredTheme();
  }

  function updateThemeMeta(theme) {
    var meta = document.querySelector("meta[name='theme-color']");
    if (meta) {
      meta.setAttribute("content", theme === "dark" ? DARK_THEME_COLOR : LIGHT_THEME_COLOR);
    }
  }

  function updateThemeButton(theme) {
    if (!els.themeToggle) {
      return;
    }

    if (theme === "dark") {
      els.themeToggle.textContent = "ライト";
      els.themeToggle.setAttribute("aria-label", "ライトモードに切り替え");
      els.themeToggle.title = "ライトモードに切り替え";
    } else {
      els.themeToggle.textContent = "ダーク";
      els.themeToggle.setAttribute("aria-label", "ダークモードに切り替え");
      els.themeToggle.title = "ダークモードに切り替え";
    }
  }

  function applyTheme(theme, shouldSave) {
    var nextTheme = normalizeTheme(theme) || "light";
    document.documentElement.dataset.theme = nextTheme;
    updateThemeMeta(nextTheme);
    updateThemeButton(nextTheme);

    if (shouldSave) {
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
      } catch (error) {
        return;
      }
    }
  }

  function bindThemeControl() {
    if (!els.themeToggle) {
      return;
    }

    els.themeToggle.addEventListener("click", function () {
      var currentTheme = normalizeTheme(document.documentElement.dataset.theme) || "light";
      applyTheme(currentTheme === "dark" ? "light" : "dark", true);
    });
  }

  function createEl(tag, className, text) {
    var el = document.createElement(tag);
    if (className) {
      el.className = className;
    }
    if (text !== undefined) {
      el.textContent = text;
    }
    return el;
  }

  function createInput(field) {
    var input = document.createElement("input");
    input.type = "number";
    input.name = field.name;
    input.min = String(field.min);
    input.max = String(field.max);
    input.step = field.step;
    input.inputMode = field.type === "int" ? "numeric" : "decimal";
    input.autocomplete = "off";
    return input;
  }

  function createForm(id, mode, submitLabel) {
    var form = document.createElement("form");
    form.id = id;
    form.className = "record-form";
    form.dataset.mode = mode;
    form.noValidate = true;

    var error = createEl("div", "message message-error");
    error.dataset.role = "form-error";
    error.hidden = true;
    form.appendChild(error);

    var dateInput = document.createElement("input");
    dateInput.type = "hidden";
    dateInput.name = "date";
    form.appendChild(dateInput);

    var grid = createEl("div", "field-grid");
    window.BioLogForm.MEASUREMENT_FIELDS.forEach(function (field) {
      var wrapper = createEl("label", "field");
      var label = createEl("span", "field-label", field.label + " (" + field.unit + ")");
      var input = createInput(field);
      wrapper.appendChild(label);
      wrapper.appendChild(input);
      grid.appendChild(wrapper);
    });
    form.appendChild(grid);

    window.BioLogForm.TEXT_FIELDS.forEach(function (field) {
      var wrapper = createEl("label", "field field-wide");
      var label = createEl("span", "field-label", field.label);
      var textarea = document.createElement("textarea");
      textarea.name = field.name;
      textarea.rows = 3;
      wrapper.appendChild(label);
      wrapper.appendChild(textarea);
      form.appendChild(wrapper);
    });

    var submitMessage = createEl("div", "message");
    submitMessage.dataset.role = "submit-message";
    submitMessage.hidden = true;
    form.appendChild(submitMessage);

    var actions = createEl("div", "form-actions");
    var submit = document.createElement("button");
    submit.type = "submit";
    submit.className = "primary-button";
    submit.textContent = submitLabel;
    actions.appendChild(submit);

    if (mode === "edit") {
      var cancel = document.createElement("button");
      cancel.type = "button";
      cancel.className = "secondary-button";
      cancel.textContent = "キャンセル";
      cancel.dataset.action = "cancel-edit";
      actions.appendChild(cancel);
    }

    form.appendChild(actions);
    form.addEventListener("input", function () {
      clearFormErrors(form);
    });
    form.addEventListener("change", function () {
      clearFormErrors(form);
    });
    return form;
  }

  function setFormDate(form, date) {
    if (form.elements.date) {
      form.elements.date.value = date;
    }
  }

  function showFormErrors(form, errors) {
    showFormMessage(form, errors.join("\n"), "error");
  }

  function showFormMessage(form, message, type) {
    var target = form.querySelector("[data-role='submit-message']") ||
      form.querySelector("[data-role='form-error']");
    showMessage(target, message, type);
  }

  function clearFormErrors(form) {
    var error = form.querySelector("[data-role='form-error']");
    var submitMessage = form.querySelector("[data-role='submit-message']");
    clearMessage(error);
    clearMessage(submitMessage);
  }

  function activateView(viewName) {
    document.querySelectorAll("[data-view]").forEach(function (view) {
      view.hidden = view.dataset.view !== viewName;
    });

    document.querySelectorAll("[data-view-target]").forEach(function (button) {
      button.classList.toggle("is-active", button.dataset.viewTarget === viewName);
    });

    if (viewName === "history") {
      renderHistory();
    }
    if (viewName === "graph") {
      renderGraphs();
    }
    if (viewName === "backup") {
      renderStorageStatus();
    }
  }

  function isGraphViewActive() {
    var graphView = document.querySelector("[data-view='graph']");
    return graphView && !graphView.hidden;
  }

  function refreshGraphsIfVisible() {
    if (isGraphViewActive()) {
      return renderGraphs();
    }
    return Promise.resolve();
  }

  function activeViewName() {
    var view = document.querySelector("[data-view]:not([hidden])");
    return view ? view.dataset.view : "today";
  }

  function refreshVisibleContent() {
    var viewName = activeViewName();
    var tasks = [loadTodayRecord(), renderStorageStatus()];

    if (viewName === "history") {
      tasks.push(renderHistory());
    }
    if (viewName === "graph") {
      tasks.push(renderGraphs());
    }
    if (viewName === "backup") {
      tasks.push(renderStorageStatus());
    }

    return Promise.all(tasks);
  }

  function isStandaloneLaunch() {
    var iosStandalone = window.navigator && window.navigator.standalone === true;
    var displayStandalone = window.matchMedia &&
      window.matchMedia("(display-mode: standalone)").matches;
    return !!(iosStandalone || displayStandalone);
  }

  function currentOriginText() {
    var origin = window.location && window.location.origin ? window.location.origin : "";
    return origin && origin !== "null" ? origin : "不明";
  }

  function storageStatusRow(label, value) {
    var row = createEl("div", "storage-status-row");
    row.appendChild(createEl("span", "storage-status-label", label));
    row.appendChild(createEl("strong", "storage-status-value", value));
    return row;
  }

  function renderStorageStatus() {
    if (!els.storageStatusList) {
      return Promise.resolve();
    }

    return window.BioLogDB.getAllRecords().then(function (records) {
      var count = records.length;
      var isStandalone = isStandaloneLaunch();
      els.storageStatusList.textContent = "";
      els.storageStatusList.appendChild(storageStatusRow("起動状態", isStandalone ? "ホーム画面" : "ブラウザ"));
      els.storageStatusList.appendChild(storageStatusRow("保存件数", String(count) + "件"));
      els.storageStatusList.appendChild(storageStatusRow("保存先", currentOriginText()));
      els.storageStatusList.appendChild(storageStatusRow("DB名", "biolog_mobile"));

      if (els.storageStatusWarning) {
        if (isStandalone && count === 0) {
          showMessage(
            els.storageStatusWarning,
            "ホーム画面版で見えている記録が0件です。Safari側に記録が残っている場合は、SafariでJSONを書き出し、このホーム画面版でJSONを読み込んでください。ホーム画面アイコンを削除・再追加する前にも、必ずJSONバックアップを作成してください。",
            "error"
          );
        } else {
          clearMessage(els.storageStatusWarning);
        }
      }
    }).catch(function () {
      els.storageStatusList.textContent = "";
      els.storageStatusList.appendChild(storageStatusRow("保存状態", "読み込めませんでした"));
      if (els.storageStatusWarning) {
        clearMessage(els.storageStatusWarning);
      }
    });
  }

  function showStartupStorageHint() {
    return window.BioLogDB.getAllRecords().then(function (records) {
      if (isStandaloneLaunch() && records.length === 0) {
        setStatus("ホーム画面版で見える記録が0件です。Safari側に記録がある場合はJSONバックアップで移してください。");
      }
    }).catch(function () {
      return;
    });
  }

  function bindServiceWorkerReload() {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    var reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", function () {
      if (reloading) {
        return;
      }
      reloading = true;
      setStatus("新しい版を読み込んでいます...");
      window.location.reload();
    });
  }

  function skipWaiting(worker) {
    if (worker && worker.postMessage) {
      worker.postMessage({ type: "SKIP_WAITING" });
      return true;
    }
    return false;
  }

  function waitForInstallingWorker(worker) {
    return new Promise(function (resolve) {
      var resolved = false;
      var timeout = window.setTimeout(function () {
        if (!resolved) {
          resolved = true;
          resolve(false);
        }
      }, 4000);

      worker.addEventListener("statechange", function () {
        if (resolved) {
          return;
        }
        if (worker.state === "installed" || worker.state === "activated") {
          resolved = true;
          window.clearTimeout(timeout);
          resolve(skipWaiting(worker));
        }
      });
    });
  }

  function checkForServiceWorkerUpdate() {
    if (!("serviceWorker" in navigator) || !window.isSecureContext) {
      return Promise.resolve(false);
    }

    return navigator.serviceWorker.getRegistration("./").then(function (registration) {
      if (!registration) {
        return false;
      }

      return registration.update().then(function () {
        if (registration.waiting) {
          return skipWaiting(registration.waiting);
        }
        if (registration.installing) {
          return waitForInstallingWorker(registration.installing);
        }
        return false;
      });
    }).catch(function (error) {
      console.warn("Service worker update check failed.", error);
      return false;
    });
  }

  function setPullRefreshIndicator(message, progress, isActive) {
    if (!els.pullRefreshIndicator) {
      return;
    }

    els.pullRefreshIndicator.textContent = message;
    els.pullRefreshIndicator.classList.toggle("is-active", !!isActive);
    els.pullRefreshIndicator.style.transform = "translate(-50%, " + progress + "px)";
  }

  function resetPullRefreshIndicator() {
    if (!els.pullRefreshIndicator) {
      return;
    }

    els.pullRefreshIndicator.classList.remove("is-active");
    els.pullRefreshIndicator.style.transform = "";
  }

  function performPullRefresh() {
    if (state.pullRefreshing) {
      return;
    }

    state.pullRefreshing = true;
    setPullRefreshIndicator("更新中...", 16, true);
    setStatus("更新を確認しています...");

    Promise.all([checkForServiceWorkerUpdate(), refreshVisibleContent()])
      .then(function (results) {
        if (!results[0]) {
          setStatus("更新しました。");
        }
      })
      .catch(function () {
        setStatus("更新に失敗しました。");
      })
      .finally(function () {
        window.setTimeout(function () {
          state.pullRefreshing = false;
          resetPullRefreshIndicator();
        }, 450);
      });
  }

  function createPullRefreshIndicator() {
    var indicator = createEl("div", "pull-refresh-indicator", "下に引いて更新");
    indicator.setAttribute("aria-live", "polite");
    document.body.appendChild(indicator);
    els.pullRefreshIndicator = indicator;
  }

  function bindPullRefresh() {
    var startY = 0;
    var currentPull = 0;
    var isPulling = false;
    var threshold = 72;

    createPullRefreshIndicator();

    window.addEventListener("touchstart", function (event) {
      var target = event.target;
      if (state.pullRefreshing || window.scrollY !== 0 || (target && target.closest && target.closest("input, textarea, select"))) {
        return;
      }

      startY = event.touches[0].clientY;
      currentPull = 0;
      isPulling = true;
    }, { passive: true });

    window.addEventListener("touchmove", function (event) {
      var delta;
      var progress;

      if (!isPulling || !event.touches.length) {
        return;
      }

      delta = event.touches[0].clientY - startY;
      if (delta <= 0) {
        resetPullRefreshIndicator();
        isPulling = false;
        return;
      }

      if (window.scrollY !== 0) {
        return;
      }

      currentPull = delta;
      progress = Math.min(delta * 0.45, 44);
      setPullRefreshIndicator(delta >= threshold ? "離して更新" : "下に引いて更新", progress, true);

      if (delta > 12) {
        event.preventDefault();
      }
    }, { passive: false });

    window.addEventListener("touchend", function () {
      if (!isPulling) {
        return;
      }

      isPulling = false;
      if (currentPull >= threshold) {
        performPullRefresh();
      } else {
        resetPullRefreshIndicator();
      }
    });

    window.addEventListener("touchcancel", function () {
      isPulling = false;
      resetPullRefreshIndicator();
    });
  }

  function hasValue(record, field) {
    return record && record[field] !== undefined && record[field] !== null && record[field] !== "";
  }

  function isRealDateString(value) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "");
    if (!match) {
      return false;
    }

    var year = Number(match[1]);
    var month = Number(match[2]);
    var day = Number(match[3]);
    var date = new Date(year, month - 1, day);

    return date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day;
  }

  function summaryMetricValue(record, item) {
    if (!record) {
      return "--";
    }

    if (item.field === "blood_pressure") {
      var systolic = hasValue(record, "systolic_bp") ? record.systolic_bp : "--";
      var diastolic = hasValue(record, "diastolic_bp") ? record.diastolic_bp : "--";
      if (systolic === "--" && diastolic === "--") {
        return "--";
      }
      return systolic + " / " + diastolic;
    }

    return hasValue(record, item.field) ? String(record[item.field]) : "--";
  }

  function renderTopTodaySummaryCard(record, todayDate) {
    if (!els.topTodaySummary) {
      return;
    }

    var fragment = document.createDocumentFragment();
    var header = createEl("div", "top-summary-header");
    header.appendChild(createEl("h2", "", "今日の主要指標"));
    header.appendChild(createEl("span", "top-summary-date", todayDate));
    fragment.appendChild(header);

    var grid = createEl("div", "top-summary-grid");
    TOP_SUMMARY_ITEMS.forEach(function (item) {
      var metric = createEl("div", "top-summary-metric");
      metric.appendChild(createEl("span", "top-summary-label", item.label));
      metric.appendChild(createEl("strong", "top-summary-value", summaryMetricValue(record, item)));
      metric.appendChild(createEl("span", "top-summary-unit", item.unit));
      grid.appendChild(metric);
    });
    fragment.appendChild(grid);

    els.topTodaySummary.replaceChildren(fragment);
  }

  function renderTopTodaySummary() {
    var todayDate = state.todayDate || window.BioLogDB.localDateYYYYMMDD();

    return window.BioLogDB.getRecordByDate(todayDate).then(function (record) {
      renderTopTodaySummaryCard(record || null, todayDate);
    }).catch(function () {
      if (els.topTodaySummary) {
        els.topTodaySummary.replaceChildren(createEl("p", "placeholder-text", "今日の主要指標を読み込めませんでした。"));
      }
    });
  }

  function loadTodayRecord() {
    var form = document.getElementById("today-form");
    state.todayDate = window.BioLogDB.localDateYYYYMMDD();
    els.todayDateLabel.textContent = state.todayDate;
    setFormDate(form, state.todayDate);

    return window.BioLogDB.getRecordByDate(state.todayDate).then(function (record) {
      state.todayRecord = record || null;
      window.BioLogForm.fillFormFromRecord(form, record || { date: state.todayDate });
      return renderTopTodaySummary();
    });
  }

  function handleTodaySubmit(event) {
    event.preventDefault();
    var form = event.currentTarget;
    clearFormErrors(form);
    clearMessage(els.todayMessage);

    var payload = window.BioLogForm.buildPayloadFromForm(form);
    payload.date = state.todayDate;
    var mode = state.todayRecord ? "update" : "create";
    var result = window.BioLogForm.validatePayload(payload, mode);

    if (!result.valid) {
      showFormErrors(form, result.errors);
      return;
    }

    window.BioLogDB.upsertRecord(payload).then(function (record) {
      state.todayRecord = record;
      window.BioLogForm.fillFormFromRecord(form, record);
      showFormMessage(form, "記録しました。", "success");
      return Promise.all([renderTopTodaySummary(), refreshGraphsIfVisible(), renderStorageStatus()]);
    }).catch(function () {
      showFormMessage(form, "保存に失敗しました。", "error");
    });
  }

  function textBlock(label, value) {
    if (!value) {
      return null;
    }
    var block = createEl("p", "history-text");
    var strong = createEl("strong", "", label + ": ");
    block.appendChild(strong);
    block.appendChild(document.createTextNode(value));
    return block;
  }

  function createHistoryCard(record) {
    var summary = window.BioLogForm.formatRecordSummary(record);
    var card = createEl("article", "history-card");
    var header = createEl("div", "history-card-header");
    header.appendChild(createEl("h3", "", summary.date));
    header.appendChild(createEl("span", "history-updated", summary.updated_at ? "更新: " + summary.updated_at : ""));
    card.appendChild(header);

    var metrics = createEl("div", "metric-list");
    if (summary.measurements.length) {
      summary.measurements.forEach(function (item) {
        metrics.appendChild(createEl("span", "metric-chip", item));
      });
    } else {
      metrics.appendChild(createEl("span", "muted-text", "測定値なし"));
    }
    card.appendChild(metrics);

    [textBlock("食事", summary.meal_detail), textBlock("行動", summary.activity_log), textBlock("メモ", summary.memo)]
      .filter(Boolean)
      .forEach(function (block) {
        card.appendChild(block);
      });

    var actions = createEl("div", "card-actions");
    var edit = createEl("button", "secondary-button", "編集");
    edit.type = "button";
    edit.addEventListener("click", function () {
      startEdit(record);
    });

    var del = createEl("button", "danger-button", "削除");
    del.type = "button";
    del.addEventListener("click", function () {
      deleteHistoryRecord(record);
    });

    actions.appendChild(edit);
    actions.appendChild(del);
    card.appendChild(actions);
    return card;
  }

  function renderHistory() {
    clearMessage(els.historyMessage);
    return window.BioLogDB.getAllRecords().then(function (records) {
      els.historyList.innerHTML = "";
      if (!records.length) {
        els.historyList.appendChild(createEl("p", "placeholder-text", "まだ記録がありません。"));
        return;
      }

      records.forEach(function (record) {
        els.historyList.appendChild(createHistoryCard(record));
      });
    }).catch(function () {
      showMessage(els.historyMessage, "履歴の読み込みに失敗しました。", "error");
    });
  }

  function renderGraphs() {
    clearMessage(els.graphMessage);
    return window.BioLogDB.getAllRecords().then(function (records) {
      window.BioLogCharts.renderCharts(els.graphList, records);
    }).catch(function () {
      showMessage(els.graphMessage, "グラフの読み込みに失敗しました。", "error");
    });
  }

  function dateEditForm() {
    return document.getElementById("date-edit-form");
  }

  function setDateEditSubmitEnabled(enabled) {
    var form = dateEditForm();
    var submit = form ? form.querySelector("button[type='submit']") : null;
    if (submit) {
      submit.disabled = !enabled;
    }
  }

  function resetDateEditForm() {
    var form = dateEditForm();
    state.dateEditDate = "";
    state.dateEditRecord = null;
    state.dateEditLoaded = false;

    if (form) {
      window.BioLogForm.fillFormFromRecord(form, {});
      clearFormErrors(form);
    }

    setDateEditSubmitEnabled(false);
  }

  function handleDateEditDateChange() {
    resetDateEditForm();
    clearMessage(els.dateEditMessage);
  }

  function handleDateEditLoad() {
    var form = dateEditForm();
    var date = els.dateEditDate.value;
    resetDateEditForm();
    clearMessage(els.dateEditMessage);

    if (!isRealDateString(date)) {
      showMessage(els.dateEditMessage, "対象日を選択してください。", "error");
      return;
    }

    window.BioLogDB.getRecordByDate(date).then(function (record) {
      state.dateEditDate = date;
      state.dateEditRecord = record || null;
      state.dateEditLoaded = true;
      window.BioLogForm.fillFormFromRecord(form, record || { date: date });
      setDateEditSubmitEnabled(true);
      showMessage(els.dateEditMessage, record ? "既存の記録を読み込みました。" : "新規登録できます。", "success");
    }).catch(function () {
      showMessage(els.dateEditMessage, "対象日の読み込みに失敗しました。", "error");
    });
  }

  function handleDateEditSubmit(event) {
    event.preventDefault();
    var form = event.currentTarget;
    clearFormErrors(form);
    clearMessage(els.dateEditMessage);

    if (!state.dateEditLoaded || !state.dateEditDate) {
      showFormMessage(form, "先に対象日を読み込んでください。", "error");
      return;
    }

    var payload = window.BioLogForm.buildPayloadFromForm(form);
    if (payload.date !== state.dateEditDate || els.dateEditDate.value !== state.dateEditDate) {
      resetDateEditForm();
      showFormMessage(form, "対象日が変更されています。もう一度読み込んでください。", "error");
      return;
    }

    payload.date = state.dateEditDate;
    var mode = state.dateEditRecord ? "update" : "create";
    var result = window.BioLogForm.validatePayload(payload, mode);

    if (!result.valid) {
      showFormErrors(form, result.errors);
      return;
    }

    window.BioLogDB.upsertRecord(payload).then(function (record) {
      state.dateEditRecord = record;
      window.BioLogForm.fillFormFromRecord(form, record);
      showFormMessage(form, "保存しました。", "success");
      return Promise.all([loadTodayRecord(), renderHistory(), refreshGraphsIfVisible(), renderStorageStatus()]);
    }).catch(function () {
      showFormMessage(form, "保存に失敗しました。", "error");
    });
  }

  function startEdit(record) {
    var form = document.getElementById("edit-form");
    state.editingDate = record.date;
    els.editFormHost.hidden = false;
    window.BioLogForm.fillFormFromRecord(form, record);
    clearFormErrors(form);
    clearMessage(els.historyMessage);
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function cancelEdit() {
    var form = document.getElementById("edit-form");
    state.editingDate = "";
    els.editFormHost.hidden = true;
    if (form) {
      clearFormErrors(form);
    }
    clearMessage(els.historyMessage);
  }

  function handleEditSubmit(event) {
    event.preventDefault();
    var form = event.currentTarget;
    clearFormErrors(form);
    clearMessage(els.historyMessage);

    var payload = window.BioLogForm.buildPayloadFromForm(form);
    payload.date = state.editingDate || payload.date;
    var result = window.BioLogForm.validatePayload(payload, "update");

    if (!result.valid) {
      showFormErrors(form, result.errors);
      return;
    }

    window.BioLogDB.upsertRecord(payload).then(function (record) {
      state.editingDate = record.date;
      window.BioLogForm.fillFormFromRecord(form, record);
      showFormMessage(form, "更新しました。", "success");
      clearMessage(els.historyMessage);
      return Promise.all([loadTodayRecord(), renderHistory(), refreshGraphsIfVisible(), renderStorageStatus()]);
    }).catch(function () {
      showFormMessage(form, "更新に失敗しました。", "error");
    });
  }

  function deleteHistoryRecord(record) {
    if (!window.confirm(record.date + " の記録を削除しますか？")) {
      return;
    }

    window.BioLogDB.deleteRecord(record.id).then(function () {
      if (state.dateEditDate === record.date) {
        resetDateEditForm();
      }
      showMessage(els.historyMessage, "削除しました。", "success");
      return Promise.all([loadTodayRecord(), renderHistory(), refreshGraphsIfVisible(), renderStorageStatus()]);
    }).catch(function () {
      showMessage(els.historyMessage, "削除に失敗しました。", "error");
    });
  }

  function handleExport() {
    clearMessage(els.backupMessage);
    window.BioLogDB.getAllRecords().then(function (records) {
      var payload = window.BioLogBackup.buildExportPayload(records);
      var fileName = window.BioLogBackup.makeExportFileName();
      window.BioLogBackup.downloadJson(payload, fileName);
      showMessage(els.backupMessage, fileName + " を書き出しました。", "success");
      return renderStorageStatus();
    }).catch(function () {
      showMessage(els.backupMessage, "JSONの書き出しに失敗しました。", "error");
    });
  }

  function handleImportFileChange() {
    els.importButton.disabled = !els.importFile.files.length;
  }

  function handleCsvFileChange() {
    els.csvButton.disabled = !els.csvFile.files.length;
  }

  function handleImport() {
    clearMessage(els.backupMessage);

    if (!els.importFile.files.length) {
      showMessage(els.backupMessage, "JSONファイルを選択してください。", "error");
      return;
    }

    var file = els.importFile.files[0];
    file.text().then(function (text) {
      var payload = window.BioLogBackup.parseImportJson(text);
      var validation = window.BioLogBackup.validateImportPayload(payload);

      if (!validation.valid) {
        throw new Error(validation.errors.join("\n"));
      }

      return window.BioLogBackup.importRecords(validation.records);
    }).then(function (result) {
      showMessage(els.backupMessage, result.imported + "件を読み込みました。追加: " + result.added + " / 更新: " + result.updated, "success");
      els.importFile.value = "";
      els.importButton.disabled = true;
      return Promise.all([loadTodayRecord(), renderHistory(), refreshGraphsIfVisible(), renderStorageStatus()]);
    }).catch(function (error) {
      showMessage(els.backupMessage, error.message || "JSONの読み込みに失敗しました。", "error");
    });
  }

  function handleCsvImport() {
    clearMessage(els.backupMessage);

    if (!els.csvFile.files.length) {
      showMessage(els.backupMessage, "CSVファイルを選択してください。", "error");
      return;
    }

    els.csvFile.files[0].text().then(function (text) {
      return window.BioLogCsv.importCsvText(text);
    }).then(function (result) {
      showMessage(els.backupMessage, result.imported + "件のCSVを読み込みました。追加: " + result.added + " / 更新: " + result.updated, "success");
      els.csvFile.value = "";
      els.csvButton.disabled = true;
      return Promise.all([loadTodayRecord(), renderHistory(), refreshGraphsIfVisible(), renderStorageStatus()]);
    }).catch(function (error) {
      showMessage(els.backupMessage, error.message || "CSVの読み込みに失敗しました。", "error");
    });
  }

  function handleDeleteAll() {
    clearMessage(els.backupMessage);

    if (!window.confirm("すべての記録を削除しますか？")) {
      return;
    }

    window.BioLogDB.deleteAllRecords().then(function () {
      state.todayRecord = null;
      cancelEdit();
      resetDateEditForm();
      showMessage(els.backupMessage, "すべての記録を削除しました。", "success");
      return Promise.all([loadTodayRecord(), renderHistory(), refreshGraphsIfVisible(), renderStorageStatus()]);
    }).catch(function () {
      showMessage(els.backupMessage, "全削除に失敗しました。", "error");
    });
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) {
      setStatus("端末内に保存できます。");
      return Promise.resolve();
    }

    if (!window.isSecureContext) {
      setStatus("端末内に保存できます。");
      return Promise.resolve();
    }

    return navigator.serviceWorker.register("./service-worker.js", { scope: "./" })
      .then(function () {
        setStatus("端末内に保存できます。オフライン起動の準備も完了しました。");
      })
      .catch(function (error) {
        console.warn("Service worker registration failed.", error);
        setStatus("端末内に保存できます。");
      });
  }

  function bindTabs() {
    document.querySelectorAll("[data-view-target]").forEach(function (button) {
      button.addEventListener("click", function () {
        activateView(button.dataset.viewTarget);
      });
    });
  }

  function bindBackupControls() {
    els.exportButton.addEventListener("click", handleExport);
    els.importFile.addEventListener("change", handleImportFileChange);
    els.importButton.addEventListener("click", handleImport);
    els.csvFile.addEventListener("change", handleCsvFileChange);
    els.csvButton.addEventListener("click", handleCsvImport);
    els.deleteAllButton.addEventListener("click", handleDeleteAll);
  }

  function bindDateEditControls() {
    els.dateEditDate.addEventListener("change", handleDateEditDateChange);
    els.dateEditLoadButton.addEventListener("click", handleDateEditLoad);
  }

  function initForms() {
    els.dateEditDate.value = window.BioLogDB.localDateYYYYMMDD();

    var todayForm = createForm("today-form", "today", "今日の記録を保存");
    els.todayFormHost.appendChild(todayForm);
    todayForm.addEventListener("submit", handleTodaySubmit);

    var dateEditFormElement = createForm("date-edit-form", "date-edit", "保存する");
    els.dateEditFormHost.appendChild(dateEditFormElement);
    dateEditFormElement.addEventListener("submit", handleDateEditSubmit);
    setDateEditSubmitEnabled(false);

    var editTitle = createEl("div", "section-header");
    editTitle.appendChild(createEl("p", "eyebrow", "Edit"));
    editTitle.appendChild(createEl("h2", "", "履歴を編集"));
    els.editFormHost.appendChild(editTitle);

    var editForm = createForm("edit-form", "edit", "更新する");
    els.editFormHost.appendChild(editForm);
    editForm.addEventListener("submit", handleEditSubmit);
    editForm.querySelector("[data-action='cancel-edit']").addEventListener("click", cancelEdit);
  }

  function cacheElements() {
    els.status = document.getElementById("sw-status");
    els.topTodaySummary = document.getElementById("top-today-summary");
    els.todayDateLabel = document.getElementById("today-date-label");
    els.todayMessage = document.getElementById("today-message");
    els.todayFormHost = document.getElementById("today-form-host");
    els.dateEditDate = document.getElementById("date-edit-date");
    els.dateEditLoadButton = document.getElementById("date-edit-load-button");
    els.dateEditMessage = document.getElementById("date-edit-message");
    els.dateEditFormHost = document.getElementById("date-edit-form-host");
    els.historyMessage = document.getElementById("history-message");
    els.historyList = document.getElementById("history-list");
    els.graphMessage = document.getElementById("graph-message");
    els.graphList = document.getElementById("graph-list");
    els.editFormHost = document.getElementById("edit-form-host");
    els.backupMessage = document.getElementById("backup-message");
    els.storageStatusList = document.getElementById("storage-status-list");
    els.storageStatusWarning = document.getElementById("storage-status-warning");
    els.exportButton = document.getElementById("export-json-button");
    els.importFile = document.getElementById("import-json-file");
    els.importButton = document.getElementById("import-json-button");
    els.csvFile = document.getElementById("import-csv-file");
    els.csvButton = document.getElementById("import-csv-button");
    els.deleteAllButton = document.getElementById("delete-all-button");
    els.themeToggle = document.getElementById("theme-toggle");
  }

  window.addEventListener("load", function () {
    cacheElements();

    if (!window.BioLogDB || !window.BioLogForm || !window.BioLogBackup || !window.BioLogCharts || !window.BioLogCsv) {
      setStatus("必要な機能を読み込めませんでした。");
      return;
    }

    applyTheme(initialTheme(), false);
    bindThemeControl();
    bindServiceWorkerReload();
    bindTabs();
    bindBackupControls();
    bindDateEditControls();
    initForms();
    bindPullRefresh();

    window.BioLogDB.openDB()
      .then(function (db) {
        db.close();
        return registerServiceWorker();
      })
      .then(function () {
        return Promise.all([loadTodayRecord(), renderStorageStatus(), showStartupStorageHint()]);
      })
      .catch(function () {
        setStatus("保存機能の起動に失敗しました。");
      });
  });
}());
