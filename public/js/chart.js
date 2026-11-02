/* TRIPA — Graphiques locaux (remplace le CDN Chart.js, aucune dépendance externe).
 * API minimale compatible : new Chart(canvasEl, { type:'doughnut'|'bar', data, options }).
 * Rendu Canvas 2D net (Device Pixel Ratio), texte adaptatif au thème, redessin au redimensionnement. */
(function () {
  var instances = [];

  function cssVar(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name);
    return (v && v.trim()) || fallback;
  }

  function resolveColor(c, i) {
    if (Array.isArray(c)) return c[i % c.length] || cssVar('--accent', '#4f46e5');
    if (typeof c === 'string') return c;
    return cssVar('--accent', '#4f46e5');
  }

  function numbers(cfg) {
    var ds = (cfg.data && cfg.data.datasets && cfg.data.datasets[0]) || {};
    var values = (ds.data || []).map(function (v) { return Number(v) || 0; });
    return {
      values: values,
      labels: (cfg.data && cfg.data.labels) || [],
      colors: ds.backgroundColor,
      total: values.reduce(function (a, b) { return a + b; }, 0),
      max: values.reduce(function (m, v) { return Math.max(m, v); }, 0)
    };
  }

  function fitCanvas(canvas, wantH) {
    var dpr = window.devicePixelRatio || 1;
    var w = canvas.clientWidth || canvas.parentElement.clientWidth || 320;
    var h = wantH;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = '100%';
    canvas.style.height = h + 'px';
    var ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx: ctx, w: w, h: h };
  }

  function placeholder(o, msg) {
    var ctx = o.ctx;
    ctx.fillStyle = cssVar('--text-muted', '#8a94a6');
    ctx.font = '13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(msg, o.w / 2, o.h / 2);
  }

  function cutoutRatio(options) {
    var c = options && options.cutout;
    if (typeof c === 'number') return c;
    if (typeof c === 'string' && c.indexOf('%') > -1) return parseFloat(c) / 100 || 0.62;
    return 0.62;
  }

  function drawDoughnut(canvas, cfg) {
    var d = numbers(cfg), o = fitCanvas(canvas, 230), ctx = o.ctx;
    var ink = cssVar('--text', '#0f172a'), muted = cssVar('--text-muted', '#8a94a6');
    if (d.total <= 0) { placeholder(o, 'Aucune donnée'); return; }
    var legendH = 40, cx = o.w / 2, topPad = 12;
    var r = Math.min(o.w / 2 - 8, (o.h - legendH - topPad) / 2);
    var inner = r * cutoutRatio(cfg.options);
    var a0 = -Math.PI / 2;
    d.values.forEach(function (v, i) {
      var frac = v / d.total, a1 = a0 + frac * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx, topPad + r, r, a0, a1);
      ctx.arc(cx, topPad + r, inner, a1, a0, true);
      ctx.closePath();
      ctx.fillStyle = resolveColor(d.colors, i);
      ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = cssVar('--surface', '#fff'); ctx.stroke();
      a0 = a1;
    });
    ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '700 18px system-ui, sans-serif';
    ctx.fillText(String(d.total), cx, topPad + r - 8);
    ctx.fillStyle = muted; ctx.font = '11px system-ui, sans-serif';
    ctx.fillText('total', cx, topPad + r + 10);
    // légende en bas, en ligne
    ctx.textBaseline = 'middle';
    var lx = 8, ly = o.h - legendH / 2 - 2;
    d.labels.forEach(function (lab, i) {
      var txt = String(lab);
      ctx.font = '11px system-ui, sans-serif';
      var tw = ctx.measureText(txt).width;
      if (lx + 14 + tw + 12 > o.w) { lx = 8; ly += 15; }
      ctx.fillStyle = resolveColor(d.colors, i);
      ctx.fillRect(lx, ly - 5, 10, 10);
      ctx.fillStyle = ink; ctx.textAlign = 'left';
      ctx.fillText(txt, lx + 14, ly);
      lx += 14 + tw + 12;
    });
  }

  function drawBar(canvas, cfg) {
    var d = numbers(cfg), o = fitCanvas(canvas, 230), ctx = o.ctx;
    var ink = cssVar('--text', '#0f172a'), muted = cssVar('--text-muted', '#8a94a6'), line = cssVar('--border', '#e6e8ec');
    if (d.max <= 0) { placeholder(o, 'Aucune donnée'); return; }
    var padL = 8, padR = 8, top = 24, axisH = 26;
    var plotH = o.h - top - axisH, plotW = o.w - padL - padR;
    var n = d.values.length || 1;
    var slot = plotW / n, bw = Math.min(slot * 0.6, 60), baseY = top + plotH;
    ctx.strokeStyle = line; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(padL, baseY + 0.5); ctx.lineTo(o.w - padR, baseY + 0.5); ctx.stroke();
    d.values.forEach(function (v, i) {
      var hgt = (v / d.max) * plotH;
      var x = padL + slot * i + (slot - bw) / 2;
      var y = baseY - hgt;
      ctx.fillStyle = resolveColor(d.colors, i);
      var rad = Math.min(6, bw / 2);
      roundTopRect(ctx, x, y, bw, hgt, rad); ctx.fill();
      // valeur au-dessus
      ctx.fillStyle = ink; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.font = '700 12px system-ui, sans-serif';
      ctx.fillText(shortNum(v), x + bw / 2, y - 3);
      // label sous l'axe
      ctx.fillStyle = muted; ctx.textBaseline = 'top'; ctx.font = '11px system-ui, sans-serif';
      ctx.fillText(truncate(ctx, String(d.labels[i] || ''), slot - 4), x + bw / 2, baseY + 6);
    });
  }

  function roundTopRect(ctx, x, y, w, h, r) {
    if (h <= 0) { ctx.beginPath(); return; }
    r = Math.min(r, h);
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
  }

  function shortNum(v) {
    if (v >= 1000000) return (v / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (v >= 1000) return (v / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return String(Math.round(v));
  }

  function truncate(ctx, text, maxW) {
    if (ctx.measureText(text).width <= maxW) return text;
    while (text.length > 1 && ctx.measureText(text + '…').width > maxW) text = text.slice(0, -1);
    return text + '…';
  }

  function Chart(el, cfg) {
    this.canvas = typeof el === 'string' ? document.getElementById(el) : el;
    this.cfg = cfg || {};
    if (!this.canvas) return;
    this.render();
    instances.push(this);
  }
  Chart.prototype.render = function () {
    if (!this.canvas || !this.canvas.isConnected) return;
    var t = (this.cfg.type || '').toLowerCase();
    if (t === 'doughnut' || t === 'pie') drawDoughnut(this.canvas, this.cfg);
    else if (t === 'bar') drawBar(this.canvas, this.cfg);
    else placeholder({ ctx: this.canvas.getContext('2d'), w: this.canvas.clientWidth, h: this.canvas.clientHeight }, 'Type non supporté');
  };
  Chart.prototype.destroy = function () {
    var i = instances.indexOf(this); if (i > -1) instances.splice(i, 1);
    var c = this.canvas && this.canvas.getContext && this.canvas.getContext('2d');
    if (c) { c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, this.canvas.width, this.canvas.height); }
  };
  Chart.prototype.update = function () { this.render(); };

  var rid;
  window.addEventListener('resize', function () {
    clearTimeout(rid);
    rid = setTimeout(function () { instances.forEach(function (c) { try { c.render(); } catch (e) {} }); }, 150);
  });

  window.Chart = Chart;
})();
