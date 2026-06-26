(function () {
  "use strict";

  var DB_NAME = (
    typeof window !== "undefined" && window.BIOLOG_DB_NAME
  ) ? window.BIOLOG_DB_NAME : "biolog_mobile";
  var DB_VERSION = 1;
  var STORE_NAME = "health_records";
  var USER_ID = "self";
  var NUMERIC_FIELDS = [
    "temperature",
    "pulse",
    "systolic_bp",
    "diastolic_bp",
    "weight",
    "body_fat",
    "muscle_mass",
    "bmr"
  ];
  var TEXT_FIELDS = ["meal_detail", "activity_log", "memo"];

  function requestToPromise(request) {
    return new Promise(function (resolve, reject) {
      request.onsuccess = function () {
        resolve(request.result);
      };
      request.onerror = function () {
        reject(request.error);
      };
    });
  }

  function transactionDone(transaction) {
    return new Promise(function (resolve, reject) {
      transaction.oncomplete = function () {
        resolve();
      };
      transaction.onerror = function () {
        reject(transaction.error);
      };
      transaction.onabort = function () {
        reject(transaction.error);
      };
    });
  }

  function ensureStore(db) {
    var store = db.createObjectStore(STORE_NAME, {
      keyPath: "id",
      autoIncrement: true
    });
    store.createIndex("date_user", "date_user", { unique: true });
    store.createIndex("request_id", "request_id", { unique: false });
  }

  function openDB() {
    return new Promise(function (resolve, reject) {
      var request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = function (event) {
        var db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          ensureStore(db);
        }
      };

      request.onsuccess = function () {
        resolve(request.result);
      };
      request.onerror = function () {
        reject(request.error);
      };
    });
  }

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function localDateYYYYMMDD(date) {
    var value = date || new Date();
    return [
      value.getFullYear(),
      pad2(value.getMonth() + 1),
      pad2(value.getDate())
    ].join("-");
  }

  function makeDateUser(userId, date) {
    return String(userId || USER_ID) + "::" + String(date);
  }

  function makeRequestId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return "req-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
  }

  function nowTimestamp() {
    return new Date().toISOString();
  }

  function hasOwn(source, key) {
    return Object.prototype.hasOwnProperty.call(source, key);
  }

  function copyInputFields(target, input) {
    NUMERIC_FIELDS.forEach(function (field) {
      if (!hasOwn(input, field) || input[field] === "") {
        return;
      }
      target[field] = input[field];
    });

    TEXT_FIELDS.forEach(function (field) {
      if (hasOwn(input, field)) {
        target[field] = input[field];
      }
    });
  }

  function normalizeRecord(input, existingRecord) {
    var source = input || {};
    var existing = existingRecord || null;
    var record = existing ? Object.assign({}, existing) : {};
    var userId = source.user_id || (existing && existing.user_id) || USER_ID;
    var date = source.date || (existing && existing.date) || localDateYYYYMMDD();
    var timestamp = nowTimestamp();

    if (existing && hasOwn(existing, "id")) {
      record.id = existing.id;
    } else if (hasOwn(record, "id")) {
      delete record.id;
    }

    record.user_id = userId;
    record.date = date;
    record.date_user = makeDateUser(userId, date);
    record.request_id = existing && existing.request_id ? existing.request_id : (source.request_id || makeRequestId());
    record.created_at = existing && existing.created_at ? existing.created_at : (source.created_at || timestamp);
    record.updated_at = timestamp;

    copyInputFields(record, source);
    return record;
  }

  function getRecordByDate(date, userId) {
    var resolvedUserId = userId || USER_ID;
    var dateUser = makeDateUser(resolvedUserId, date);

    return openDB().then(function (db) {
      var transaction = db.transaction(STORE_NAME, "readonly");
      var store = transaction.objectStore(STORE_NAME);
      var index = store.index("date_user");
      return requestToPromise(index.get(dateUser)).finally(function () {
        db.close();
      });
    });
  }

  function upsertRecord(input) {
    var source = input || {};
    var userId = source.user_id || USER_ID;
    var date = source.date || localDateYYYYMMDD();
    var dateUser = makeDateUser(userId, date);

    return openDB().then(function (db) {
      var transaction = db.transaction(STORE_NAME, "readwrite");
      var store = transaction.objectStore(STORE_NAME);
      var index = store.index("date_user");

      return requestToPromise(index.get(dateUser)).then(function (existingRecord) {
        var normalized = normalizeRecord(Object.assign({}, source, {
          user_id: userId,
          date: date,
          date_user: dateUser
        }), existingRecord || null);
        return requestToPromise(store.put(normalized)).then(function (key) {
          normalized.id = key;
          return transactionDone(transaction).then(function () {
            return normalized;
          });
        });
      }).finally(function () {
        db.close();
      });
    });
  }

  function getAllRecords() {
    return openDB().then(function (db) {
      var transaction = db.transaction(STORE_NAME, "readonly");
      var store = transaction.objectStore(STORE_NAME);
      return requestToPromise(store.getAll()).then(function (records) {
        return records.sort(function (a, b) {
          return String(b.date).localeCompare(String(a.date));
        });
      }).finally(function () {
        db.close();
      });
    });
  }

  function deleteRecord(id) {
    return openDB().then(function (db) {
      var transaction = db.transaction(STORE_NAME, "readwrite");
      var store = transaction.objectStore(STORE_NAME);
      store.delete(id);
      return transactionDone(transaction).then(function () {
        db.close();
        return true;
      }, function (error) {
        db.close();
        throw error;
      });
    });
  }

  function deleteAllRecords() {
    return openDB().then(function (db) {
      var transaction = db.transaction(STORE_NAME, "readwrite");
      var store = transaction.objectStore(STORE_NAME);
      store.clear();
      return transactionDone(transaction).then(function () {
        db.close();
        return true;
      }, function (error) {
        db.close();
        throw error;
      });
    });
  }

  function importRecordsAtomic(records) {
    var importRecords = Array.isArray(records) ? records : [];

    if (!importRecords.length) {
      return Promise.resolve({
        imported: 0,
        added: 0,
        updated: 0
      });
    }

    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var transaction = db.transaction(STORE_NAME, "readwrite");
        var store = transaction.objectStore(STORE_NAME);
        var index = store.index("date_user");
        var position = 0;
        var added = 0;
        var updated = 0;
        var settled = false;

        function closeAndReject(error) {
          if (settled) {
            return;
          }
          settled = true;
          db.close();
          reject(error || new Error("Import failed"));
        }

        function abortWith(error) {
          if (settled) {
            return;
          }
          try {
            transaction.abort();
          } catch (abortError) {
            closeAndReject(error || abortError);
          }
        }

        function processNext() {
          if (position >= importRecords.length) {
            return;
          }

          var source = importRecords[position];
          var lookup = index.get(source.date_user);

          lookup.onsuccess = function () {
            var existing = lookup.result || null;
            var normalized = normalizeRecord(source, existing);

            if (!existing && source.updated_at) {
              normalized.updated_at = source.updated_at;
            }

            var put = store.put(normalized);
            put.onsuccess = function () {
              if (existing) {
                updated += 1;
              } else {
                added += 1;
              }
              position += 1;
              processNext();
            };
            put.onerror = function () {
              abortWith(put.error);
            };
          };

          lookup.onerror = function () {
            abortWith(lookup.error);
          };
        }

        transaction.oncomplete = function () {
          if (!settled) {
            settled = true;
            db.close();
            resolve({
              imported: importRecords.length,
              added: added,
              updated: updated
            });
          }
        };

        transaction.onerror = function () {
          abortWith(transaction.error);
        };

        transaction.onabort = function () {
          closeAndReject(transaction.error);
        };

        processNext();
      });
    });
  }
  window.BioLogDB = {
    openDB: openDB,
    localDateYYYYMMDD: localDateYYYYMMDD,
    makeDateUser: makeDateUser,
    normalizeRecord: normalizeRecord,
    upsertRecord: upsertRecord,
    getRecordByDate: getRecordByDate,
    getAllRecords: getAllRecords,
    deleteRecord: deleteRecord,
    deleteAllRecords: deleteAllRecords,
    importRecordsAtomic: importRecordsAtomic
  };
}());
