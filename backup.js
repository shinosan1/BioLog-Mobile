(function () {
  "use strict";

  var APP_NAME = "BioLog Mobile";
  var EXPORT_VERSION = 1;
  var TEXT_FIELDS = ["meal_detail", "activity_log", "memo"];
  var META_KEYS = ["id", "request_id", "user_id", "date", "date_user", "created_at", "updated_at"];

  function measurementFields() {
    return window.BioLogForm ? window.BioLogForm.MEASUREMENT_FIELDS : [];
  }

  function allowedKeys() {
    return META_KEYS.concat(measurementFields().map(function (field) {
      return field.name;
    })).concat(TEXT_FIELDS);
  }

  function hasOwn(source, key) {
    return Object.prototype.hasOwnProperty.call(source, key);
  }

  function localDate(date) {
    return window.BioLogDB.localDateYYYYMMDD(date || new Date());
  }

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function pad3(value) {
    return String(value).padStart(3, "0");
  }

  function formatLocalIsoWithOffset(date) {
    var value = date || new Date();
    var offsetMinutes = value.getTimezoneOffset();
    var offsetSign = offsetMinutes <= 0 ? "+" : "-";
    var absoluteOffset = Math.abs(offsetMinutes);
    var offsetHours = Math.floor(absoluteOffset / 60);
    var offsetRemainderMinutes = absoluteOffset % 60;

    return [
      value.getFullYear(),
      "-",
      pad2(value.getMonth() + 1),
      "-",
      pad2(value.getDate()),
      "T",
      pad2(value.getHours()),
      ":",
      pad2(value.getMinutes()),
      ":",
      pad2(value.getSeconds()),
      ".",
      pad3(value.getMilliseconds()),
      offsetSign,
      pad2(offsetHours),
      ":",
      pad2(offsetRemainderMinutes)
    ].join("");
  }

  function normalizeExportRecord(record) {
    var normalized = Object.assign({}, record);

    TEXT_FIELDS.forEach(function (key) {
      normalized[key] = typeof normalized[key] === "string" ? normalized[key] : "";
    });

    return normalized;
  }

  function buildExportPayload(records) {
    return {
      app: APP_NAME,
      version: EXPORT_VERSION,
      exported_at: formatLocalIsoWithOffset(),
      records: Array.isArray(records) ? records.map(function (record) {
        return normalizeExportRecord(record);
      }) : []
    };
  }

  function makeExportFileName(date) {
    return "biolog-mobile-backup-" + localDate(date) + ".json";
  }

  function downloadJson(payload, fileName) {
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function parseImportJson(text) {
    try {
      return JSON.parse(text);
    } catch (error) {
      throw new Error("JSONを読み込めませんでした。");
    }
  }

  function isPlainObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function isRealDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return false;
    }
    var parts = value.split("-").map(Number);
    var date = new Date(parts[0], parts[1] - 1, parts[2]);
    return date.getFullYear() === parts[0] && date.getMonth() === parts[1] - 1 && date.getDate() === parts[2];
  }

  function validateMeasurement(record, field, errors, index) {
    if (!hasOwn(record, field.name)) {
      return;
    }

    var value = record[field.name];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      errors.push("records[" + index + "]." + field.name + " は有限の数値である必要があります。");
      return;
    }

    if (field.type === "int" && !Number.isInteger(value)) {
      errors.push("records[" + index + "]." + field.name + " は整数である必要があります。");
      return;
    }

    if (value < field.min || value > field.max) {
      errors.push("records[" + index + "]." + field.name + " が範囲外です。");
    }
  }

  function hasContent(record) {
    var hasMeasurement = measurementFields().some(function (field) {
      return hasOwn(record, field.name);
    });
    var hasText = TEXT_FIELDS.some(function (field) {
      return typeof record[field] === "string" && record[field].trim() !== "";
    });
    return hasMeasurement || hasText;
  }

  function validateRecord(record, index, seen, errors) {
    if (!isPlainObject(record)) {
      errors.push("records[" + index + "] はobjectである必要があります。");
      return;
    }

    var keys = allowedKeys();
    Object.keys(record).forEach(function (key) {
      if (keys.indexOf(key) === -1) {
        errors.push("records[" + index + "]." + key + " は未対応のキーです。");
      }
    });

    if (!isRealDate(record.date)) {
      errors.push("records[" + index + "].date は実在するYYYY-MM-DD日付である必要があります。");
    }

    if (hasOwn(record, "user_id") && record.user_id !== "self") {
      errors.push("records[" + index + "].user_id は self のみ対応です。");
    }

    if (hasOwn(record, "id") && typeof record.id !== "number") {
      errors.push("records[" + index + "].id は数値である必要があります。");
    }

    ["request_id", "date_user", "created_at", "updated_at"].forEach(function (key) {
      if (hasOwn(record, key) && typeof record[key] !== "string") {
        errors.push("records[" + index + "]." + key + " は文字列である必要があります。");
      }
    });

    TEXT_FIELDS.forEach(function (key) {
      if (hasOwn(record, key) && typeof record[key] !== "string") {
        errors.push("records[" + index + "]." + key + " は文字列である必要があります。");
      }
    });

    measurementFields().forEach(function (field) {
      validateMeasurement(record, field, errors, index);
    });

    if (isRealDate(record.date)) {
      var dateUser = "self::" + record.date;
      if (seen[dateUser]) {
        errors.push("records内で同じ日付が重複しています: " + record.date);
      }
      seen[dateUser] = true;
    }

    if (!hasContent(record)) {
      errors.push("records[" + index + "] は数値項目またはテキスト項目を1つ以上含む必要があります。");
    }
  }

  function validateImportPayload(payload) {
    var errors = [];
    var seen = {};

    if (!isPlainObject(payload)) {
      return { valid: false, errors: ["import payload はobjectである必要があります。"], records: [] };
    }

    if (payload.app !== APP_NAME) {
      errors.push("app が BioLog Mobile ではありません。");
    }
    if (payload.version !== EXPORT_VERSION) {
      errors.push("version が 1 ではありません。");
    }
    if (!Array.isArray(payload.records)) {
      errors.push("records は配列である必要があります。");
    }

    if (Array.isArray(payload.records)) {
      payload.records.forEach(function (record, index) {
        validateRecord(record, index, seen, errors);
      });
    }

    return {
      valid: errors.length === 0,
      errors: errors,
      records: errors.length === 0 ? payload.records.map(normalizeImportRecord) : []
    };
  }

  function normalizeImportRecord(record) {
    var normalized = {
      user_id: "self",
      date: record.date,
      date_user: window.BioLogDB.makeDateUser("self", record.date)
    };

    measurementFields().forEach(function (field) {
      if (hasOwn(record, field.name)) {
        normalized[field.name] = record[field.name];
      }
    });

    TEXT_FIELDS.forEach(function (key) {
      if (hasOwn(record, key)) {
        normalized[key] = record[key];
      }
    });

    ["request_id", "created_at", "updated_at"].forEach(function (key) {
      if (hasOwn(record, key)) {
        normalized[key] = record[key];
      }
    });

    return normalized;
  }

  function importRecords(records) {
    return window.BioLogDB.importRecordsAtomic(records);
  }

  window.BioLogBackup = {
    buildExportPayload: buildExportPayload,
    makeExportFileName: makeExportFileName,
    downloadJson: downloadJson,
    parseImportJson: parseImportJson,
    normalizeExportRecord: normalizeExportRecord,
    validateImportPayload: validateImportPayload,
    normalizeImportRecord: normalizeImportRecord,
    formatLocalIsoWithOffset: formatLocalIsoWithOffset,
    importRecords: importRecords
  };
}());
