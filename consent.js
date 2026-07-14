(function () {
  "use strict";

  var STORAGE_KEY = "biolog_mobile_consent";
  var SCHEMA_VERSION = 1;
  var TERMS_VERSION = "2026-07-14-3";
  var PRIVACY_VERSION = "2026-07-14-2";
  var ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

  function defaultStorage() {
    try {
      return window.localStorage;
    } catch (error) {
      return null;
    }
  }

  function resolveStorage(storage) {
    return storage === undefined ? defaultStorage() : storage;
  }

  function isStorageReadable(storage) {
    return !!storage && typeof storage.getItem === "function";
  }

  function isValidAcceptedAt(value) {
    var date;

    if (typeof value !== "string" || !ISO_TIMESTAMP_PATTERN.test(value)) {
      return false;
    }

    date = new Date(value);
    return !isNaN(date.getTime()) && date.toISOString() === value;
  }

  function isCurrentRecord(record) {
    return !!record &&
      typeof record === "object" &&
      !Array.isArray(record) &&
      record.schemaVersion === SCHEMA_VERSION &&
      record.termsVersion === TERMS_VERSION &&
      record.privacyVersion === PRIVACY_VERSION &&
      isValidAcceptedAt(record.acceptedAt);
  }

  function getCurrentConsent(storage) {
    var target = resolveStorage(storage);
    var raw;
    var record;

    if (!isStorageReadable(target)) {
      return null;
    }

    try {
      raw = target.getItem(STORAGE_KEY);
      if (typeof raw !== "string" || raw === "") {
        return null;
      }
      record = JSON.parse(raw);
    } catch (error) {
      return null;
    }

    return isCurrentRecord(record) ? record : null;
  }

  function hasValidConsent(storage) {
    return getCurrentConsent(storage) !== null;
  }

  function saveConsent(storage, now) {
    var target = resolveStorage(storage);
    var acceptedAt;
    var record;
    var serialized;
    var saved;

    if (!target || typeof target.setItem !== "function" || !isStorageReadable(target)) {
      return false;
    }

    try {
      acceptedAt = (now === undefined ? new Date() : new Date(now)).toISOString();
      record = {
        schemaVersion: SCHEMA_VERSION,
        termsVersion: TERMS_VERSION,
        privacyVersion: PRIVACY_VERSION,
        acceptedAt: acceptedAt
      };
      serialized = JSON.stringify(record);
      target.setItem(STORAGE_KEY, serialized);
      saved = getCurrentConsent(target);
    } catch (error) {
      return false;
    }

    return !!saved && saved.acceptedAt === acceptedAt;
  }

  function clearConsent(storage) {
    var target = resolveStorage(storage);

    if (!target || typeof target.removeItem !== "function" || !isStorageReadable(target)) {
      return false;
    }

    try {
      target.removeItem(STORAGE_KEY);
      return target.getItem(STORAGE_KEY) === null;
    } catch (error) {
      return false;
    }
  }

  function getVersions() {
    return {
      schemaVersion: SCHEMA_VERSION,
      termsVersion: TERMS_VERSION,
      privacyVersion: PRIVACY_VERSION
    };
  }

  window.BioLogConsent = {
    STORAGE_KEY: STORAGE_KEY,
    SCHEMA_VERSION: SCHEMA_VERSION,
    TERMS_VERSION: TERMS_VERSION,
    PRIVACY_VERSION: PRIVACY_VERSION,
    getCurrentConsent: getCurrentConsent,
    hasValidConsent: hasValidConsent,
    saveConsent: saveConsent,
    getVersions: getVersions,
    clearConsent: clearConsent
  };
}());
