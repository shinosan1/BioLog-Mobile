(function () {
  "use strict";

  var SVG_NS = "http://www.w3.org/2000/svg";
  var WIDTH = 320;
  var HEIGHT = 180;
  var PADDING = {
    top: 18,
    right: 18,
    bottom: 34,
    left: 42
  };

  var CHARTS = [
    { title: "体重", unit: "kg", field: "weight", color: "var(--green)" },
    { title: "体温", unit: "℃", field: "temperature", color: "var(--red)" },
    { title: "血圧", unit: "mmHg", field: "blood_pressure", color: "var(--green)" },
    { title: "脈拍", unit: "回/分", field: "pulse", color: "var(--red)" },
    { title: "体脂肪率", unit: "%", field: "body_fat", color: "var(--green)" },
    { title: "基礎代謝量", unit: "kcal", field: "bmr", color: "var(--red)" },
    { title: "筋肉量", unit: "kg", field: "muscle_mass", color: "var(--green)" }
  ];

  function createSvgEl(tagName) {
    return document.createElementNS(SVG_NS, tagName);
  }

  function setAttrs(element, attrs) {
    Object.keys(attrs).forEach(function (name) {
      element.setAttribute(name, String(attrs[name]));
    });
    return element;
  }

  function appendText(parent, text, attrs) {
    var node = setAttrs(createSvgEl("text"), attrs || {});
    node.textContent = text;
    parent.appendChild(node);
    return node;
  }

  function hasNumber(record, fieldName) {
    return record &&
      typeof record[fieldName] === "number" &&
      Number.isFinite(record[fieldName]);
  }

  function sortedRecords(records) {
    return (Array.isArray(records) ? records.slice() : []).sort(function (a, b) {
      return String(a.date || "").localeCompare(String(b.date || ""));
    });
  }

  function buildChartSeries(records, fieldName) {
    return sortedRecords(records)
      .filter(function (record) {
        return record.date && hasNumber(record, fieldName);
      })
      .map(function (record) {
        return {
          date: record.date,
          value: record[fieldName]
        };
      });
  }

  function buildBloodPressureSeries(records) {
    return {
      systolic: buildChartSeries(records, "systolic_bp"),
      diastolic: buildChartSeries(records, "diastolic_bp")
    };
  }

  function allValues(seriesList) {
    return seriesList.reduce(function (values, series) {
      return values.concat(series.points.map(function (point) {
        return point.value;
      }));
    }, []);
  }

  function scaleBounds(values) {
    var min = Math.min.apply(Math, values);
    var max = Math.max.apply(Math, values);
    var range = max - min;

    if (range === 0) {
      var padding = Math.max(Math.abs(max) * 0.05, 1);
      return {
        min: min - padding,
        max: max + padding
      };
    }

    return {
      min: min - range * 0.08,
      max: max + range * 0.08
    };
  }

  function xFor(index, count) {
    var plotWidth = WIDTH - PADDING.left - PADDING.right;
    if (count <= 1) {
      return PADDING.left + plotWidth / 2;
    }
    return PADDING.left + (plotWidth * index / (count - 1));
  }

  function yFor(value, bounds) {
    var plotHeight = HEIGHT - PADDING.top - PADDING.bottom;
    return PADDING.top + ((bounds.max - value) / (bounds.max - bounds.min)) * plotHeight;
  }

  function formatAxisValue(value) {
    if (Math.abs(value) >= 100) {
      return String(Math.round(value));
    }
    return String(Math.round(value * 10) / 10);
  }

  function formatPointValue(value) {
    return String(Math.round(value * 10) / 10);
  }

  function addLine(svg, x1, y1, x2, y2, className) {
    svg.appendChild(setAttrs(createSvgEl("line"), {
      x1: x1,
      y1: y1,
      x2: x2,
      y2: y2,
      class: className
    }));
  }

  function tooltipX(x) {
    if (x > WIDTH - 110) {
      return x - 112;
    }
    if (x < PADDING.left + 20) {
      return x + 12;
    }
    return x - 50;
  }

  function tooltipY(y) {
    return y < PADDING.top + 30 ? y + 14 : y - 38;
  }

  function hideTooltip(group) {
    group.classList.remove("is-active");
  }

  function showTooltip(group) {
    var svg = group.ownerSVGElement;
    Array.prototype.forEach.call(svg.querySelectorAll(".chart-point-group.is-active"), function (activeGroup) {
      if (activeGroup !== group) {
        hideTooltip(activeGroup);
      }
    });
    group.classList.add("is-active");
  }

  function createPointGroup(point, series, x, y) {
    var group = createSvgEl("g");
    var label = point.date + " " + series.label + " " + formatPointValue(point.value) + " " + series.unit;
    var tipX = tooltipX(x);
    var tipY = tooltipY(y);

    group.classList.add("chart-point-group");
    group.setAttribute("tabindex", "0");
    group.setAttribute("role", "button");
    group.setAttribute("aria-label", label);

    group.appendChild(setAttrs(createSvgEl("circle"), {
      cx: x,
      cy: y,
      r: 3,
      class: "chart-point",
      fill: series.color
    }));

    group.appendChild(setAttrs(createSvgEl("circle"), {
      cx: x,
      cy: y,
      r: 13,
      class: "chart-point-hit",
      fill: "transparent",
      "pointer-events": "all"
    }));

    var tooltip = setAttrs(createSvgEl("g"), {
      class: "chart-tooltip",
      transform: "translate(" + tipX + " " + tipY + ")",
      "aria-hidden": "true"
    });
    tooltip.appendChild(setAttrs(createSvgEl("rect"), {
      width: 104,
      height: 28,
      rx: 5,
      ry: 5,
      class: "chart-tooltip-box"
    }));
    appendText(tooltip, point.date, {
      x: 8,
      y: 11,
      class: "chart-tooltip-text"
    });
    appendText(tooltip, series.label + ": " + formatPointValue(point.value) + " " + series.unit, {
      x: 8,
      y: 22,
      class: "chart-tooltip-text"
    });
    group.appendChild(tooltip);

    group.addEventListener("mouseenter", function () {
      showTooltip(group);
    });
    group.addEventListener("mouseleave", function () {
      hideTooltip(group);
    });
    group.addEventListener("focus", function () {
      showTooltip(group);
    });
    group.addEventListener("blur", function () {
      hideTooltip(group);
    });
    group.addEventListener("click", function () {
      showTooltip(group);
    });

    return group;
  }

  function renderSeries(svg, series, dates, bounds) {
    var points = series.points.map(function (point) {
      var x = xFor(dates.indexOf(point.date), dates.length);
      var y = yFor(point.value, bounds);
      return {
        x: x,
        y: y,
        date: point.date,
        value: point.value
      };
    });

    svg.appendChild(setAttrs(createSvgEl("polyline"), {
      points: points.map(function (point) {
        return point.x + "," + point.y;
      }).join(" "),
      class: "chart-line",
      stroke: series.color
    }));

    points.forEach(function (point) {
      svg.appendChild(createPointGroup(point, series, point.x, point.y));
    });
  }

  function uniqueDates(seriesList) {
    var seen = {};
    var dates = [];
    seriesList.forEach(function (series) {
      series.points.forEach(function (point) {
        if (!seen[point.date]) {
          seen[point.date] = true;
          dates.push(point.date);
        }
      });
    });
    return dates.sort();
  }

  function renderLineChart(options) {
    var wrapper = document.createElement("div");
    wrapper.className = "chart-body";

    var seriesList = options.seriesList || [];
    var values = allValues(seriesList);
    var hasRenderableSeries = seriesList.some(function (series) {
      return series.points.length >= 2;
    });
    if (!hasRenderableSeries) {
      var empty = document.createElement("p");
      empty.className = "placeholder-text";
      empty.textContent = "グラフ表示には2件以上の記録が必要です。";
      wrapper.appendChild(empty);
      return wrapper;
    }

    var dates = uniqueDates(seriesList);
    var bounds = scaleBounds(values);
    var svg = setAttrs(createSvgEl("svg"), {
      viewBox: "0 0 " + WIDTH + " " + HEIGHT,
      role: "img",
      "aria-label": options.title + "の推移"
    });
    svg.classList.add("chart-svg");

    addLine(svg, PADDING.left, PADDING.top, PADDING.left, HEIGHT - PADDING.bottom, "chart-axis");
    addLine(svg, PADDING.left, HEIGHT - PADDING.bottom, WIDTH - PADDING.right, HEIGHT - PADDING.bottom, "chart-axis");

    appendText(svg, formatAxisValue(bounds.max), {
      x: PADDING.left - 8,
      y: PADDING.top + 4,
      class: "chart-axis-label",
      "text-anchor": "end"
    });
    appendText(svg, formatAxisValue(bounds.min), {
      x: PADDING.left - 8,
      y: HEIGHT - PADDING.bottom,
      class: "chart-axis-label",
      "text-anchor": "end"
    });
    appendText(svg, dates[0] || "", {
      x: PADDING.left,
      y: HEIGHT - 10,
      class: "chart-axis-label",
      "text-anchor": "start"
    });
    appendText(svg, dates[dates.length - 1] || "", {
      x: WIDTH - PADDING.right,
      y: HEIGHT - 10,
      class: "chart-axis-label",
      "text-anchor": "end"
    });

    seriesList.forEach(function (series) {
      renderSeries(svg, series, dates, bounds);
    });

    wrapper.appendChild(svg);
    return wrapper;
  }

  function legendItem(label, color) {
    var item = document.createElement("span");
    item.className = "chart-legend-item";

    var swatch = document.createElement("span");
    swatch.className = "chart-legend-swatch";
    swatch.style.background = color;
    item.appendChild(swatch);

    var text = document.createElement("span");
    text.textContent = label;
    item.appendChild(text);
    return item;
  }

  function chartCard(config, records) {
    var card = document.createElement("article");
    card.className = "chart-card";

    var header = document.createElement("div");
    header.className = "chart-card-header";

    var title = document.createElement("h3");
    title.textContent = config.title;
    header.appendChild(title);

    var unit = document.createElement("span");
    unit.className = "chart-unit";
    unit.textContent = config.unit;
    header.appendChild(unit);
    card.appendChild(header);

    if (config.field === "blood_pressure") {
      var bloodPressure = buildBloodPressureSeries(records);
      var legend = document.createElement("div");
      legend.className = "chart-legend";
      legend.appendChild(legendItem("収縮期", "var(--green)"));
      legend.appendChild(legendItem("拡張期", "var(--red)"));
      card.appendChild(legend);
      card.appendChild(renderLineChart({
        title: config.title,
        seriesList: [
          { label: "収縮期", color: "var(--green)", unit: config.unit, points: bloodPressure.systolic },
          { label: "拡張期", color: "var(--red)", unit: config.unit, points: bloodPressure.diastolic }
        ]
      }));
      return card;
    }

    card.appendChild(renderLineChart({
      title: config.title,
      seriesList: [
        { label: config.title, color: config.color, unit: config.unit, points: buildChartSeries(records, config.field) }
      ]
    }));
    return card;
  }

  function renderCharts(containerElement, records) {
    containerElement.textContent = "";
    CHARTS.forEach(function (config) {
      containerElement.appendChild(chartCard(config, records));
    });
  }

  window.BioLogCharts = {
    renderCharts: renderCharts,
    renderLineChart: renderLineChart,
    buildChartSeries: buildChartSeries,
    buildBloodPressureSeries: buildBloodPressureSeries
  };
}());
