// ==UserScript==
// @name         VCGamers Auto Promo
// @namespace    local
// @version      2.4
// @description  Refresh jam 14:59:59, pilih produk, isi promo + ID, pilih QRIS, bayar
// @match        https://vcgamers.com/*
// @match        https://www.vcgamers.com/*
// @run-at       document-idle
// @grant        GM_xmlhttpRequest
// @connect      api.isan.eu.org
// @connect      proceck-api.vercel.app
// ==/UserScript==

(function () {
  'use strict';

  /* ================= PENGATURAN ================= */
  // Tidak ada ID di file ini. Akun disimpan di browser lewat menu (tap badge di atas layar).

  const CFG = {
    PRODUCT: 'FF',             // produk awal 'FF' / 'WDP' (bisa diganti lewat menu: tap badge)
    REFRESH_AT: '14:59:59.000', // jam refresh (jam HP/PC)
    TEST_DELAY_SEC: 0,          // >0 = mode tes: refresh N detik setelah halaman dibuka (abaikan REFRESH_AT)
    CARD_FALLBACK_ANY: false,   // true = kalau kartu promo tak ada, klik kartu mana saja (untuk tes)
    CARD_FIRST: false,            // true = cari kartu lewat kata kunci 'card' dulu, baru lewat judul kode promo
    BADGE_ALPHA: 0.5,           // keburaman latar pil: 0.25 = kaca 75% transparan, 0.5 = sedang, 0.8 = hampir solid
    BADGE_TOP: '104px',         // jarak pil status dari atas layar (di bawah header VCGamers)
    DRY_RUN: false,             // true = berhenti sebelum klik "Bayar" (tidak bikin pesanan)
    PAYMENT: 'qris',            // teks metode bayar
    MAX_PROMO_RETRY: 30,        // berapa kali coba ulang pasang promo
    TIMEOUT_MS: 90000,          // batas waktu seluruh proses
  };
  const PROFILES = {
    // card = kata kunci teks kartu nominal yang diklik (huruf kecil semua)
    FF:  { code: 'FFSERIBUAN',  card: ['flash sale'] },
    // skip = kartu yang memuat kata ini dilewati (supaya Weekly Diamond Pass x2 / x3 tidak terpilih)
    // head = judul alternatif yang juga dipakai mencari kartu (kartu pertama di bawahnya), selain judul yang memuat kode promo.
    // ML flash sale: judulnya "Flash Sale MLBB" (tanpa kode), kartunya "Weekly Diamond Pass (Indo)".
    WDP: { code: 'WDPSERIBUAN', card: ['weekly diamond pass'], skip: ['x2', 'x3'], head: ['flash sale mlbb'] },
  };
  /* ============================================== */

  const KEY = 'vc_armed';
  const resolveProduct = () => { try { const p = JSON.parse(localStorage.getItem('vc_accounts_v1')).product; if (p === 'FF' || p === 'WDP') return p; } catch (e) {} return CFG.PRODUCT; };
  const isMine = (e) => badge.contains(e) || panel.contains(e); // elemen milik script ini (badge + menu) jangan ikut dicari/diklik
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s)).filter((e) => !isMine(e));
  const pageText = () => Array.from(document.body.children).filter((e) => e !== badge && e !== panel).map((e) => e.innerText || '').join(' ').toLowerCase();
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const tx = (e) => (e.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const vis = (e) => {
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden';
  };
  const find = (sel, pred) =>
    $$(sel)
      .filter((e) => { const t = tx(e); return t.length < 250 && pred(t, e) && vis(e); })
      .sort((a, b) => tx(a).length - tx(b).length)[0];
  const btn = (pred) => find('button,[role=button],a,div[class*=btn]', pred);
  const isDis = (e) => !!(e.disabled || e.getAttribute('aria-disabled') === 'true' || /disabled/i.test(e.className || ''));

  function click(e) {
    e.scrollIntoView({ block: 'center' });
    ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach((t) =>
      e.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true }))
    );
  }
  function setVal(el, v) {
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set;
    el.focus();
    setter.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // ---------- badge status (pil kaca transparan 75%) ----------
  const hms = (ms) => {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((v) => String(v).padStart(2, '0')).join(':');
  };
  const badge = document.createElement('div');
  badge.style.cssText =
    'position:fixed;top:' + CFG.BADGE_TOP + ';left:50%;transform:translateX(-50%);width:calc(100% - 20px);max-width:420px;box-sizing:border-box;z-index:2147483647;' +
    'display:flex;align-items:center;gap:10px;padding:8px 14px;border-radius:999px;color:#fff;font:13px/1.2 sans-serif;' +
    'background:rgba(27,27,31,' + CFG.BADGE_ALPHA + ');border:1px solid rgba(255,255,255,.3);' +
    'backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);text-shadow:0 1px 2px rgba(0,0,0,.6)';
  const bDot = document.createElement('span');
  bDot.style.cssText = 'width:9px;height:9px;border-radius:50%;flex:none;background:#7c5cff';
  const bTxt = document.createElement('span');
  bTxt.style.cssText = 'flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
  const bRt = document.createElement('span');
  bRt.style.cssText = 'font-variant-numeric:tabular-nums;font-weight:500;flex:none';
  badge.append(bDot, bTxt, bRt);
  document.body.appendChild(badge);
  const say = (m, r) => {
    const grn = /^SELESAI|DRY RUN sukses/.test(m), red = /^STOP/.test(m) && !grn;
    bTxt.textContent = m.replace(/^STOP: /, '').replace(/^SELESAI, /, '');
    bRt.textContent = r || (grn ? 'OK' : red ? 'STOP' : '');
    bDot.style.background = grn ? '#4ade80' : red ? '#ff6b6b' : r && /^\d\d:/.test(r) ? '#7c5cff' : '#ffb020';
  };

  // ---------- penyimpanan akun (dipakai bersama file tes & asli) ----------
  const STORE = 'vc_accounts_v1';
  const defaults = () => ({
    FF:  [],
    WDP: [],
    sel: { FF: 0, WDP: 0 },
    product: CFG.PRODUCT,
  });
  const loadStore = () => {
    try { const o = JSON.parse(localStorage.getItem(STORE)); if (o && Array.isArray(o.FF) && Array.isArray(o.WDP) && o.sel) return o; } catch (e) {}
    return defaults();
  };
  const saveStore = (o) => { try { localStorage.setItem(STORE, JSON.stringify(o)); } catch (e) {} };
  const curAcc = (prod) => { const o = loadStore(); const l = o[prod]; return l[Math.min(o.sel[prod] || 0, l.length - 1)]; };

  // ---------- cek ID lewat API (hanya dipakai saat menyimpan akun) ----------
  const httpGet = (url) => new Promise((resolve, reject) => {
    if (typeof GM_xmlhttpRequest === 'function') {
      GM_xmlhttpRequest({
        method: 'GET', url, timeout: 8000,
        onload: (r) => resolve({ status: r.status, text: r.responseText }),
        onerror: () => reject(new Error('koneksi gagal')),
        ontimeout: () => reject(new Error('waktu habis')),
      });
    } else {
      const t = setTimeout(() => reject(new Error('waktu habis')), 10000);
      fetch(url).then(async (r) => { clearTimeout(t); resolve({ status: r.status, text: await r.text() }); })
        .catch(() => { clearTimeout(t); reject(new Error('koneksi gagal')); });
    }
  });
  const pickNick = (o) => {
    if (!o || typeof o !== 'object') return '';
    for (const k of ['nickname', 'name', 'username', 'userName', 'nick']) if (typeof o[k] === 'string' && o[k].trim()) return o[k].trim();
    for (const k of Object.keys(o)) { const v = pickNick(o[k]); if (v) return v; }
    return '';
  };
  // hasil: {status:'ok', name} | {status:'notfound'} | {status:'error', error}
  // - tiap API dicoba 2x (jeda 1,5 detik) kalau error server/jaringan, seperti HTTP 504
  // - semua API ditanya; satu saja yang menemukan nama = ID benar
  // - "tidak ditemukan" baru dipastikan kalau tidak ada API yang menemukan
  async function checkId(prod, id, zone, onRetry) {
    const e = encodeURIComponent;
    const providers = prod === 'FF'
      ? ['https://api.isan.eu.org/nickname/ff?id=' + e(id), 'https://proceck-api.vercel.app/api/ff/' + e(id)]
      : ['https://api.isan.eu.org/nickname/ml?id=' + e(id) + '&server=' + e(zone), 'https://proceck-api.vercel.app/api/ml/' + e(zone) + '/' + e(id)];
    const ask = async (url) => {
      let err = 'API tidak bisa dihubungi';
      for (let t = 0; t < 2; t++) {
        if (t) { if (onRetry) onRetry(); await sleep(1500); }
        try {
          const r = await httpGet(url);
          let j = null;
          try { j = JSON.parse(r.text); } catch (x) {}
          if (!j) { err = r.status >= 500 ? 'server API bermasalah (HTTP ' + r.status + ')' : 'balasan API tidak terbaca (HTTP ' + r.status + ')'; continue; }
          const nick = pickNick(j);
          if (nick && j.success !== false) return { status: 'ok', name: nick };
          if (j.success === false || j.status === false || [400, 404, 422].includes(r.status)) return { status: 'notfound' };
          err = r.status >= 500 ? 'server API bermasalah (HTTP ' + r.status + ')' : 'balasan API tidak dikenali (HTTP ' + r.status + ')';
        } catch (ex) { err = ex.message; }
      }
      return { status: 'error', error: err };
    };
    let notFound = false, lastErr = 'API tidak bisa dihubungi';
    for (const url of providers) {
      const r = await ask(url);
      if (r.status === 'ok') return r;
      if (r.status === 'notfound') notFound = true; else lastErr = r.error;
    }
    return notFound ? { status: 'notfound' } : { status: 'error', error: lastErr };
  }

  // ---------- panel akun ----------
  let running = false;
  const LOGO = {
    FF: 'data:image/webp;base64,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',
    WDP: 'data:image/webp;base64,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',
  };
  const mask = (v) => (v.length > 4 ? v.slice(0, 2) + '\u2022'.repeat(v.length - 4) + v.slice(-2) : '\u2022'.repeat(v.length));
  const GAME = { FF: { name: 'Free Fire', code: 'FFSERIBUAN' }, WDP: { name: 'Mobile Legends', code: 'WDPSERIBUAN' } };

  const css = document.createElement('style');
  css.textContent = `
  .vca-p{display:none;position:fixed;left:0;right:0;bottom:0;margin:0 auto;max-width:480px;max-height:70vh;overflow:auto;z-index:2147483647;box-sizing:border-box;flex-direction:column;gap:14px;background:#17171c;color:#fff;font:14px/1.4 system-ui,-apple-system,'Segoe UI',sans-serif;padding:10px 16px 0;border-radius:26px 26px 0 0;border-top:1px solid #2c2c33;box-shadow:0 -10px 40px rgba(0,0,0,.55)}
  .vca-p *{box-sizing:border-box;font-family:inherit}
  .vca-p>*{flex:none}
  .vca-p button{cursor:pointer}
  .vca-hd{width:40px;height:4px;border-radius:2px;background:#3a3a42;align-self:center}
  .vca-top{display:flex;align-items:center;justify-content:space-between}
  .vca-ti{font-size:18px;font-weight:700}
  .vca-x{width:36px;height:36px;border-radius:18px;border:0;background:#26262c;display:flex;align-items:center;justify-content:center;padding:0}
  .vca-seg{display:grid;grid-template-columns:1fr 1fr;gap:4px;background:#26262c;border-radius:14px;padding:4px}
  .vca-sg{height:44px;border:0;border-radius:10px;background:transparent;color:#b4b4bf;font-size:14px;font-weight:600;display:flex;align-items:center;justify-content:center;gap:8px;padding:0}
  .vca-sg.on{background:#7c5cff;color:#fff}
  .vca-sg img{width:28px;height:28px;border-radius:8px;object-fit:cover}
  .vca-act{background:#26262c;border-radius:18px;padding:14px;display:flex;flex-direction:column;gap:12px}
  .vca-r{display:flex;align-items:center;gap:12px}
  .vca-lg{width:46px;height:46px;border-radius:14px;object-fit:cover;flex:none}
  .vca-nm{font-weight:700;font-size:16px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .vca-sub{font-size:12px;color:#b4b4bf}
  .vca-chip{background:#12351f;color:#7ee2a0;border-radius:999px;padding:4px 10px;font-size:12px;font-weight:600}
  .vca-inf{display:flex;align-items:center;gap:8px;font-size:13px;color:#b4b4bf;border-top:1px solid #34343c;padding-top:10px}
  .vca-row{display:flex;align-items:center;gap:12px;padding:0 4px}
  .vca-av{width:34px;height:34px;border-radius:50%;background:#2c2c33;color:#c9c9d1;display:flex;align-items:center;justify-content:center;font-weight:600;flex:none}
  .vca-pill{height:32px;padding:0 14px;border-radius:16px;border:1px solid #3a3a42;background:transparent;color:#fff;font-size:13px}
  .vca-ic{background:transparent;border:0;padding:6px;display:flex}
  .vca-add{background:#1e1e24;border:1px solid #2c2c33;border-radius:18px;padding:14px;display:flex;flex-direction:column;gap:10px}
  .vca-stp{display:flex;align-items:center;gap:8px;font-size:12px;color:#b4b4bf}
  .vca-cr{width:22px;height:22px;border-radius:11px;background:#3a3a42;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;flex:none}
  .vca-ln{flex:1;height:4px;border-radius:2px;background:#3a3a42;position:relative;overflow:hidden}
  .vca-lf{position:absolute;left:0;top:0;bottom:0;width:0;border-radius:2px}
  @media (prefers-reduced-motion:reduce){.vca-lf,.vca-p .vca-b{transition:none!important}}
  .vca-g2{display:grid;gap:8px}
  .vca-in{width:100%;height:44px;padding:0 12px;background:#26262c;color:#fff;border:1px solid #3a3a42;border-radius:12px;font-size:14px}
  .vca-in::placeholder{color:rgba(255,255,255,.3);opacity:1}
  .vca-b{height:46px;border:1px solid #3a3a42;border-radius:12px;background:#26262c;color:#fff;font-size:14px;font-weight:700;width:100%}
  .vca-b.ok{background:#15803d;border-color:#15803d}
  .vca-msg{font-size:13px;padding:10px 12px;border-radius:12px}.vca-msg:empty{display:none}
  .vca-msg.bad{background:#4a1d1d;color:#ff9a9a}.vca-msg.ok{background:#12351f;color:#7ee2a0}
  .vca-empty{background:#4a1d1d;color:#ff9a9a;border-radius:14px;padding:12px 14px;font-size:13px}
  .vca-ft{position:sticky;bottom:0;margin:auto -16px 0;padding:10px 16px calc(14px + env(safe-area-inset-bottom,0px));background:#17171c}
  .vca-go{width:100%;height:52px;border:0;border-radius:14px;background:#fff;color:#111;font-size:15px;font-weight:700}
  .vca-by{text-align:center;font-size:11px;color:#8a8a95;margin-top:8px}`;
  document.head.appendChild(css);

  const panel = document.createElement('div');
  panel.className = 'vca-p';
  document.body.appendChild(panel);
  const el = (tag, props, kids) => { const e = document.createElement(tag); Object.assign(e, props || {}); (kids || []).forEach((k) => e.append(k)); return e; };
  const NS = 'http://www.w3.org/2000/svg';
  const svg = (d, size, color, sw) => {
    const s = document.createElementNS(NS, 'svg');
    [['viewBox', '0 0 24 24'], ['width', size], ['height', size], ['fill', 'none'], ['stroke', color], ['stroke-width', sw || 2], ['stroke-linecap', 'round'], ['stroke-linejoin', 'round'], ['aria-hidden', 'true']].forEach((a) => s.setAttribute(a[0], a[1]));
    const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); s.appendChild(p);
    return s;
  };
  const PATH = {
    ok: 'M5 12.5l4.5 4.5L19 7.5',
    x: 'M6 6l12 12M18 6L6 18',
    del: 'M4 7h16M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V4h6v3',
    clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
  };
  const closePanel = () => { panel.style.display = 'none'; };
  const openPanel = () => { renderPanel(); panel.style.display = 'flex'; fitPanel(); };

  function renderPanel() {
    const o = loadStore();
    const prod = resolveProduct();
    const list = o[prod];
    const si = list.length ? Math.min(o.sel[prod] || 0, list.length - 1) : -1;
    const idLine = (a) => mask(a.id) + (a.zone ? ' \u00b7 ' + mask(a.zone) : '');
    const delAcc = (i) => {
      const n = loadStore(); n[prod].splice(i, 1);
      if ((n.sel[prod] || 0) >= n[prod].length) n.sel[prod] = 0;
      saveStore(n); renderPanel();
    };
    const trash = (i) => { const b = el('button', { className: 'vca-ic', onclick: () => delAcc(i) }, [svg(PATH.del, 18, '#a4a4af')]); b.setAttribute('aria-label', 'Hapus akun'); return b; };
    panel.textContent = '';

    // kepala
    const xb = el('button', { className: 'vca-x', onclick: closePanel }, [svg(PATH.x, 16, '#c9c9d1', 2.4)]);
    xb.setAttribute('aria-label', 'Tutup');
    panel.append(el('div', { className: 'vca-hd' }), el('div', { className: 'vca-top' }, [el('div', { className: 'vca-ti', textContent: 'Akun & produk' }), xb]));

    // pilih produk
    const seg = el('div', { className: 'vca-seg' });
    ['FF', 'WDP'].forEach((k) => seg.append(el('button', {
      className: 'vca-sg' + (k === prod ? ' on' : ''),
      onclick: () => { const n = loadStore(); n.product = k; saveStore(n); renderPanel(); },
    }, [el('img', { src: LOGO[k], alt: '' }), GAME[k].name])));
    panel.append(seg);

    // akun aktif
    const info = CFG.TEST_DELAY_SEC > 0 ? 'Mode tes' + (CFG.DRY_RUN ? ' (tidak klik Bayar)' : '') : 'Refresh otomatis ' + CFG.REFRESH_AT.slice(0, 8);
    if (list.length) {
      const a = list[si];
      panel.append(el('div', { className: 'vca-act' }, [
        el('div', { className: 'vca-r' }, [
          el('img', { className: 'vca-lg', src: LOGO[prod], alt: '' }),
          el('div', { style: 'flex:1;min-width:0' }, [el('div', { className: 'vca-nm', textContent: a.name }), el('div', { className: 'vca-sub', textContent: 'ID ' + idLine(a) })]),
          el('span', { className: 'vca-chip', textContent: 'Aktif' }),
          trash(si),
        ]),
        el('div', { className: 'vca-inf' }, [svg(PATH.clock, 16, '#b4b4bf'), info + ' \u00b7 kode ' + GAME[prod].code]),
      ]));
    } else {
      panel.append(el('div', { className: 'vca-empty', textContent: 'Belum ada akun ' + GAME[prod].name + '. Tambah di bawah.' }));
    }

    // akun lain
    list.forEach((a, i) => {
      if (i === si) return;
      panel.append(el('div', { className: 'vca-row' }, [
        el('span', { className: 'vca-av', textContent: (a.name || '?').charAt(0).toUpperCase() }),
        el('div', { style: 'flex:1;min-width:0' }, [el('div', { className: 'vca-nm', style: 'font-size:14px', textContent: a.name }), el('div', { className: 'vca-sub', textContent: idLine(a) })]),
        el('button', { className: 'vca-pill', textContent: 'Pilih', onclick: () => { const n = loadStore(); n.sel[prod] = i; saveStore(n); renderPanel(); } }),
        trash(i),
      ]));
    });

    // tambah akun: klik 1 = cek ID, klik 2 (tombol hijau) = simpan
    const s1c = el('span', { className: 'vca-cr' }), s2c = el('span', { className: 'vca-cr' });
    const s1t = el('span', { textContent: 'Cek ID' }), s2t = el('span', { textContent: 'Simpan' });
    const lf = el('span', { className: 'vca-lf' });
    const ln = el('span', { className: 'vca-ln' }, [lf]);
    const setStep = (done) => {
      s1c.textContent = ''; s2c.textContent = '2';
      if (done) {
        s1c.append(svg(PATH.ok, 12, '#fff', 3.4));
        s1c.style.background = '#15803d'; s1t.style.color = '#7ee2a0'; s2c.style.background = '#7c5cff'; s2t.style.color = '#fff';
      } else {
        s1c.textContent = '1';
        s1c.style.background = '#7c5cff'; s1t.style.color = '#fff'; s2c.style.background = '#3a3a42'; s2t.style.color = '#b4b4bf';
      }
    };
    setStep(false);
    const id = el('input', { className: 'vca-in', placeholder: prod === 'WDP' ? 'User ID' : 'ID Free Fire', inputMode: 'numeric' });
    const zn = el('input', { className: 'vca-in', placeholder: 'Server ID', inputMode: 'numeric' });
    id.setAttribute('aria-label', prod === 'WDP' ? 'User ID' : 'ID Free Fire'); zn.setAttribute('aria-label', 'Server ID');
    const two = el('div', { className: 'vca-g2', style: 'grid-template-columns:' + (prod === 'WDP' ? '3fr 2fr' : '1fr') }, prod === 'WDP' ? [id, zn] : [id]);
    const msg = el('div', { className: 'vca-msg' });
    const saveBtn = el('button', { className: 'vca-b', textContent: 'Cek ID' });
    let verified = null;
    const setBtn = (t, ok) => { saveBtn.textContent = t; saveBtn.className = 'vca-b' + (ok ? ' ok' : ''); };
    const showMsg = (t, kind) => { msg.className = 'vca-msg' + (kind ? ' ' + kind : ''); msg.textContent = t; };
    // animasi: 'run' = kosong lalu pelan-pelan terisi sampai ~90% (menunggu hasil), 'ok' = penuh hijau, 'bad' = penuh merah, 'idle' = kosong
    const setProg = (mode) => {
      const st = lf.style, bs = saveBtn.style, EASE = 'cubic-bezier(.1,.7,.2,1)';
      if (mode === 'run') {
        st.transition = 'none'; st.width = '0%'; st.background = '#7c5cff';
        bs.transition = 'none'; bs.backgroundImage = 'linear-gradient(#7c5cff,#7c5cff)'; bs.backgroundRepeat = 'no-repeat'; bs.backgroundSize = '0% 100%';
        void lf.offsetWidth; // paksa mulai dari kosong
        st.transition = 'width 9s ' + EASE; st.width = '90%';
        bs.transition = 'background-size 9s ' + EASE; bs.backgroundSize = '90% 100%';
      } else if (mode === 'ok' || mode === 'bad') {
        st.transition = 'width .35s ease-out'; st.width = '100%'; st.background = mode === 'ok' ? '#15803d' : '#ef4444';
        bs.transition = 'none'; bs.backgroundImage = 'none';
      } else {
        st.transition = 'none'; st.width = '0%';
        bs.transition = 'none'; bs.backgroundImage = 'none';
      }
    };
    // ID/server diubah -> hasil cek sebelumnya batal, harus cek ulang
    const resetCheck = () => { verified = null; setBtn('Cek ID'); showMsg(''); setStep(false); setProg('idle'); };
    id.addEventListener('input', resetCheck);
    zn.addEventListener('input', resetCheck);
    saveBtn.onclick = async () => {
      const i = id.value.trim(), z = prod === 'WDP' ? zn.value.trim() : '';
      if (!i) return showMsg('ID wajib diisi', 'bad');
      if (prod === 'WDP' && !z) return showMsg('Server ID wajib untuk ML', 'bad');
      const key = i + '|' + z;
      if (verified && verified.key === key) { // klik ke-2: simpan
        const n = loadStore();
        const name = verified.nick || 'Akun ' + (n[prod].length + 1);
        n[prod].push(prod === 'WDP' ? { name, id: i, zone: z } : { name, id: i });
        n.sel[prod] = n[prod].length - 1;
        saveStore(n); renderPanel();
        return;
      }
      saveBtn.disabled = true; setBtn('Mengecek ID...'); showMsg(''); setProg('run');
      const r = await checkId(prod, i, z, () => setBtn('Mengecek ID... (coba ulang)'));
      saveBtn.disabled = false;
      if (id.value.trim() !== i || (prod === 'WDP' && zn.value.trim() !== z)) { setBtn('Cek ID'); setProg('idle'); return; } // input diubah saat mengecek
      if (r.status === 'ok') {
        verified = { key, nick: r.name };
        setBtn('Konfirmasi & simpan', true); setStep(true); setProg('ok');
        showMsg('ID ditemukan: ' + r.name, 'ok');
      } else {
        verified = null; setBtn('Cek ID'); setStep(false); setProg('bad');
        showMsg(r.status === 'notfound'
          ? (prod === 'WDP' ? 'ID dan server tidak ditemukan' : 'ID tidak ditemukan')
          : 'Cek ID gagal: ' + r.error + '. Coba lagi', 'bad');
      }
    };
    panel.append(el('div', { className: 'vca-add' }, [
      el('div', { style: 'font-size:14px;font-weight:600', textContent: 'Tambah akun ' + GAME[prod].name }),
      el('div', { className: 'vca-stp' }, [s1c, s1t, ln, s2c, s2t]),
      two, msg, saveBtn,
    ]));

    // tombol mulai menempel di dasar
    panel.append(el('div', { className: 'vca-ft' }, [el('button', { className: 'vca-go', textContent: 'Mulai sekarang', onclick: () => { closePanel(); sessionStorage.removeItem(KEY); run(); } }), el('div', { className: 'vca-by', textContent: 'by Foxy Slwly' })]));
  }
  // tinggi sheet mengikuti area layar yang kelihatan, tidak menutupi badge
  const fitPanel = () => {
    const vh = (window.visualViewport && window.visualViewport.height) || window.innerHeight;
    const bt = badge.getBoundingClientRect().bottom;
    panel.style.maxHeight = Math.max(220, Math.floor(vh - bt - 12)) + 'px';
  };
  window.addEventListener('resize', fitPanel);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', fitPanel);
  badge.style.cursor = 'pointer';
  badge.onclick = () => { if (getComputedStyle(panel).display === 'none') openPanel(); else closePanel(); };

  // ---------- proses utama ----------
  async function run() {
    const prod = resolveProduct();
    const P = PROFILES[prod];
    if (!P) return say('STOP: hari ini tidak ada jadwal produk');
    if (running) return;
    running = true;
    const pageHint = { FF: 'free fire', WDP: 'mobile legends' }[prod];
    let pageOk = false;
    for (let i = 0; i < 80; i++) { // tunggu halaman tampil maks 8 detik
      if (pageText().includes(pageHint)) { pageOk = true; break; }
      await sleep(100);
    }
    if (!pageOk) { running = false; return say('STOP: salah halaman, buka halaman ' + pageHint); }
    const acc = curAcc(prod);
    if (!acc) { running = false; return say('STOP: belum ada akun. Tap badge, lalu tambah akun'); }
    const ids = prod === 'FF' ? [acc.id] : [acc.id, acc.zone];
    if (ids.some((v) => !v)) { running = false; return say('STOP: ID/server akun kosong'); }
    const t0 = Date.now();
    const left = () => Date.now() - t0 < CFG.TIMEOUT_MS;
    const body = pageText;
    const stop = (m) => { running = false; say('STOP: ' + m); try { navigator.vibrate && navigator.vibrate([300, 100, 300]); } catch (e) {} };

    // 1. pilih produk
    say('Pilih kartu produk', '1/5');
    const priceCard = (t) => t.length < 140 && /rp\s?[\d.]+/.test(t) && /(diamond|dm\b|weekly|pass)/.test(t);
    const byKw = () => find('div,li,button,label,section', (t) => { const n = t.replace(/[.,]/g, ''); return n.length < 120 && P.card.every((k) => n.includes(k)) && !(P.skip || []).some((k) => n.includes(k)) && /rp\s?\d+/.test(n); });
    const findCard = (strict) => {
      if (CFG.CARD_FIRST) { const k0 = byKw(); if (k0) return k0; }
      // 1) kartu pertama tepat di bawah judul yang memuat kode promo (FFSERIBUAN / WDPSERIBUAN) atau judul alternatif (P.head)
      const code = P.code.toLowerCase();
      const heads = $$('div,span,p,h1,h2,h3,h4').filter((e) => { const t = tx(e); return t.length < 120 && (t.includes(code) || (P.head || []).some((k) => t.includes(k))) && vis(e); });
      const cards = $$('div,li,button,label').filter((e) => priceCard(tx(e)) && vis(e));
      let best = null, bd = 1e9;
      heads.forEach((h) => {
        const hb = h.getBoundingClientRect().bottom;
        cards.forEach((k) => {
          const d = k.getBoundingClientRect().top - hb;
          if (d >= -5 && d < bd) { bd = d; best = k; }
        });
      });
      if (best) return best;
      // 2) kartu dengan kata kunci tambahan (opsional)
      const c = byKw();
      if (c) return c;
      // c) cadangan khusus tes: kartu apa saja yang ada harganya
      if (!strict && CFG.CARD_FALLBACK_ANY) return cards.sort((x, y) => tx(x).length - tx(y).length)[0];
      return null;
    };
    let picked = false, chosen = null;
    for (let i = 0; i < 200 && left(); i++) {
      const c = findCard(i < 30); // 3 detik pertama ketat, sesudahnya boleh cadangan
      if (c) {
        // klik elemen kartu paling dalam yang punya harga, lalu juga induknya yang bisa diklik
        click(c);
        say('Klik kartu ' + tx(c).slice(0, 22), '1/5');
        console.log('[VCAuto] kartu diklik:', c, tx(c));
        picked = true; chosen = c;
        break;
      }
      if (i === 40) say('Kartu belum ketemu', '1/5');
      await sleep(100);
    }
    if (!picked) return stop('kartu produk tidak ketemu');
    await sleep(500);
    // verifikasi: kalau Total masih Rp0, kartu belum benar-benar terpilih -> coba cara klik lain
    const totalZero = () => /total\s*rp\s*0(?![\d.,])/.test(body());
    if (totalZero()) {
      const tries = [() => chosen.click()];
      for (let k = 0, p = chosen.parentElement; k < 3 && p && p !== document.body; k++, p = p.parentElement) { const q = p; tries.push(() => click(q), () => q.click()); }
      for (const t of tries) {
        if (!left()) break;
        say('Kartu belum terpilih, coba cara lain', '1/5');
        try { t(); } catch (e) {}
        await sleep(500);
        if (!totalZero()) break;
      }
      say(totalZero() ? 'Kartu diklik tapi Total masih Rp0' : 'Kartu terpilih', '1/5');
      await sleep(400);
    }
    await sleep(200);

    // 2. isi promo
    say('Isi promo ' + P.code, '2/5');
    let promoOk = false;
    for (let i = 0; i < CFG.MAX_PROMO_RETRY && left(); i++) {
      const inp = $$('input').find((x) => vis(x) && (x.placeholder || '').toLowerCase().includes('promo'));
      if (!inp) {
        const m = btn((t) => t.includes('pilih promo lainnya'));
        if (m && i >= 5) click(m);
        await sleep(300);
        continue;
      }
      setVal(inp, P.code);
      await sleep(150);
      const b = find('button', (t) => t === 'pakai promo');
      if (b) click(b);
      else inp.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
      await sleep(1200);
      const failed = /melebihi|tidak valid|tidak dapat|habis|kuota|promo[^\n]{0,25}tidak ditemukan/.test(body()) && vis(inp);
      if (!failed) { promoOk = true; break; }
      say('Promo gagal, coba lagi (' + (i + 1) + ')', '2/5');
    }
    if (!promoOk) return stop('promo gagal dipasang');

    // 3. isi ID
    say('Isi ID akun', '3/5');
    const getIns = () =>
      $$('input').filter((x) => vis(x) && !/promo|cari|search/i.test(x.placeholder || '') && ['text', 'tel', 'number', ''].includes(x.type));
    let list;
    while (left() && (list = getIns()).length < ids.length) await sleep(150);
    ids.forEach((v, i) => setVal(list[i], v));
    await sleep(300);

    // 4. pilih QRIS
    say('Pilih ' + CFG.PAYMENT.toUpperCase(), '4/5');
    for (let i = 0; i < 30; i++) {
      const q = find('div,li,label,button,img', (t) => t.includes(CFG.PAYMENT) && t.length < 60);
      if (q) { click(q); break; }
      const m = btn((t) => t.includes('cek pembayaran lainnya'));
      if (m && i % 10 === 2) click(m);
      await sleep(200);
    }
    await sleep(500);

    // 5. cek ID -> mengerti -> cek total bayar -> bayar
    say('Cek dan bayar', '5/5');
    // Situs menulis "Informasi ... tidak ditemukan" sebentar selama masih mengecek, lalu berganti "Informasi User ID ditemukan".
    // Jadi ID baru dianggap salah kalau tulisan "tidak ditemukan" bertahan >4 detik dan tulisan "ditemukan" tidak muncul.
    const NF_MSG = prod === 'WDP' ? 'ID dan server tidak ditemukan, cek ID & server' : 'ID tidak ditemukan, cek ID';
    // teks situs: ML "Informasi User ID ditemukan", FF "Informasi Player ID Free Fire ditemukan" / "... tidak ditemukan"
    const idFound = () => /informasi (?:user|player) id(?: free fire)? ditemukan/.test(body());
    const idMissing = () => /informasi (?:(?:user|player) id(?: free fire)?(?: (?:dan|&) (?:zone|server) id)? )?tidak ditemukan/.test(body());
    let missSince = 0, idSeen = false;
    while (left()) {
      if (idMissing()) {
        // jangan klik apa pun (termasuk "Mengerti") selagi tulisan ini tampil; baru dianggap salah kalau bertahan >4 detik
        missSince = missSince || Date.now();
        if (Date.now() - missSince > 4000) return stop(NF_MSG);
        say('ID belum ditemukan, menunggu...', '5/5');
        await sleep(400);
        continue;
      }
      missSince = 0;
      if (idFound() && !idSeen) { idSeen = true; say('ID ditemukan', '5/5'); }
      let b;
      if ((b = btn((t) => t === 'bayar'))) {
        if (CFG.DRY_RUN) return stop('DRY RUN sukses, tombol Bayar ketemu (tidak diklik)');
        click(b);
        await sleep(2500);
        running = false; say('SELESAI, QRIS siap, silakan bayar');
        try { navigator.vibrate && navigator.vibrate([500, 200, 500, 200, 500]); } catch (e) {}
        return;
      }
      if ((b = btn((t) => t === 'mengerti'))) click(b);
      else if ((b = btn((t) => /^cek (user|player) id/.test(t))) && !isDis(b)) click(b);
      else if ((b = btn((t) => t === 'cek total bayar')) && !isDis(b)) click(b);
      await sleep(600);
    }
    stop('timeout');
  }

  // ---------- jadwal refresh ----------
  const armed = +sessionStorage.getItem(KEY) || 0;
  if (armed && Date.now() - armed < 300000) {
    sessionStorage.removeItem(KEY);
    say('halaman dimuat, mulai...');
    run();
  } else {
    const [h, m, s, ms] = CFG.REFRESH_AT.split(/[:.]/).map(Number);
    const target = new Date();
    if (CFG.TEST_DELAY_SEC > 0) target.setTime(Date.now() + CFG.TEST_DELAY_SEC * 1000);
    else target.setHours(h, m, s, ms || 0);
    if (target.getTime() <= Date.now()) {
      say('jam target lewat. Tap = menu akun / mulai manual');
    } else {
      let last = 0;
      const iv = setInterval(() => {
        const now = Date.now();
        if (now >= target.getTime()) {
          clearInterval(iv);
          sessionStorage.setItem(KEY, String(now));
          location.reload();
        } else if (now - last > 250) {
          last = now;
          say(GAME[resolveProduct()].name + ' - ' + (curAcc(resolveProduct()) || { name: 'belum ada akun' }).name, hms(target.getTime() - now));
        }
      }, 10);
    }
  }
})();
