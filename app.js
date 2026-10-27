/* Math Worksheet — problems come from a seeded generator, so a seed always reprints the same sheet. */
(function () {
  "use strict";
  var $ = S3.$, $$ = S3.$$;
  var KEY = "mw.v1";
  var SYM = { add: "+", sub: "−", mul: "×", div: "÷" };
  var L = {
    en: { name: "Name", date: "Date", score: "Score", key: "Answer key", sheet: "Sheet", r: "R",
      title: { add: "Addition practice", sub: "Subtraction practice", mul: "Multiplication practice", div: "Division practice", mixed: "Mixed practice" } },
    ar: { name: "الاسم", date: "التاريخ", score: "العلامة", key: "الإجابات", sheet: "ورقة", r: "باقي",
      title: { add: "تمارين الجمع", sub: "تمارين الطرح", mul: "تمارين الضرب", div: "تمارين القسمة", mixed: "تمارين متنوعة" } }
  };

  // ---------- seeded random ----------
  function hashSeed(str) { // xmur3
    var h = 1779033703 ^ str.length;
    for (var i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  }
  function rng(seed) { // mulberry32
    var a = hashSeed(String(seed));
    return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function randInt(r, lo, hi) { return lo + Math.floor(r() * (hi - lo + 1)); }
  function newSeed() { var c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", s = ""; var b = new Uint32Array(6); crypto.getRandomValues(b); for (var i = 0; i < 6; i++) s += c[b[i] % c.length]; return s; }

  // ---------- regrouping ----------
  function hasCarry(a, b) { a = Math.abs(a); b = Math.abs(b); while (a || b) { if (a % 10 + b % 10 >= 10) return true; a = Math.floor(a / 10); b = Math.floor(b / 10); } return false; }
  function hasBorrow(a, b) { if (a < b) { var t = a; a = b; b = t; } while (b) { if (a % 10 < b % 10) return true; a = Math.floor(a / 10); b = Math.floor(b / 10); } return false; }

  // ---------- generator ----------
  function generate(o) {
    var r = rng(o.seed), probs = [], seen = new Set(), unmet = 0;
    var ops = o.ops.length ? o.ops : ["add"], list = [];
    for (var i = 0; i < o.count; i++) list.push(ops[i % ops.length]);
    for (i = list.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)), t = list[i]; list[i] = list[j]; list[j] = t; }
    list.forEach(function (op) {
      var p = null, ok = false;
      for (var tries = 0; tries < 400; tries++) {
        p = one(op, r, o);
        ok = fits(p, o);
        if (ok && (!seen.has(p.key) || tries > 60)) break;
      }
      if (!ok) unmet++;
      seen.add(p.key); probs.push(p);
    });
    return { problems: probs, unmet: unmet };
  }
  function one(op, r, o) {
    var a = randInt(r, o.aMin, o.aMax), b = randInt(r, o.bMin, o.bMax), ans, rem = 0;
    if (op === "add") ans = a + b;
    else if (op === "sub") { if (o.noNeg && a < b) { var t = a; a = b; b = t; } ans = a - b; }
    else if (op === "mul") ans = a * b;
    else {
      var bl = Math.max(1, o.bMin), bh = Math.max(1, o.bMax);
      b = randInt(r, bl, bh);
      if (o.wholeDiv) {
        var qlo = Math.max(1, Math.ceil(Math.max(o.aMin, 0) / b)), qhi = Math.floor(o.aMax / b);
        var q = qlo <= qhi ? randInt(r, qlo, qhi) : randInt(r, Math.max(1, o.aMin), Math.max(1, o.aMax)); // range too small: first range = quotient
        a = b * q; ans = q;
      } else { a = randInt(r, Math.max(0, o.aMin), Math.max(0, o.aMax)); ans = Math.floor(a / b); rem = a % b; }
    }
    return { op: op, a: a, b: b, ans: ans, rem: rem, key: op + a + "," + b };
  }
  function fits(p, o) {
    if (p.op === "add" && o.regroup !== "any") return o.regroup === "need" ? hasCarry(p.a, p.b) : !hasCarry(p.a, p.b);
    if (p.op === "sub" && o.regroup !== "any") return o.regroup === "need" ? hasBorrow(p.a, p.b) : !hasBorrow(p.a, p.b);
    return true;
  }

  // ---------- formatting ----------
  function digits(s, lang) { s = String(s).replace(/-/g, "−"); return lang === "ar" ? s.replace(/\d/g, function (d) { return "٠١٢٣٤٥٦٧٨٩"[d]; }) : s; }
  function answerText(p, lang) { return p.op === "div" && p.rem ? digits(p.ans, lang) + " " + L[lang].r + " " + digits(p.rem, lang) : digits(p.ans, lang); }

  // ---------- options / state ----------
  var saved = S3.store(KEY) || {};
  var state = { layout: saved.layout || "v", lang: saved.lang || "en", paper: saved.paper || "A4", view: "sheet" };
  function readOpts() {
    function n(id, d) { var v = parseInt(String($("#" + id).value).replace(/[٠-٩]/g, function (c) { return c.charCodeAt(0) - 0x660; }), 10); return isFinite(v) ? v : d; }
    var o = {
      ops: $$("#ops input:checked").map(function (x) { return x.value; }),
      aMin: n("aMin", 1), aMax: n("aMax", 9), bMin: n("bMin", 1), bMax: n("bMax", 9),
      regroup: $("#regroup").value, noNeg: $("#noNeg").checked, wholeDiv: $("#wholeDiv").checked,
      count: Math.max(1, Math.min(120, n("count", 20))), cols: Math.max(1, Math.min(6, n("cols", 4))),
      layout: state.layout, lang: state.lang, paper: state.paper, title: $("#title").value.trim(),
      nameLine: $("#nameLine").checked, key: $("#key").checked, seed: $("#seed").value.trim() || "1"
    };
    o.aMin = Math.max(0, Math.min(o.aMin, 999999)); o.aMax = Math.max(0, Math.min(o.aMax, 999999));
    o.bMin = Math.max(0, Math.min(o.bMin, 999999)); o.bMax = Math.max(0, Math.min(o.bMax, 999999));
    if (o.aMin > o.aMax) { var t = o.aMin; o.aMin = o.aMax; o.aMax = t; }
    if (o.bMin > o.bMax) { t = o.bMin; o.bMin = o.bMax; o.bMax = t; }
    return o;
  }
  function save(o) { S3.store(KEY, o); }

  // ---------- rendering ----------
  function problemEl(p, i, o, withAns) {
    var lang = o.lang, num = S3.h("span", { "class": "ws-n", text: digits(i + 1, lang) + "." });
    var ans = withAns ? answerText(p, lang) : "";
    if (o.layout === "h") {
      return S3.h("div", { "class": "ws-p ws-h" }, [num, S3.h("span", { "class": "ws-expr", dir: "ltr" }, [
        digits(p.a, lang) + " " + SYM[p.op] + " " + digits(p.b, lang) + " = ",
        S3.h("span", { "class": "ws-blank" + (withAns ? " is-ans" : ""), text: ans || " " })
      ])]);
    }
    if (p.op === "div") {
      return S3.h("div", { "class": "ws-p ws-v" }, [num, S3.h("div", { "class": "ws-ld", dir: "ltr" }, [
        S3.h("span", { "class": "ws-q" + (withAns ? " is-ans" : ""), text: ans || " " }),
        S3.h("span", { "class": "ws-dv", text: digits(p.b, lang) }),
        S3.h("span", { "class": "ws-dd", text: digits(p.a, lang) })
      ])]);
    }
    return S3.h("div", { "class": "ws-p ws-v" }, [num, S3.h("div", { "class": "ws-stack", dir: "ltr" }, [
      S3.h("span", { text: digits(p.a, lang) }),
      S3.h("span", { "class": "ws-b" }, [S3.h("i", { text: SYM[p.op] }), digits(p.b, lang)]),
      S3.h("span", { "class": "ws-ans" + (withAns ? " is-ans" : ""), text: ans || " " })
    ])]);
  }
  function page(o, gen, withAns) {
    var lab = L[o.lang], mixed = o.ops.length !== 1;
    var title = o.title || lab.title[mixed ? "mixed" : o.ops[0]];
    var head = S3.h("header", { "class": "ws-head", dir: o.lang === "ar" ? "rtl" : "ltr" }, [
      S3.h("h2", { "class": "ws-title", text: title + (withAns ? " — " + lab.key : "") })
    ]);
    if (o.nameLine && !withAns) head.appendChild(S3.h("div", { "class": "ws-lines" }, [
      S3.h("span", {}, [lab.name + ": ", S3.h("i")]), S3.h("span", {}, [lab.date + ": ", S3.h("i")]),
      S3.h("span", { "class": "ws-score" }, [lab.score + ": ", S3.h("i"), " / " + digits(gen.problems.length, o.lang)])
    ]));
    var fs = o.layout === "h" ? Math.min(3.9, 12.5 / o.cols) : Math.min(4.8, 17 / o.cols);
    var grid = S3.h("div", { "class": "ws-grid ws-" + o.layout, dir: o.lang === "ar" ? "rtl" : "ltr", style: "--cols:" + o.cols + ";--fs:" + fs.toFixed(2) + "cqw" });
    gen.problems.forEach(function (p, i) { grid.appendChild(problemEl(p, i, o, withAns)); });
    var foot = S3.h("footer", { "class": "ws-foot", dir: o.lang === "ar" ? "rtl" : "ltr" }, [lab.sheet + " ", S3.h("bdi", { "class": "mono", text: o.seed })]);
    return S3.h("article", { "class": "ws-page ws-" + o.paper.toLowerCase() + (withAns ? " ws-keypage" : "") }, [head, grid, foot]);
  }

  var current = null;
  function render() {
    var o = readOpts();
    save(o);
    var warn = [];
    if (!o.ops.length) warn.push("Pick at least one operation; showing addition.");
    if (o.ops.indexOf("div") >= 0 && o.bMax < 1) warn.push("Division needs a divisor of at least 1.");
    var gen = generate(o);
    current = { o: o, gen: gen };
    if (gen.unmet) warn.push(gen.unmet + " problem" + (gen.unmet === 1 ? "" : "s") + " couldn't meet the carrying rule with these ranges.");
    $("#warn").textContent = warn.join(" ");
    var box = $("#pages"); box.textContent = "";
    var sheet = page(o, gen, false); box.appendChild(sheet);
    if (o.key) { var key = page(o, gen, true); box.appendChild(key); }
    $("#view").hidden = !o.key;
    if (!o.key) state.view = "sheet";
    $$(".ws-page", box).forEach(function (p) { p.classList.toggle("is-off", p.classList.contains("ws-keypage") !== (state.view === "key")); });
    $$("#view button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.v === state.view)); });
    var ps = $("#mw-page-style") || document.head.appendChild(S3.h("style", { id: "mw-page-style" }));
    ps.textContent = "@page { size: " + (o.paper === "A4" ? "A4" : "letter") + " portrait; margin: 14mm; }";
  }

  function seg(id, value, onPick) {
    $$("#" + id + " button").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.v === value));
      b.addEventListener("click", function () {
        $$("#" + id + " button").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
        onPick(b.dataset.v);
      });
    });
  }

  // ---------- wiring ----------
  function fill(s) {
    $$("#ops input").forEach(function (x) { x.checked = (s.ops || ["add"]).indexOf(x.value) >= 0; });
    $("#aMin").value = s.aMin != null ? s.aMin : 10; $("#aMax").value = s.aMax != null ? s.aMax : 99;
    $("#bMin").value = s.bMin != null ? s.bMin : 10; $("#bMax").value = s.bMax != null ? s.bMax : 99;
    $("#regroup").value = s.regroup || "any"; $("#noNeg").checked = s.noNeg !== false; $("#wholeDiv").checked = s.wholeDiv !== false;
    $("#count").value = s.count || 20; $("#cols").value = s.cols || 4; $("#title").value = s.title || "";
    $("#nameLine").checked = s.nameLine !== false; $("#key").checked = s.key !== false; $("#seed").value = s.seed || newSeed();
  }
  fill(saved);
  seg("layout", state.layout, function (v) { state.layout = v; render(); });
  seg("digits", state.lang, function (v) { state.lang = v; render(); });
  seg("paper", state.paper, function (v) { state.paper = v; render(); });
  seg("view", state.view, function (v) { state.view = v; render(); });
  $("#settings").addEventListener("input", S3.debounce(render, 120));
  $("#settings").addEventListener("change", render);
  $$("#presets button").forEach(function (b) {
    b.addEventListener("click", function () {
      var p = b.dataset.p.split(",");
      function rangeOf(d) { return d === "t" ? [1, 12] : d === "1" ? [1, 9] : [Math.pow(10, +d - 1), Math.pow(10, +d) - 1]; }
      var a = rangeOf(p[0]), c = rangeOf(p[1]);
      $("#aMin").value = a[0]; $("#aMax").value = a[1]; $("#bMin").value = c[0]; $("#bMax").value = c[1];
      render();
    });
  });
  $("#reseed").addEventListener("click", function () { $("#seed").value = newSeed(); render(); });
  $("#new").addEventListener("click", function () { $("#seed").value = newSeed(); render(); S3.toast("New sheet: " + $("#seed").value); });
  $("#print").addEventListener("click", function () { render(); S3.done(); window.print(); });
  render();

  window.S3_DEMO = function () {
    fill({ ops: ["add", "sub"], aMin: 10, aMax: 99, bMin: 10, bMax: 99, regroup: "any", count: 20, cols: 5, seed: "SPRING", nameLine: true, key: true });
    state.layout = "v"; state.view = "sheet"; state.lang = "en";
    $$("#layout button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.v === "v")); });
    $$("#digits button").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.v === "en")); });
    render();
  };

  // ---------- self-test ----------
  window.S3_SELFTEST = function () {
    var f = [];
    function ok(n, c) { if (!c) f.push(n); }
    var base = { ops: ["add"], aMin: 10, aMax: 99, bMin: 10, bMax: 99, regroup: "any", noNeg: true, wholeDiv: true, count: 200, seed: "TEST1" };
    function g(over) { return generate(Object.assign({}, base, over)); }
    var a1 = g({}), a2 = g({}), a3 = g({ seed: "TEST2" });
    ok("deterministic", JSON.stringify(a1) === JSON.stringify(a2));
    ok("seed changes sheet", JSON.stringify(a1) !== JSON.stringify(a3));
    ok("count", a1.problems.length === 200);
    ok("ranges", a1.problems.every(function (p) { return p.a >= 10 && p.a <= 99 && p.b >= 10 && p.b <= 99; }));
    ok("add answers", a1.problems.every(function (p) { return p.ans === p.a + p.b; }));
    var nc = g({ regroup: "none" });
    ok("no carry", nc.unmet === 0 && nc.problems.every(function (p) { return (p.a % 10 + p.b % 10 < 10) && (Math.floor(p.a / 10) + Math.floor(p.b / 10) < 10); }));
    var nd = g({ regroup: "need" });
    ok("needs carry", nd.problems.every(function (p) { return hasCarry(p.a, p.b); }));
    var sb = g({ ops: ["sub"], regroup: "none" });
    ok("no borrow", sb.problems.every(function (p) { return p.a >= p.b && p.a % 10 >= p.b % 10 && p.ans === p.a - p.b; }));
    var sn = g({ ops: ["sub"], aMin: 1, aMax: 50, bMin: 1, bMax: 50 });
    ok("no negatives", sn.problems.every(function (p) { return p.ans >= 0; }));
    var sneg = g({ ops: ["sub"], aMin: 1, aMax: 50, bMin: 1, bMax: 50, noNeg: false });
    ok("negatives allowed", sneg.problems.some(function (p) { return p.ans < 0; }) && sneg.problems.every(function (p) { return p.ans === p.a - p.b; }));
    var dv = g({ ops: ["div"], aMin: 10, aMax: 99, bMin: 2, bMax: 9 });
    ok("whole division", dv.problems.every(function (p) { return p.rem === 0 && p.a === p.b * p.ans && p.a >= 10 && p.a <= 99 && p.b >= 2; }));
    var dr = g({ ops: ["div"], wholeDiv: false, aMin: 10, aMax: 99, bMin: 2, bMax: 9 });
    ok("remainders", dr.problems.every(function (p) { return p.a === p.b * p.ans + p.rem && p.rem < p.b; }) && dr.problems.some(function (p) { return p.rem > 0; }));
    var mx = g({ ops: ["add", "sub", "mul", "div"], count: 40 });
    ok("mixed balanced", ["add", "sub", "mul", "div"].every(function (op) { return mx.problems.filter(function (p) { return p.op === op; }).length === 10; }));
    ok("mul answers", mx.problems.filter(function (p) { return p.op === "mul"; }).every(function (p) { return p.ans === p.a * p.b; }));
    ok("borrow logic", hasBorrow(52, 17) && !hasBorrow(57, 12) && hasCarry(15, 25) && !hasCarry(12, 34) && hasCarry(55, 50));
    ok("arabic digits", digits(2026, "ar") === "٢٠٢٦" && digits(-5, "en") === "−5");
    ok("remainder text", answerText({ op: "div", ans: 7, rem: 3 }, "en") === "7 R 3" && answerText({ op: "div", ans: 7, rem: 3 }, "ar") === "٧ باقي ٣");
    return f.length ? f : true;
  };
})();
