(async function () {
  "use strict";

  var out = document.getElementById("test-output");
  var form = document.getElementById("fixture-form");
  var lines = [];

  function ok(name, condition) {
    lines.push((condition ? "PASS " : "FAIL ") + name);
    if (!condition) {
      throw new Error(name);
    }
  }

  function setFormValues(values) {
    Array.prototype.forEach.call(form.elements, function (element) {
      element.value = "";
    });
    Object.keys(values).forEach(function (key) {
      form.elements[key].value = values[key];
    });
  }

  function countRecords() {
    return window.BioLogDB.getAllRecords().then(function (records) {
      return records.length;
    });
  }

  function recordsSnapshot() {
    return window.BioLogDB.getAllRecords().then(function (records) {
      return JSON.stringify(records);
    });
  }

  function expectedLocalMinute(value) {
    var date = new Date(value);
    return [
      date.getFullYear(),
      "-",
      String(date.getMonth() + 1).padStart(2, "0"),
      "-",
      String(date.getDate()).padStart(2, "0"),
      " ",
      String(date.getHours()).padStart(2, "0"),
      ":",
      String(date.getMinutes()).padStart(2, "0")
    ].join("");
  }

  try {
    ok("test db name set before db.js", window.BIOLOG_DB_NAME === "biolog_mobile_test");
    await window.BioLogDB.deleteAllRecords();
    ok("test db starts empty", await countRecords() === 0);

    var date = window.BioLogDB.localDateYYYYMMDD(new Date(2026, 5, 26));
    ok("local date", date === "2026-06-26");
    ok("date_user", window.BioLogDB.makeDateUser("self", date) === "self::2026-06-26");

    setFormValues({
      date: date,
      weight: "",
      body_fat: "0",
      meal_detail: "breakfast"
    });
    var payload = window.BioLogForm.buildPayloadFromForm(form);
    ok("empty numeric skipped", !("weight" in payload));
    ok("zero is not empty", payload.body_fat === 0);
    ok("valid text or number create", window.BioLogForm.validatePayload(payload, "create").valid);

    setFormValues({
      date: "2026-06-25",
      memo: "text only"
    });
    var textOnlyPayload = window.BioLogForm.buildPayloadFromForm(form);
    ok("text only create valid", window.BioLogForm.validatePayload(textOnlyPayload, "create").valid);

    setFormValues({
      date: "2026-06-24",
      weight: "0"
    });
    var rangePayload = window.BioLogForm.buildPayloadFromForm(form);
    ok("zero is validated as range error", !window.BioLogForm.validatePayload(rangePayload, "create").valid);

    var first = await window.BioLogDB.upsertRecord({
      date: date,
      weight: 61.2,
      meal_detail: "meal"
    });
    await new Promise(function (resolve) {
      setTimeout(resolve, 5);
    });
    var second = await window.BioLogDB.upsertRecord({
      date: date,
      memo: "updated"
    });
    ok("id is retained", first.id === second.id);
    ok("request_id is retained", first.request_id === second.request_id);
    ok("created_at is retained", first.created_at === second.created_at);
    ok("missing numeric retained", second.weight === 61.2);
    ok("date_user unique upsert", await countRecords() === 1);

    var exportPayload = window.BioLogBackup.buildExportPayload(await window.BioLogDB.getAllRecords());
    ok("export app", exportPayload.app === "BioLog Mobile");
    ok("export version", exportPayload.version === 1);
    ok("export records", exportPayload.records.length === 1);
    ok("exported_at is string", typeof exportPayload.exported_at === "string");
    ok("exported_at is not utc z", !/Z$/.test(exportPayload.exported_at));
    ok("exported_at has offset", /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}$/.test(exportPayload.exported_at));
    ok(
      "export filename",
      window.BioLogBackup.makeExportFileName(new Date(2026, 5, 26)) === "biolog-mobile-backup-2026-06-26.json"
    );
    var localIso = window.BioLogBackup.formatLocalIsoWithOffset(new Date(2026, 5, 26, 10, 18, 29, 52));
    var offset = new Date(2026, 5, 26, 10, 18, 29, 52).getTimezoneOffset();
    var offsetSign = offset <= 0 ? "+" : "-";
    var absoluteOffset = Math.abs(offset);
    var expectedOffset = offsetSign +
      String(Math.floor(absoluteOffset / 60)).padStart(2, "0") +
      ":" +
      String(absoluteOffset % 60).padStart(2, "0");
    ok("local iso date time", localIso.indexOf("2026-06-26T10:18:29.052") === 0);
    ok("local iso offset", localIso.slice(-6) === expectedOffset);

    var utcUpdatedAt = "2026-06-26T01:36:12.847Z";
    var formattedUpdatedAt = window.BioLogForm.formatRecordSummary({
      date: "2026-06-26",
      updated_at: utcUpdatedAt
    }).updated_at;
    ok("updated_at display has no t", formattedUpdatedAt.indexOf("T") === -1);
    ok("updated_at display has no z", formattedUpdatedAt.indexOf("Z") === -1);
    ok("updated_at display format", /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(formattedUpdatedAt));
    ok("updated_at display local time", formattedUpdatedAt === expectedLocalMinute(utcUpdatedAt));
    ok("updated_at empty display", window.BioLogForm.formatRecordSummary({ date: "2026-06-26" }).updated_at === "");
    ok("updated_at invalid display", window.BioLogForm.formatRecordSummary({
      date: "2026-06-26",
      updated_at: "not-a-date"
    }).updated_at === "");

    var chartRecords = [
      { date: "2026-06-28", weight: 62.1, systolic_bp: 124 },
      { date: "2026-06-26", weight: 61.2, systolic_bp: 120, diastolic_bp: 80 },
      { date: "2026-06-27", pulse: 72, diastolic_bp: 82 },
      { date: "2026-06-29", weight: 62.8, systolic_bp: 126, diastolic_bp: 84 }
    ];
    var weightSeries = window.BioLogCharts.buildChartSeries(chartRecords, "weight");
    ok("chart series sorted", weightSeries.map(function (point) {
      return point.date;
    }).join(",") === "2026-06-26,2026-06-28,2026-06-29");
    ok("chart series skips missing", weightSeries.length === 3);

    var bloodPressureSeries = window.BioLogCharts.buildBloodPressureSeries(chartRecords);
    ok("bp systolic series", bloodPressureSeries.systolic.length === 3);
    ok("bp diastolic series", bloodPressureSeries.diastolic.length === 3);
    ok("bp series split", bloodPressureSeries.systolic[0].value === 120 && bloodPressureSeries.diastolic[0].value === 80);

    var emptyChart = window.BioLogCharts.renderLineChart({
      title: "empty",
      seriesList: [{ label: "empty", color: "var(--green)", points: [{ date: "2026-06-26", value: 1 }] }]
    });
    ok("chart empty state", emptyChart.textContent.indexOf("グラフ表示には2件以上") !== -1);

    var flatChart = window.BioLogCharts.renderLineChart({
      title: "flat",
      seriesList: [{ label: "flat", color: "var(--green)", points: [
        { date: "2026-06-26", value: 10 },
        { date: "2026-06-27", value: 10 }
      ] }]
    });
    ok("flat chart svg", !!flatChart.querySelector("svg"));
    ok("chart point hit target", !!flatChart.querySelector(".chart-point-hit"));
    ok("chart point tabindex", flatChart.querySelector(".chart-point-group").getAttribute("tabindex") === "0");
    ok("chart point aria label", flatChart.querySelector(".chart-point-group").getAttribute("aria-label").indexOf("2026-06-26 flat 10") !== -1);
    ok("chart tooltip text", flatChart.querySelector(".chart-tooltip").textContent.indexOf("flat: 10") !== -1);

    var bloodPressureChart = window.BioLogCharts.renderLineChart({
      title: "blood pressure",
      seriesList: [
        { label: "収縮期", color: "var(--green)", unit: "mmHg", points: [
          { date: "2026-06-26", value: 120 },
          { date: "2026-06-27", value: 122 }
        ] },
        { label: "拡張期", color: "var(--red)", unit: "mmHg", points: [
          { date: "2026-06-26", value: 80 },
          { date: "2026-06-27", value: 82 }
        ] }
      ]
    });
    ok("bp tooltip systolic", bloodPressureChart.textContent.indexOf("収縮期: 120 mmHg") !== -1);
    ok("bp tooltip diastolic", bloodPressureChart.textContent.indexOf("拡張期: 80 mmHg") !== -1);

    ok("bad json rejected", !window.BioLogBackup.parseImportJson("{").valid);
    ok("records array required", !window.BioLogBackup.validateImportPayload({
      app: "BioLog Mobile",
      version: 1,
      records: {}
    }).valid);

    var validImport = {
      app: "BioLog Mobile",
      version: 1,
      exported_at: "2026-06-26T00:00:00.000Z",
      records: [{ date: "2026-06-27", user_id: "self", weight: 62.3, memo: "imported" }]
    };
    var validation = window.BioLogBackup.validateImportPayload(validImport);
    ok("valid import", validation.valid);
    ok("normalize date_user", validation.records[0].date_user === "self::2026-06-27");
    ok("normalize ignores id", !("id" in validation.records[0]));

    var duplicate = {
      app: "BioLog Mobile",
      version: 1,
      records: [{ date: "2026-06-28", memo: "a" }, { date: "2026-06-28", memo: "b" }]
    };
    ok("duplicate date rejected", !window.BioLogBackup.validateImportPayload(duplicate).valid);

    var badDate = {
      app: "BioLog Mobile",
      version: 1,
      records: [{ date: "2026-02-31", memo: "bad" }]
    };
    ok("invalid real date rejected", !window.BioLogBackup.validateImportPayload(badDate).valid);

    var unknown = {
      app: "BioLog Mobile",
      version: 1,
      records: [{ date: "2026-06-29", memo: "x", unknown: true }]
    };
    ok("unknown key rejected", !window.BioLogBackup.validateImportPayload(unknown).valid);

    var importRange = {
      app: "BioLog Mobile",
      version: 1,
      records: [{ date: "2026-06-30", weight: 9999 }]
    };
    ok("import range rejected", !window.BioLogBackup.validateImportPayload(importRange).valid);

    var beforeInvalid = await countRecords();
    var invalidValidation = window.BioLogBackup.validateImportPayload(duplicate);
    if (invalidValidation.valid) {
      await window.BioLogBackup.importRecords(invalidValidation.records);
    }
    ok("invalid import unchanged", await countRecords() === beforeInvalid);

    var importResult = await window.BioLogBackup.importRecords(validation.records);
    ok("atomic import result", importResult.imported === 1);
    ok("imported record exists", !!(await window.BioLogDB.getRecordByDate("2026-06-27")));
    ok("import upsert no duplicate date", await countRecords() === 2);

    var simpleCsv = window.BioLogCsv.parseCsv("date,weight,memo\n2026-07-01,63.1,csv memo");
    ok("csv simple parse", simpleCsv.valid && simpleCsv.rows.length === 2);
    var simpleCsvValidation = window.BioLogCsv.validateCsvRows(simpleCsv.rows);
    ok("csv simple validate", simpleCsvValidation.valid);
    ok("csv simple date_user", simpleCsvValidation.records[0].date_user === "self::2026-07-01");

    var bomCsv = window.BioLogCsv.parseCsv("\uFEFF日付,体重,メモ\r\n2026-07-02,64.2,和文\r\n");
    ok("csv bom crlf parse", bomCsv.valid && bomCsv.rows.length === 2);
    ok("csv japanese headers", window.BioLogCsv.validateCsvRows(bomCsv.rows).valid);

    var quotedCsv = window.BioLogCsv.parseCsv("date,memo\n2026-07-03,\"line 1\nline 2, \"\"quote\"\"\"");
    var quotedValidation = window.BioLogCsv.validateCsvRows(quotedCsv.rows);
    ok("csv quoted parse", quotedCsv.valid);
    ok("csv quoted text", quotedValidation.records[0].memo === "line 1\nline 2, \"quote\"");

    ok("csv empty rejected", !window.BioLogCsv.validateCsvRows(window.BioLogCsv.parseCsv("").rows).valid);
    ok("csv header only rejected", !window.BioLogCsv.validateCsvRows(window.BioLogCsv.parseCsv("date,memo").rows).valid);
    ok("csv trailing empty line ignored", window.BioLogCsv.validateCsvRows(
      window.BioLogCsv.parseCsv("date,memo\n2026-07-04,ok\n").rows
    ).valid);
    ok("csv middle empty line rejected", !window.BioLogCsv.validateCsvRows(
      window.BioLogCsv.parseCsv("date,memo\n2026-07-05,ok\n\n2026-07-06,ok").rows
    ).valid);

    ok("csv malformed quote rejected", !window.BioLogCsv.parseCsv("date,memo\n2026-07-07,\"bad").valid);
    ok("csv unknown column rejected", !window.BioLogCsv.validateCsvRows(
      window.BioLogCsv.parseCsv("date,unknown,memo\n2026-07-08,x,memo").rows
    ).valid);
    ok("csv user_id rejected", !window.BioLogCsv.validateCsvRows(
      window.BioLogCsv.parseCsv("date,user_id,memo\n2026-07-09,self,memo").rows
    ).valid);
    ok("csv duplicate normalized header rejected", !window.BioLogCsv.validateCsvRows(
      window.BioLogCsv.parseCsv("date,日付,memo\n2026-07-10,2026-07-10,memo").rows
    ).valid);
    ok("csv duplicate date rejected", !window.BioLogCsv.validateCsvRows(
      window.BioLogCsv.parseCsv("date,memo\n2026-07-11,a\n2026-07-11,b").rows
    ).valid);
    ok("csv invalid real date rejected", !window.BioLogCsv.validateCsvRows(
      window.BioLogCsv.parseCsv("date,memo\n2026-02-31,bad").rows
    ).valid);
    ok("csv range rejected", !window.BioLogCsv.validateCsvRows(
      window.BioLogCsv.parseCsv("date,weight\n2026-07-12,9999").rows
    ).valid);
    ok("csv zero range rejected", !window.BioLogCsv.validateCsvRows(
      window.BioLogCsv.parseCsv("date,weight\n2026-07-13,0").rows
    ).valid);

    var zeroCsv = window.BioLogCsv.validateCsvRows(
      window.BioLogCsv.parseCsv("date,weight,body_fat,memo\n2026-07-14,,0,body").rows
    );
    ok("csv empty numeric omitted", zeroCsv.valid && !("weight" in zeroCsv.records[0]));
    ok("csv zero body fat valid", zeroCsv.records[0].body_fat === 0);

    var textCsv = window.BioLogCsv.validateCsvRows(
      window.BioLogCsv.parseCsv("date,memo\n2026-07-15,\"  spaced  \"").rows
    );
    ok("csv text preserves spaces", textCsv.records[0].memo === "  spaced  ");
    ok("csv whitespace text empty", !window.BioLogCsv.validateCsvRows(
      window.BioLogCsv.parseCsv("date,memo\n2026-07-16,   ").rows
    ).valid);

    var idCsv = window.BioLogCsv.validateCsvRows(
      window.BioLogCsv.parseCsv("id,date,memo\n123,2026-07-17,ok").rows
    );
    ok("csv id ignored", idCsv.valid && !("id" in idCsv.records[0]));

    var biologCsv = window.BioLogCsv.validateCsvRows(
      window.BioLogCsv.parseCsv("id,ユーザー,対象日,記録日時,体重(kg),収縮期血圧,拡張期血圧,体温(℃),脈拍(bpm),基礎代謝(kcal),体脂肪率(%),筋肉量(kg),メモ,食事ログ,行動ログ\n1,自分,2026-07-19,2026-07-19 08:30,66.1,118,76,36.5,70,1500,18.5,48.2,memo,meal,walk").rows
    );
    ok("biolog csv headers valid", biologCsv.valid);
    ok("biolog csv target date", biologCsv.records[0].date === "2026-07-19");
    ok("biolog csv metrics", biologCsv.records[0].weight === 66.1 && biologCsv.records[0].temperature === 36.5);
    ok("biolog csv ignored columns", !("id" in biologCsv.records[0]) && !("ユーザー" in biologCsv.records[0]) && !("記録日時" in biologCsv.records[0]));
    ok("biolog csv date_user", biologCsv.records[0].date_user === "self::2026-07-19");
    ok("biolog csv ignore duplicate rejected", !window.BioLogCsv.validateCsvRows(
      window.BioLogCsv.parseCsv("ユーザー,ユーザー,対象日,メモ\n自分,self,2026-07-20,dup").rows
    ).valid);
    ok("biolog csv normalized duplicate rejected", !window.BioLogCsv.validateCsvRows(
      window.BioLogCsv.parseCsv("対象日,date,メモ\n2026-07-21,2026-07-21,dup").rows
    ).valid);
    ok("biolog csv duplicate date rejected", !window.BioLogCsv.validateCsvRows(
      window.BioLogCsv.parseCsv("対象日,メモ\n2026-07-22,a\n2026-07-22,b").rows
    ).valid);

    var beforeCsvInvalidSnapshot = await recordsSnapshot();
    var csvInvalidRejected = false;
    try {
      await window.BioLogCsv.importCsvText("date,weight,unknown\n2026-06-26,70,x");
    } catch (error) {
      csvInvalidRejected = true;
    }
    ok("invalid csv import rejected", csvInvalidRejected);
    ok("invalid csv import content unchanged", await recordsSnapshot() === beforeCsvInvalidSnapshot);

    var existingBeforeCsv = await window.BioLogDB.getRecordByDate("2026-06-27");
    var csvImportResult = await window.BioLogCsv.importCsvText("date,weight,memo\n2026-07-18,65.5,csv new\n2026-06-27,62.9,csv update");
    var existingAfterCsv = await window.BioLogDB.getRecordByDate("2026-06-27");
    ok("csv import result", csvImportResult.imported === 2 && csvImportResult.added === 1 && csvImportResult.updated === 1);
    ok("csv import upsert value", existingAfterCsv.weight === 62.9);
    ok("csv import retains request_id", existingAfterCsv.request_id === existingBeforeCsv.request_id);
    ok("csv import no duplicate date", await countRecords() === 3);

    var indexText = await fetch("./index.html").then(function (response) {
      return response.text();
    });
    var indexDoc = new DOMParser().parseFromString(indexText, "text/html");
    var ids = Array.prototype.map.call(indexDoc.querySelectorAll("[id]"), function (element) {
      return element.id;
    });
    ok("top title removed", indexText.indexOf("今日の記録を残す") === -1);
    ok("top today summary exists", !!indexDoc.getElementById("top-today-summary"));
    ok("status message separate", !!indexDoc.getElementById("sw-status"));
    ok("date edit tab exists", !!indexDoc.querySelector("[data-view-target='date-edit']"));
    ok("date edit view exists", !!indexDoc.querySelector("[data-view='date-edit']"));
    ok("static ids unique", ids.length === Array.from(new Set(ids)).length);

    var appText = await fetch("./app.js").then(function (response) {
      return response.text();
    });
    ok("app uses local today date", appText.indexOf("localDateYYYYMMDD") !== -1);
    ok("app does not use utc date slice", appText.indexOf("toISOString().slice(0, 10)") === -1);
    ok("date edit mismatch guard", appText.indexOf("対象日が変更されています") !== -1);

    await window.BioLogDB.deleteAllRecords();
    ok("delete all test db only", await countRecords() === 0);

    out.textContent = lines.join("\n");
  } catch (error) {
    lines.push("ERROR " + error.message);
    out.textContent = lines.join("\n");
  }
}());
