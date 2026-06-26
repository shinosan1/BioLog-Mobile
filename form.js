(function () {
  "use strict";

  var MEASUREMENT_FIELDS = [
    { name: "weight", label: "体重", unit: "kg", type: "float", min: 0.1, max: 299.9, step: "0.1" },
    { name: "temperature", label: "体温", unit: "℃", type: "float", min: 34.0, max: 42.0, step: "0.1" },
    { name: "systolic_bp", label: "収縮期(血圧上)", unit: "mmHg", type: "int", min: 50, max: 250, step: "1" },
    { name: "diastolic_bp", label: "拡張期(血圧下)", unit: "mmHg", type: "int", min: 30, max: 150, step: "1" },
    { name: "pulse", label: "脈拍", unit: "bpm", type: "int", min: 30, max: 200, step: "1" },
    { name: "body_fat", label: "体脂肪率", unit: "%", type: "float", min: 0.0, max: 100.0, step: "0.1" },
    { name: "bmr", label: "基礎代謝", unit: "kcal", type: "int", min: 1, max: 4999, step: "1" },
    { name: "muscle_mass", label: "筋肉量", unit: "kg", type: "float", min: 0.1, max: 199.9, step: "0.1" }
  ];

  var TEXT_FIELDS = [
    { name: "meal_detail", label: "食事ログ" },
    { name: "activity_log", label: "行動ログ" },
    { name: "memo", label: "メモ" }
  ];

  function fieldByName(name) {
    return MEASUREMENT_FIELDS.find(function (field) {
      return field.name === name;
    });
  }

  function hasOwn(source, key) {
    return Object.prototype.hasOwnProperty.call(source, key);
  }

  function isTextPresent(payload) {
    return TEXT_FIELDS.some(function (field) {
      return typeof payload[field.name] === "string" && payload[field.name].trim() !== "";
    });
  }

  function isMeasurementPresent(payload) {
    return MEASUREMENT_FIELDS.some(function (field) {
      return hasOwn(payload, field.name);
    });
  }

  function castMeasurement(field, rawValue) {
    if (rawValue === "") {
      return undefined;
    }

    var value = Number(rawValue);
    if (!Number.isFinite(value)) {
      return NaN;
    }

    if (field.type === "int") {
      return Number.isInteger(value) ? value : NaN;
    }

    return value;
  }

  function validatePayload(payload, mode) {
    var errors = [];

    MEASUREMENT_FIELDS.forEach(function (field) {
      if (!hasOwn(payload, field.name)) {
        return;
      }

      var value = payload[field.name];
      if (typeof value !== "number" || !Number.isFinite(value)) {
        errors.push(field.label + "は数値で入力してください。");
        return;
      }

      if (field.type === "int" && !Number.isInteger(value)) {
        errors.push(field.label + "は整数で入力してください。");
        return;
      }

      if (value < field.min || value > field.max) {
        errors.push(field.label + "は" + field.min + "〜" + field.max + "の範囲で入力してください。");
      }
    });

    if (mode === "create" && !isMeasurementPresent(payload) && !isTextPresent(payload)) {
      errors.push("数値項目、食事ログ、行動ログ、メモのいずれかを入力してください。");
    }

    return {
      valid: errors.length === 0,
      errors: errors
    };
  }

  function buildPayloadFromForm(formElement) {
    var payload = {};

    if (formElement.elements.date && formElement.elements.date.value) {
      payload.date = formElement.elements.date.value;
    }

    MEASUREMENT_FIELDS.forEach(function (field) {
      var input = formElement.elements[field.name];
      if (!input) {
        return;
      }

      var rawValue = input.value.trim();
      if (rawValue === "") {
        return;
      }

      payload[field.name] = castMeasurement(field, rawValue);
    });

    TEXT_FIELDS.forEach(function (field) {
      var input = formElement.elements[field.name];
      payload[field.name] = input ? input.value : "";
    });

    return payload;
  }

  function fillFormFromRecord(formElement, record) {
    var source = record || {};

    if (formElement.elements.date) {
      formElement.elements.date.value = source.date || "";
    }

    MEASUREMENT_FIELDS.forEach(function (field) {
      var input = formElement.elements[field.name];
      if (input) {
        input.value = source[field.name] === undefined || source[field.name] === null ? "" : String(source[field.name]);
      }
    });

    TEXT_FIELDS.forEach(function (field) {
      var input = formElement.elements[field.name];
      if (input) {
        input.value = source[field.name] || "";
      }
    });
  }

  function clearMeasurementFields(formElement) {
    MEASUREMENT_FIELDS.forEach(function (field) {
      var input = formElement.elements[field.name];
      if (input) {
        input.value = "";
      }
    });
  }

  function formatValue(record, field) {
    var value = record[field.name];
    if (value === undefined || value === null || value === "") {
      return "";
    }
    return field.label + ": " + value + " " + field.unit;
  }

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function formatDisplayDateTime(value) {
    if (!value) {
      return "";
    }

    var date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "";
    }

    return [
      date.getFullYear(),
      "-",
      pad2(date.getMonth() + 1),
      "-",
      pad2(date.getDate()),
      " ",
      pad2(date.getHours()),
      ":",
      pad2(date.getMinutes())
    ].join("");
  }

  function formatRecordSummary(record) {
    var measurements = MEASUREMENT_FIELDS.map(function (field) {
      return formatValue(record, field);
    }).filter(Boolean);

    return {
      date: record.date || "",
      measurements: measurements,
      meal_detail: record.meal_detail || "",
      activity_log: record.activity_log || "",
      memo: record.memo || "",
      updated_at: formatDisplayDateTime(record.updated_at)
    };
  }

  window.BioLogForm = {
    MEASUREMENT_FIELDS: MEASUREMENT_FIELDS,
    TEXT_FIELDS: TEXT_FIELDS,
    fieldByName: fieldByName,
    validatePayload: validatePayload,
    buildPayloadFromForm: buildPayloadFromForm,
    fillFormFromRecord: fillFormFromRecord,
    clearMeasurementFields: clearMeasurementFields,
    formatDisplayDateTime: formatDisplayDateTime,
    formatRecordSummary: formatRecordSummary
  };
}());
