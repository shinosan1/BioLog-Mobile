(function () {
  "use strict";

  var USER_ID = "self";
  var HEADER_MAP = {
    id: "id",
    date: "date",
    weight: "weight",
    temperature: "temperature",
    systolic_bp: "systolic_bp",
    diastolic_bp: "diastolic_bp",
    pulse: "pulse",
    body_fat: "body_fat",
    bmr: "bmr",
    muscle_mass: "muscle_mass",
    meal_detail: "meal_detail",
    activity_log: "activity_log",
    memo: "memo",
    "対象日": "date",
    "日付": "date",
    "体重": "weight",
    "体重(kg)": "weight",
    "体温": "temperature",
    "体温(℃)": "temperature",
    "収縮期血圧": "systolic_bp",
    "拡張期血圧": "diastolic_bp",
    "脈拍": "pulse",
    "脈拍(bpm)": "pulse",
    "体脂肪率": "body_fat",
    "体脂肪率(%)": "body_fat",
    "基礎代謝": "bmr",
    "基礎代謝量": "bmr",
    "基礎代謝(kcal)": "bmr",
    "筋肉量": "muscle_mass",
    "筋肉量(kg)": "muscle_mass",
    "食事ログ": "meal_detail",
    "行動ログ": "activity_log",
    "メモ": "memo",
    "ユーザー": "__ignore__:ユーザー",
    "記録日時": "__ignore__:記録日時"
  };

  function hasOwn(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
  }

  function measurementFields() {
    return window.BioLogForm ? window.BioLogForm.MEASUREMENT_FIELDS : [];
  }

  function textFields() {
    return window.BioLogForm ? window.BioLogForm.TEXT_FIELDS : [];
  }

  function makeDateUser(date) {
    if (window.BioLogDB && window.BioLogDB.makeDateUser) {
      return window.BioLogDB.makeDateUser(USER_ID, date);
    }
    return USER_ID + "::" + date;
  }

  function stripBom(text) {
    var value = String(text || "");
    return value.charCodeAt(0) === 0xFEFF ? value.slice(1) : value;
  }

  function isNewline(char) {
    return char === "\n" || char === "\r";
  }

  function parseCsv(text) {
    var input = stripBom(text);
    var rows = [];
    var errors = [];
    var cells = [];
    var field = "";
    var inQuotes = false;
    var afterQuote = false;
    var rowHasContent = false;
    var lineNumber = 1;
    var rowLineNumber = 1;
    var i;

    function pushField() {
      cells.push(field);
      field = "";
      afterQuote = false;
    }

    function pushRow() {
      pushField();
      rows.push({
        cells: cells,
        lineNumber: rowLineNumber,
        emptyLine: !rowHasContent
      });
      cells = [];
      field = "";
      rowHasContent = false;
      afterQuote = false;
      rowLineNumber = lineNumber + 1;
    }

    function consumeNewline(index, shouldPushRow) {
      if (input[index] === "\r" && input[index + 1] === "\n") {
        if (shouldPushRow) {
          pushRow();
        }
        lineNumber += 1;
        return index + 1;
      }
      if (shouldPushRow) {
        pushRow();
      }
      lineNumber += 1;
      return index;
    }

    for (i = 0; i < input.length; i += 1) {
      var char = input[i];

      if (inQuotes) {
        if (char === "\"") {
          if (input[i + 1] === "\"") {
            field += "\"";
            i += 1;
          } else {
            inQuotes = false;
            afterQuote = true;
          }
        } else if (isNewline(char)) {
          field += "\n";
          i = consumeNewline(i, false);
        } else {
          field += char;
        }
        continue;
      }

      if (afterQuote) {
        if (char === ",") {
          pushField();
        } else if (isNewline(char)) {
          i = consumeNewline(i, true);
        } else if (char !== " " && char !== "\t") {
          errors.push(lineNumber + "行目: クォート終了後に不正な文字があります。");
          break;
        }
        continue;
      }

      if (char === "\"") {
        if (field !== "") {
          errors.push(lineNumber + "行目: クォートの位置が不正です。");
          break;
        }
        inQuotes = true;
        rowHasContent = true;
      } else if (char === ",") {
        rowHasContent = true;
        pushField();
      } else if (isNewline(char)) {
        i = consumeNewline(i, true);
      } else {
        field += char;
        rowHasContent = true;
      }
    }

    if (inQuotes) {
      errors.push(lineNumber + "行目: クォートが閉じられていません。");
    }

    if (!errors.length && (rowHasContent || field !== "" || cells.length > 0)) {
      pushField();
      rows.push({
        cells: cells,
        lineNumber: rowLineNumber,
        emptyLine: !rowHasContent
      });
    }

    while (rows.length && rows[rows.length - 1].emptyLine) {
      rows.pop();
    }

    return {
      valid: errors.length === 0,
      errors: errors,
      rows: errors.length ? [] : rows
    };
  }

  function rowCells(row) {
    return Array.isArray(row) ? row : row.cells;
  }

  function rowNumber(row, fallback) {
    return row && row.lineNumber ? row.lineNumber : fallback;
  }

  function isEmptyLine(row) {
    return row && row.emptyLine === true;
  }

  function mapCsvHeaders(headers) {
    var errors = [];
    var fields = [];
    var seen = {};

    if (!Array.isArray(headers) || !headers.length) {
      return { valid: false, errors: ["ヘッダー行がありません。"], fields: [] };
    }

    headers.forEach(function (header, index) {
      var name = String(header || "").trim();
      var field = HEADER_MAP[name];

      if (!name) {
        errors.push("ヘッダー" + (index + 1) + "列目が空です。");
        return;
      }

      if (!field) {
        errors.push("未対応のCSVカラムです: " + name);
        return;
      }

      if (seen[field]) {
        errors.push("CSVカラムが重複しています: " + name);
        return;
      }

      seen[field] = true;
      fields.push(field);
    });

    return {
      valid: errors.length === 0,
      errors: errors,
      fields: errors.length ? [] : fields
    };
  }

  function isRealDate(value) {
    var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    var date;
    var year;
    var month;
    var day;

    if (!match) {
      return false;
    }

    year = Number(match[1]);
    month = Number(match[2]);
    day = Number(match[3]);
    date = new Date(year, month - 1, day);

    return date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day;
  }

  function parseMeasurement(rawValue, field, errors, lineNumber) {
    var trimmed = String(rawValue === undefined || rawValue === null ? "" : rawValue).trim();
    var value;

    if (trimmed === "") {
      return undefined;
    }

    value = Number(trimmed);
    if (!Number.isFinite(value)) {
      errors.push(lineNumber + "行目: " + field.label + "は数値で入力してください。");
      return undefined;
    }

    if (field.type === "int" && !Number.isInteger(value)) {
      errors.push(lineNumber + "行目: " + field.label + "は整数で入力してください。");
      return undefined;
    }

    if (value < field.min || value > field.max) {
      errors.push(lineNumber + "行目: " + field.label + "は" + field.min + "〜" + field.max + "の範囲で入力してください。");
      return undefined;
    }

    return value;
  }

  function normalizeCsvRecord(row, lineNumber) {
    var errors = [];
    var date = String(row.date === undefined || row.date === null ? "" : row.date).trim();
    var record;
    var hasContent = false;

    if (!date) {
      errors.push(lineNumber + "行目: date は必須です。");
    } else if (!isRealDate(date)) {
      errors.push(lineNumber + "行目: date は実在する YYYY-MM-DD 形式の日付にしてください。");
    }

    record = {
      user_id: USER_ID,
      date: date,
      date_user: makeDateUser(date)
    };

    measurementFields().forEach(function (field) {
      var value;

      if (!hasOwn(row, field.name)) {
        return;
      }

      value = parseMeasurement(row[field.name], field, errors, lineNumber);
      if (value !== undefined) {
        record[field.name] = value;
        hasContent = true;
      }
    });

    textFields().forEach(function (field) {
      var value;

      if (!hasOwn(row, field.name)) {
        return;
      }

      value = String(row[field.name] === undefined || row[field.name] === null ? "" : row[field.name]);
      if (value.trim() !== "") {
        record[field.name] = value;
        hasContent = true;
      }
    });

    if (!hasContent) {
      errors.push(lineNumber + "行目: 測定値またはテキストを1つ以上入力してください。");
    }

    return {
      valid: errors.length === 0,
      errors: errors,
      record: errors.length ? null : record
    };
  }

  function buildRawRow(cells, fields) {
    var row = {};

    fields.forEach(function (field, index) {
      if (field !== "id" && field.indexOf("__ignore__:") !== 0) {
        row[field] = cells[index] === undefined ? "" : cells[index];
      }
    });

    return row;
  }

  function validateCsvRows(rows) {
    var errors = [];
    var records = [];
    var seenDates = {};
    var headerMapping;

    if (!Array.isArray(rows) || !rows.length) {
      return { valid: false, errors: ["CSVにヘッダー行がありません。"], records: [] };
    }

    if (isEmptyLine(rows[0])) {
      return { valid: false, errors: ["1行目にヘッダー行がありません。"], records: [] };
    }

    headerMapping = mapCsvHeaders(rowCells(rows[0]));
    if (!headerMapping.valid) {
      return { valid: false, errors: headerMapping.errors, records: [] };
    }

    if (rows.length <= 1) {
      return { valid: false, errors: ["CSVにデータ行がありません。"], records: [] };
    }

    rows.slice(1).forEach(function (row, index) {
      var line = rowNumber(row, index + 2);
      var cells = rowCells(row);
      var normalized;
      var rawRow;

      if (isEmptyLine(row)) {
        errors.push(line + "行目: 途中の空行は読み込めません。");
        return;
      }

      if (cells.length !== headerMapping.fields.length) {
        errors.push(line + "行目: ヘッダーと列数が一致しません。");
        return;
      }

      rawRow = buildRawRow(cells, headerMapping.fields);
      normalized = normalizeCsvRecord(rawRow, line);

      if (!normalized.valid) {
        errors = errors.concat(normalized.errors);
        return;
      }

      if (seenDates[normalized.record.date]) {
        errors.push(line + "行目: 同じ日付がCSV内で重複しています。");
        return;
      }

      seenDates[normalized.record.date] = true;
      records.push(normalized.record);
    });

    return {
      valid: errors.length === 0,
      errors: errors,
      records: errors.length ? [] : records
    };
  }

  function importCsvText(text) {
    var parsed = parseCsv(text);
    var validation;

    if (!parsed.valid) {
      return Promise.reject(new Error(parsed.errors.join("\n")));
    }

    validation = validateCsvRows(parsed.rows);
    if (!validation.valid) {
      return Promise.reject(new Error(validation.errors.join("\n")));
    }

    return window.BioLogDB.importRecordsAtomic(validation.records);
  }

  window.BioLogCsv = {
    parseCsv: parseCsv,
    mapCsvHeaders: mapCsvHeaders,
    validateCsvRows: validateCsvRows,
    normalizeCsvRecord: normalizeCsvRecord,
    importCsvText: importCsvText
  };
}());
