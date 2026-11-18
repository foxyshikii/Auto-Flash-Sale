// ==UserScript==
// @name         TopUpNoLimit Auto FS (TES)
// @namespace    tun-auto-fs-tes
// @version      0.3
// @description  Kamu isi ID/produk/payment/email manual. Script: isi kode promo, Konfirmasi, Buy
// @match        https://topupnolimit.com/*
// @match        https://www.topupnolimit.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  // ================= PENGATURAN =================
  const CFG = {
    START_AT: '18:59:58',   // jam mulai (pakai jam HP, flash sale 19:00 WIB). Tanpa refresh halaman
    TEST_DELAY_SEC: 30,      // >0 = abaikan START_AT, mulai N detik dari sekarang (untuk tes)
    DRY_RUN: false,          // true = berhenti sebelum klik "Buy" (tidak bikin pesanan)
    PROMO: '',              // kode promo. Kosong = ditanya lewat popup saat halaman dibuka
    PROMO_REQUIRED: true,   // true = berhenti kalau kode promo belum ada. Untuk tes tanpa kode: false
    PROMO_RETRY_SEC: 0,    // lama mencoba ulang kalau kode "salah" (mungkin belum aktif). 0 = coba SEKALI saja
    PROMO_FAIL_CONTINUE: true, // true = kalau promo gagal tetap lanjut Konfirmasi dan Buy (untuk tes)
    MAX_TOTAL: 0,        // Buy TIDAK diklik kalau Total Pembayaran lebih dari ini. 0 = tanpa batas
    MAX_SEC: 90,            // batas waktu seluruh proses setelah mulai
  };
  // ==============================================

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const norm = (t) => (t || '').replace(/\s+/g, ' ').trim().toLowerCase();
  const bodyT = () => norm(document.body.innerText);
  const vis = (e) => {
    const r = e.getBoundingClientRect(), s = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
  };
  // elemen paling dalam yang terlihat dan teksnya lolos fn
  const find = (sel, fn) => {
    const all = [...document.querySelectorAll(sel)].filter((e) => vis(e) && fn(norm(e.innerText || e.value || '')));
    return all.filter((e) => !all.some((o) => o !== e && e.contains(o)))[0] || null;
  };
  const click = (e) => { try { e.scrollIntoView({ block: 'center' }); } catch (x) {} e.click(); };
  const setVal = (el, v) => {
    const d = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value');
    d.set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const inputs = () => [...document.querySelectorAll('input')].filter(vis);
  const attrs = (x) => norm([x.placeholder, x.name, x.id, x.type, x.getAttribute('aria-label')].join(' '));
  const getPromo = () => (CFG.PROMO || (() => { try { return localStorage.getItem('tun_promo') || ''; } catch (e) { return ''; } })()).trim();
  const askPromo = () => {
    const v = prompt('Kode promo flash sale (kosongkan kalau belum tahu):', getPromo());
    if (v !== null) { try { localStorage.setItem('tun_promo', v.trim().toUpperCase()); } catch (e) {} }
  };

  // ---------- pil status ----------
  const ui = document.createElement('div');
  ui.style.cssText = 'position:fixed;left:8px;right:8px;top:calc(env(safe-area-inset-top,0px) + 8px);z-index:2147483647;padding:10px 14px;border-radius:24px;background:rgba(20,20,20,.92);color:#fff;font:14px/1.3 system-ui,sans-serif;display:flex;gap:10px;align-items:center;justify-content:space-between';
  const txt = document.createElement('span'); txt.style.cssText = 'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
  const stopBtn = document.createElement('b'); stopBtn.textContent = 'STOP';
  ui.append(txt, stopBtn); document.documentElement.appendChild(ui);
  let halted = false;
  const say = (m, n) => { txt.textContent = (n ? n + ' ' : '') + m; console.log('[TUN]', m); };
  const halt = (m) => { halted = true; say(m); try { navigator.vibrate && navigator.vibrate([300, 100, 300]); } catch (e) {} };
  stopBtn.onclick = () => halt('dihentikan manual');

  // ---------- alur: promo -> Konfirmasi -> Buy ----------
  async function run() {
    const deadline = Date.now() + CFG.MAX_SEC * 1000;
    const left = () => !halted && Date.now() < deadline;

    // 1. kode promo
    const code = getPromo();
    if (!code) {
      if (CFG.PROMO_REQUIRED) return halt('kode promo belum diisi (muat ulang halaman lalu isi di popup)');
      say('Tanpa promo', '1/3');
    } else {
      say('Isi promo ' + code, '1/3');
      const promoInp = () => inputs().find((x) => /kode promo|promo|voucher/.test(attrs(x)));
      const pEnd = Math.min(deadline, Date.now() + CFG.PROMO_RETRY_SEC * 1000);
      let ok = false, tries = 0;
      while (!halted && (tries === 0 || Date.now() < pEnd) && !ok) {
        tries++;
        const pi = promoInp();
        if (!pi) { await sleep(300); continue; }
        setVal(pi, ''); await sleep(100); setVal(pi, code);
        pi.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true }));
        pi.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', keyCode: 13, bubbles: true }));
        pi.blur();
        await sleep(1600);
        if (/kode voucher salah/.test(bodyT())) { say('Kode ditolak/belum aktif' + (CFG.PROMO_RETRY_SEC > 0 ? ', coba lagi...' : ''), '1/3'); await sleep(500); continue; }
        ok = true;
      }
      if (!ok) {
        if (!CFG.PROMO_FAIL_CONTINUE) return halt('kode promo ditolak terus / kolom promo tidak ketemu: ' + code);
        say('Promo gagal, lanjut Konfirmasi', '1/3'); await sleep(500);
      }
    }

    // 2. Konfirmasi -> Detail Pesanan
    say('Konfirmasi', '2/3');
    for (let i = 0; i < 30 && left() && !/detail pesanan/.test(bodyT()); i++) {
      const k = find('button,a,div', (t) => t === 'konfirmasi');
      if (k) click(k);
      await sleep(500);
    }
    if (!/detail pesanan/.test(bodyT())) return halt('Detail Pesanan tidak muncul (cek ID/produk/payment/email sudah diisi?)');

    // 3. cek total, lalu Buy
    const totTxt = (bodyT().match(/total pembayaran\s*rp\s?([\d.,]+)/) || [])[1] || '';
    const total = parseInt(totTxt.replace(/[.,]/g, ''), 10) || 0;
    say('Total Rp' + (totTxt || '?'), '3/3');
    if (CFG.MAX_TOTAL && !total) return halt('total pembayaran tidak terbaca, Buy tidak diklik (set MAX_TOTAL 0 untuk mematikan pengaman)');
    if (CFG.MAX_TOTAL && total > CFG.MAX_TOTAL) return halt('total Rp' + totTxt + ' > batas Rp' + CFG.MAX_TOTAL + ', promo belum terpasang? Buy tidak diklik');
    const buy = find('button', (t) => t === 'buy' || t === 'beli sekarang');
    if (!buy) return halt('tombol Buy tidak ketemu');
    if (CFG.DRY_RUN) return halt('DRY RUN sukses, Buy ketemu, total Rp' + totTxt + ' (tidak diklik)');
    click(buy);
    for (let i = 0; i < 60 && left() && !/menunggu pembayaran/.test(bodyT()); i++) await sleep(300);
    if (/menunggu pembayaran/.test(bodyT())) { halted = true; say('SELESAI, QRIS siap, silakan bayar'); try { navigator.vibrate && navigator.vibrate([500, 200, 500]); } catch (e) {} }
    else halt('timeout setelah klik Buy');
  }

  // ---------- jadwal ----------
  try { if (!getPromo() && CFG.PROMO_REQUIRED && !sessionStorage.getItem('tun_asked')) { sessionStorage.setItem('tun_asked', '1'); askPromo(); } } catch (e) {}
  txt.onclick = () => { if (!halted) askPromo(); };
  const now = Date.now();
  let target;
  if (CFG.TEST_DELAY_SEC > 0) target = now + CFG.TEST_DELAY_SEC * 1000;
  else {
    const [h, m, s] = CFG.START_AT.split(':').map(Number);
    const d = new Date(); d.setHours(h, m, s || 0, 0); target = d.getTime();
  }
  if (now - target > 5 * 60 * 1000) { say('Jam ' + CFG.START_AT + ' sudah lewat, tidak dijalankan'); return; }
  const tick = setInterval(() => {
    if (halted) return clearInterval(tick);
    const sec = Math.ceil((target - Date.now()) / 1000);
    if (sec > 0) { say('Mulai ' + (sec > 60 ? Math.floor(sec / 60) + 'm ' : '') + (sec % 60) + 's lagi | promo: ' + (getPromo() || 'KOSONG') + (CFG.DRY_RUN ? ' | DRY RUN' : '')); return; }
    clearInterval(tick);
    run();
  }, 250);
})();
