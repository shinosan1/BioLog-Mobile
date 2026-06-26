(function () {
  "use strict";

  var state = {
    todayDate: "",
    todayRecord: null,
    editingDate: "",
    dateEditDate: "",
    dateEditRecord: null,
    dateEditLoaded: false
  };

  var els = {};
  var THEME_STORAGE_KEY = "biolog_mobile_theme";
  var LIGHT_THEME_COLOR = "#2E7D32";
  var DARK_THEME_COLOR = "#102116";
  var TOP_SUMMARY_ITEMS = [
    { label: "体重", field: "weight", unit: "kg" },
    { label: "体温", field: "temperature", unit: "℃" },
    { label: "血圧", field: "blood_pressure", unit: "mmHg" },
    { label: "脈拍", field: "pulse", unit: "回/分" }
  ];
  var SUMMARY_ITEMS = [
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
    target.textContent = message;
    target.className = "message message-" + type;
    target.hidden = false;
  }

  function clearMessage(target) {
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
    return form;
  }

  function setFormDate(form, date) {
    if (form.elements.date) {
      form.elements.date.value = date;
    }
  }

  function showFormErrors(form, errors) {
    var error = form.querySelector("[data-role='form-error']");
    showMessage(error, errors.join("\n"), "error");
  }

  function clearFormErrors(form) {
    var error = form.querySelector("[data-role='form-error']");
    clearMessage(error);
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

  function renderSummaryCard(record, sourceText) {
    els.summaryPanel.innerHTML = "";

    if (!record) {
      els.summaryPanel.appendChild(createEl("p", "placeholder-text", "まだ記録がありません。"));
      return;
    }

    var header = createEl("div", "summary-header");
    header.appendChild(createEl("h3", "", "主要指標"));
    header.appendChild(createEl("span", "summary-source", sourceText));
    els.summaryPanel.appendChild(header);

    var grid = createEl("div", "summary-grid");
    SUMMARY_ITEMS.forEach(function (item) {
      var metric = createEl("div", "summary-metric");
      metric.appendChild(createEl("span", "summary-label", item.label));
      metric.appendChild(createEl("strong", "summary-value", summaryMetricValue(record, item)));
      metric.appendChild(createEl("span", "summary-unit", item.unit));
      grid.appendChild(metric);
    });
    els.summaryPanel.appendChild(grid);
  }

  function renderSummary() {
    var todayDate = state.todayDate || window.BioLogDB.localDateYYYYMMDD();

    return window.BioLogDB.getRecordByDate(todayDate).then(function (todayRecord) {
      if (todayRecord) {
        state.todayRecord = todayRecord;
        renderSummaryCard(todayRecord, "今日の記録");
        return;
      }

      state.todayRecord = null;
      renderSummaryCard(null, "");
    }).catch(function () {
      els.summaryPanel.innerHTML = "";
      els.summaryPanel.appendChild(createEl("p", "placeholder-text", "サマリーを読み込めませんでした。"));
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
      return Promise.all([renderTopTodaySummary(), renderSummary()]);
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
      showMessage(els.todayMessage, "保存しました。", "success");
      return Promise.all([renderTopTodaySummary(), renderSummary(), refreshGraphsIfVisible()]);
    }).catch(function () {
      showMessage(els.todayMessage, "保存に失敗しました。", "error");
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
      showMessage(els.dateEditMessage, "先に対象日を読み込んでください。", "error");
      return;
    }

    var payload = window.BioLogForm.buildPayloadFromForm(form);
    if (payload.date !== state.dateEditDate || els.dateEditDate.value !== state.dateEditDate) {
      showMessage(els.dateEditMessage, "対象日が変更されています。もう一度読み込んでください。", "error");
      resetDateEditForm();
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
      showMessage(els.dateEditMessage, "保存しました。", "success");
      return Promise.all([loadTodayRecord(), renderHistory(), refreshGraphsIfVisible()]);
    }).catch(function () {
      showMessage(els.dateEditMessage, "保存に失敗しました。", "error");
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
    state.editingDate = "";
    els.editFormHost.hidden = true;
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

    window.BioLogDB.upsertRecord(payload).then(function () {
      showMessage(els.historyMessage, "更新しました。", "success");
      cancelEdit();
      return Promise.all([loadTodayRecord(), renderHistory(), refreshGraphsIfVisible()]);
    }).catch(function () {
      showMessage(els.historyMessage, "更新に失敗しました。", "error");
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
      return Promise.all([loadTodayRecord(), renderHistory(), refreshGraphsIfVisible()]);
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
      return Promise.all([loadTodayRecord(), renderHistory(), refreshGraphsIfVisible()]);
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
      return Promise.all([loadTodayRecord(), renderHistory(), refreshGraphsIfVisible()]);
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
      return Promise.all([loadTodayRecord(), renderHistory(), refreshGraphsIfVisible()]);
    }).catch(function () {
      showMessage(els.backupMessage, "全削除に失敗しました。", "error");
    });
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) {
      setStatus("端末内に保存できます。");
      return;
    }

    if (!window.isSecureContext) {
      setStatus("端末内に保存できます。");
      return;
    }

    navigator.serviceWorker.register("./service-worker.js", { scope: "./" })
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
    els.summaryPanel = document.getElementById("summary-panel");
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
    bindTabs();
    bindBackupControls();
    bindDateEditControls();
    initForms();

    window.BioLogDB.openDB()
      .then(function (db) {
        db.close();
        registerServiceWorker();
        return loadTodayRecord();
      })
      .catch(function () {
        setStatus("保存機能の起動に失敗しました。");
      });
  });
}());
