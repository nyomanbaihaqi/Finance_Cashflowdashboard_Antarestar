/* ============================================================================
   ANTARESTAR — CASHFLOW PROJECTION
   icons.js — set ikon SVG (stroke, 24x24) menggantikan emoji.
   Pakai: IK('wallet')            → <svg> ukuran default
          IK('wallet', 18)        → ukuran 18px
          IK('wallet', 18, 'ik-hijau')
   ========================================================================== */
(function (global) {
  'use strict';

  /* Tiap entri = isi dalam <svg viewBox="0 0 24 24"> */
  var P = {
    /* navigasi */
    trending:   '<path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/>',
    calendar:   '<rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
    flask:      '<path d="M9 2.5v6.2L3.8 18a2 2 0 0 0 1.7 3h13a2 2 0 0 0 1.7-3L15 8.7V2.5"/><path d="M7.5 2.5h9M6.4 14.5h11.2"/>',
    fileText:   '<path d="M14 2.5H7a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7.5z"/><path d="M14 2.5v5h5M9 13h6M9 17h4"/>',
    target:     '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.8"/><circle cx="12" cy="12" r="1.3"/>',
    repeat:     '<path d="M17 2.5l3.5 3.5L17 9.5"/><path d="M3.5 12V9.5a3.5 3.5 0 0 1 3.5-3.5h13.5"/><path d="M7 21.5L3.5 18 7 14.5"/><path d="M20.5 12v2.5a3.5 3.5 0 0 1-3.5 3.5H3.5"/>',
    card:       '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19"/>',
    settings:   '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
    inbox:      '<path d="M21.5 12.5h-5l-1.5 3h-6l-1.5-3h-5"/><path d="M5.9 4.7A2 2 0 0 1 7.7 3.5h8.6a2 2 0 0 1 1.8 1.2l3.4 7.8v5a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2v-5z"/>',

    /* aksi */
    plus:       '<path d="M12 5v14M5 12h14"/>',
    minus:      '<path d="M5 12h14"/>',
    x:          '<path d="M18 6L6 18M6 6l12 12"/>',
    check:      '<path d="M20 6L9 17l-5-5"/>',
    search:     '<circle cx="11" cy="11" r="7"/><path d="M20.5 20.5l-4.2-4.2"/>',
    trash:      '<path d="M3.5 6h17M8.5 6V4.5a1.5 1.5 0 0 1 1.5-1.5h4a1.5 1.5 0 0 1 1.5 1.5V6"/><path d="M18.5 6l-.8 13a2 2 0 0 1-2 1.9H8.3a2 2 0 0 1-2-1.9L5.5 6"/><path d="M10 11v5M14 11v5"/>',
    edit:       '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7.5 18.5l-4 1 1-4z"/>',
    copy:       '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    download:   '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5M12 15V3"/>',
    upload:     '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5M12 3v12"/>',
    external:   '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><path d="M15 3h6v6M10 14L21 3"/>',
    refresh:    '<path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/>',
    filter:     '<path d="M22 3H2l8 9.5V19l4 2v-8.5z"/>',
    command:    '<path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 0 0 0-6z"/>',
    grid:       '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',

    /* status & data */
    wallet:     '<path d="M20 12V8.5a2 2 0 0 0-2-2H5.5a2 2 0 0 1 0-4H17"/><path d="M3.5 4.5v13a2 2 0 0 0 2 2H18a2 2 0 0 0 2-2V15"/><path d="M21.5 11.5h-4a2 2 0 0 0 0 4h4z"/>',
    alert:      '<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    info:       '<circle cx="12" cy="12" r="9.5"/><path d="M12 16v-4M12 8h.01"/>',
    shield:     '<path d="M12 21.5s8-4 8-10V5.5l-8-3-8 3V11.5c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/>',
    arrowDown:  '<path d="M12 4.5v15M5.5 13l6.5 6.5 6.5-6.5"/>',
    arrowUp:    '<path d="M12 19.5v-15M5.5 11L12 4.5 18.5 11"/>',
    scale:      '<path d="M12 3v18M7 6l-4 8h8zM17 6l-4 8h8z"/><path d="M4.5 21h15"/>',
    chart:      '<path d="M3 3v17a1 1 0 0 0 1 1h17"/><rect x="7" y="12" width="3" height="6" rx="1"/><rect x="12.5" y="8" width="3" height="10" rx="1"/><rect x="18" y="4.5" width="3" height="13.5" rx="1"/>',
    sheet:      '<rect x="3" y="3" width="18" height="18" rx="2.5"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>',
    clock:      '<circle cx="12" cy="12" r="9.5"/><path d="M12 6.5V12l3.5 2"/>',
    undo:       '<path d="M3 8h11a5.5 5.5 0 1 1 0 11H8"/><path d="M7 4L3 8l4 4"/>',
    chevron:    '<path d="M6 9l6 6 6-6"/>',
    users:      '<path d="M16.5 21v-2a4 4 0 0 0-4-4h-6a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7" r="4"/><path d="M22.5 21v-2a4 4 0 0 0-3-3.9M17 3.1a4 4 0 0 1 0 7.8"/>',
    box:        '<path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.3 7L12 12l8.7-5M12 22V12"/>',
    megaphone:  '<path d="M3 11v2a1 1 0 0 0 1 1h2l4.5 4.5V6.5L6 11H4a1 1 0 0 0-1 1z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/>'
  };

  function IK(nama, ukuran, kelas) {
    var d = P[nama] || P.info;
    var s = ukuran || 18;
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', s);
    svg.setAttribute('height', s);
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.8');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('class', 'ik' + (kelas ? ' ' + kelas : ''));
    svg.innerHTML = d;
    return svg;
  }

  /* versi string, buat disisipkan ke innerHTML */
  function IKS(nama, ukuran, kelas) {
    var d = P[nama] || P.info, s = ukuran || 18;
    return '<svg viewBox="0 0 24 24" width="' + s + '" height="' + s + '" fill="none" stroke="currentColor" ' +
      'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ' +
      'class="ik' + (kelas ? ' ' + kelas : '') + '">' + d + '</svg>';
  }

  global.IK = IK;
  global.IKS = IKS;
  global.IK.daftar = Object.keys(P);
})(window);
