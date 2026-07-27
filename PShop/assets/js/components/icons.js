/* ==========================================================================
   PShop — inline SVG icon set (tree-shakeable, no icon-font dependency)
   Usage: icon('cart', 20) -> '<svg ...>'
   ========================================================================== */
const P = {
  home:      '<path d="M3 10.5L12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9.5 21v-6h5v6"/>',
  search:    '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  cart:      '<circle cx="9" cy="20" r="1.6"/><circle cx="18" cy="20" r="1.6"/><path d="M2.5 3h2.6l2.3 12.2h11.1l2-8.7H6.3"/>',
  heart:     '<path d="M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 1 0-7.1 7.1l8.8 8.8 8.8-8.8a5 5 0 0 0 0-7.1z"/>',
  user:      '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5a7.8 7.8 0 0 1 15 0"/>',
  bell:      '<path d="M18 8a6 6 0 1 0-12 0c0 6-2.5 7.5-2.5 7.5h17S18 14 18 8z"/><path d="M13.7 19.5a2 2 0 0 1-3.4 0"/>',
  grid:      '<rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5"/>',
  menu:      '<path d="M3.5 6.5h17M3.5 12h17M3.5 17.5h17"/>',
  close:     '<path d="M6 6l12 12M18 6L6 18"/>',
  chevronDown:'<path d="M6 9.5l6 6 6-6"/>',
  chevronUp: '<path d="M6 14.5l6-6 6 6"/>',
  chevronLeft:'<path d="M14.5 6l-6 6 6 6"/>',
  chevronRight:'<path d="M9.5 6l6 6-6 6"/>',
  arrowLeft: '<path d="M20 12H4"/><path d="M10 6l-6 6 6 6"/>',
  arrowRight:'<path d="M4 12h16"/><path d="M14 6l6 6-6 6"/>',
  arrowUp:   '<path d="M12 20V4"/><path d="M6 10l6-6 6 6"/>',
  star:      '<path d="M12 2.5l2.9 5.9 6.6 1-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-1L12 2.5z"/>',
  filter:    '<path d="M3.5 5.5h17l-6.8 8v6l-3.4 1.8v-7.8z"/>',
  sort:      '<path d="M7 4v16M7 20l-3.5-3.5M7 20l3.5-3.5"/><path d="M17 20V4M17 4l-3.5 3.5M17 4l3.5 3.5"/>',
  check:     '<path d="M20 6.5L9.4 17 4 11.6"/>',
  checkCircle:'<circle cx="12" cy="12" r="9.2"/><path d="M8 12.4l2.7 2.7L16 9.8"/>',
  xCircle:   '<circle cx="12" cy="12" r="9.2"/><path d="M9 9l6 6M15 9l-6 6"/>',
  alert:     '<path d="M12 3.2L1.8 20.8h20.4z"/><path d="M12 9.5v4.5"/><path d="M12 17.5h.01"/>',
  info:      '<circle cx="12" cy="12" r="9.2"/><path d="M12 11v5.2"/><path d="M12 7.8h.01"/>',
  truck:     '<path d="M2.5 6.5h11v10h-11z"/><path d="M13.5 10h4l3 3v3.5h-7z"/><circle cx="6.5" cy="18.5" r="1.8"/><circle cx="17" cy="18.5" r="1.8"/>',
  package:   '<path d="M20.5 8.2L12 3.3 3.5 8.2v7.6L12 20.7l8.5-4.9z"/><path d="M3.5 8.2L12 13l8.5-4.8M12 13v7.7"/>',
  tag:       '<path d="M20.5 12.9l-7.6 7.6a2 2 0 0 1-2.8 0l-6.6-6.6V4.3h9.6l7.4 7.4a1 1 0 0 1 0 1.2z"/><circle cx="8.2" cy="8.2" r="1.4"/>',
  wallet:    '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H19v3"/><rect x="3" y="7.5" width="18" height="11.5" rx="2.5"/><circle cx="16.8" cy="13.2" r="1.2"/>',
  creditCard:'<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19"/>',
  mapPin:    '<path d="M20 10.5c0 5.5-8 12-8 12s-8-6.5-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10.3" r="2.8"/>',
  phone:     '<path d="M21 16.9v2.6a1.8 1.8 0 0 1-2 1.8 17.7 17.7 0 0 1-7.7-2.7 17.4 17.4 0 0 1-5.4-5.4A17.7 17.7 0 0 1 3.2 5.4 1.8 1.8 0 0 1 5 3.4h2.6a1.8 1.8 0 0 1 1.8 1.6 11.5 11.5 0 0 0 .6 2.6 1.8 1.8 0 0 1-.4 1.9l-1.1 1.1a14.4 14.4 0 0 0 5.4 5.4l1.1-1.1a1.8 1.8 0 0 1 1.9-.4 11.5 11.5 0 0 0 2.6.6 1.8 1.8 0 0 1 1.5 1.8z"/>',
  mail:      '<rect x="2.5" y="4.5" width="19" height="15" rx="2.5"/><path d="M3 7l9 6 9-6"/>',
  lock:      '<rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7"/>',
  eye:       '<path d="M2 12s3.8-6.5 10-6.5S22 12 22 12s-3.8 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff:    '<path d="M10.6 6.1A9.6 9.6 0 0 1 12 6c6.2 0 10 6 10 6a17 17 0 0 1-3.3 3.9M6.2 7.9A16.6 16.6 0 0 0 2 12s3.8 6 10 6a9.7 9.7 0 0 0 4.2-.9"/><path d="M3 3l18 18"/>',
  edit:      '<path d="M4 20h4l11-11-4-4L4 16z"/><path d="M14.5 5.5l4 4"/>',
  trash:     '<path d="M4 7h16"/><path d="M9.5 7V4.8h5V7"/><path d="M6.5 7l1 13h9l1-13"/>',
  plus:      '<path d="M12 5v14M5 12h14"/>',
  minus:     '<path d="M5 12h14"/>',
  share:     '<circle cx="18" cy="5.5" r="2.8"/><circle cx="6" cy="12" r="2.8"/><circle cx="18" cy="18.5" r="2.8"/><path d="M8.5 10.7l7-3.6M8.5 13.3l7 3.6"/>',
  compare:   '<path d="M4.5 7h15M4.5 17h15"/><path d="M8 3.5L4.5 7 8 10.5M16 13.5l3.5 3.5-3.5 3.5"/>',
  copy:      '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>',
  download:  '<path d="M12 3v12"/><path d="M7.5 11L12 15.5 16.5 11"/><path d="M4 20h16"/>',
  refresh:   '<path d="M20.5 12a8.5 8.5 0 1 1-2.5-6"/><path d="M20.5 4.5V10H15"/>',
  settings:  '<circle cx="12" cy="12" r="3.2"/><path d="M19.4 14.5a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.3a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-2.8-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7h-.3a2 2 0 0 1 0-4h.2a1.6 1.6 0 0 0 1.1-2.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1v-.3a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 2.8 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.3a2 2 0 0 1 0 4h-.2a1.6 1.6 0 0 0-1.4 1z"/>',
  logout:    '<path d="M9.5 20H5.5A1.5 1.5 0 0 1 4 18.5v-13A1.5 1.5 0 0 1 5.5 4h4"/><path d="M15 16.5l4.5-4.5L15 7.5"/><path d="M19.5 12H9.5"/>',
  chat:      '<path d="M20.5 11.8a7.9 7.9 0 0 1-8.5 7.9 9 9 0 0 1-2.6-.5L4 21l1.9-5a7.6 7.6 0 0 1-.9-3.6 7.9 7.9 0 0 1 8.4-7.8 7.9 7.9 0 0 1 7.1 7.2z"/>',
  send:      '<path d="M21 3L3 10.5l7.5 3L14 21z"/><path d="M10.5 13.5L21 3"/>',
  clock:     '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.3l3.4 2"/>',
  calendar:  '<rect x="3.5" y="5" width="17" height="16" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  shield:    '<path d="M12 3l7.5 3v5.5c0 5-3.2 8.4-7.5 9.8-4.3-1.4-7.5-4.8-7.5-9.8V6z"/><path d="M9 12.2l2.2 2.2L15.5 10"/>',
  gift:      '<rect x="3" y="9" width="18" height="4" rx="1"/><path d="M5 13v8h14v-8M12 9v12"/><path d="M12 9S10.5 3.5 7.8 4.5 9.2 9 12 9zM12 9s1.5-5.5 4.2-4.5S14.8 9 12 9z"/>',
  zap:       '<path d="M13.5 2L4 14h7l-.5 8L20 10h-7z"/>',
  trending:  '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  award:     '<circle cx="12" cy="9" r="5.5"/><path d="M8.5 13.5L7 22l5-2.5L17 22l-1.5-8.5"/>',
  percent:   '<path d="M19 5L5 19"/><circle cx="7.5" cy="7.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/>',
  box:       '<path d="M21 8.5v7L12 21l-9-5.5v-7L12 3z"/><path d="M3 8.5L12 13l9-4.5"/>',
  layers:    '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5M3 17l9 5 9-5"/>',
  users:     '<circle cx="9" cy="8" r="3.6"/><path d="M2.5 20a6.7 6.7 0 0 1 13 0"/><path d="M16.5 4.7a3.6 3.6 0 0 1 0 6.9M17.5 14.2a6.7 6.7 0 0 1 4 5.8"/>',
  barChart:  '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  pieChart:  '<path d="M21 15.5A9 9 0 1 1 8.5 3v9h9z"/><path d="M15.5 3.5A9 9 0 0 1 20.5 8.5h-5z"/>',
  dollar:    '<path d="M12 2v20"/><path d="M17 6.5c0-2-2.2-3-5-3s-5 1-5 3.2S9 10 12 10.5s5 1.3 5 3.4-2.2 3.3-5 3.3-5-1.1-5-3"/>',
  image:     '<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><circle cx="8.5" cy="9.5" r="1.8"/><path d="M3.5 17l5.2-5 3.8 3.6 3-2.8 4.5 4.2"/>',
  file:      '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  helpCircle:'<circle cx="12" cy="12" r="9.2"/><path d="M9.6 9.3a2.5 2.5 0 1 1 3.4 2.4c-.7.3-1 .9-1 1.6v.4"/><path d="M12 17.2h.01"/>',
  headphones:'<path d="M4 15v-3a8 8 0 1 1 16 0v3"/><rect x="2.5" y="14" width="4.5" height="6.5" rx="2"/><rect x="17" y="14" width="4.5" height="6.5" rx="2"/>',
  rotate:    '<path d="M3 12a9 9 0 1 0 2.6-6.3"/><path d="M3 4.5V10h5.5"/>',
  moon:      '<path d="M20.5 14.2A8.5 8.5 0 1 1 9.8 3.5a6.8 6.8 0 0 0 10.7 10.7z"/>',
  sun:       '<circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.2M12 19.8V22M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2 12h2.2M19.8 12H22M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6"/>',
  facebook:  '<path d="M15.5 8.5h-2a1 1 0 0 0-1 1V12h3l-.5 3h-2.5v7h-3v-7H7v-3h2.5V9.2A3.7 3.7 0 0 1 13.2 5.5h2.3z"/>',
  twitter:   '<path d="M22 5.9a8 8 0 0 1-2.3.6 4 4 0 0 0 1.8-2.2 8 8 0 0 1-2.5 1A4 4 0 0 0 12 8.8a11.3 11.3 0 0 1-8.2-4.2 4 4 0 0 0 1.2 5.3 4 4 0 0 1-1.8-.5 4 4 0 0 0 3.2 3.9 4 4 0 0 1-1.8.1 4 4 0 0 0 3.7 2.8A8 8 0 0 1 2 18a11.3 11.3 0 0 0 6.1 1.8c7.3 0 11.4-6.2 11.2-11.8A8 8 0 0 0 22 5.9z"/>',
  instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r="1.1" fill="currentColor" stroke="none"/>',
  youtube:   '<rect x="2.5" y="5.5" width="19" height="13" rx="4"/><path d="M10.5 9.5l5 2.5-5 2.5z" fill="currentColor" stroke="none"/>',
  whatsapp:  '<path d="M20.5 11.6a8.4 8.4 0 0 1-12.2 7.5L3.5 20.5l1.5-4.6a8.4 8.4 0 1 1 15.5-4.3z"/><path d="M8.9 8.4c.3-.1.7 0 .9.4l.7 1.3a.8.8 0 0 1-.1.9l-.4.4a5.6 5.6 0 0 0 2.6 2.6l.4-.4a.8.8 0 0 1 .9-.1l1.3.7c.4.2.5.6.4.9a2 2 0 0 1-2.4 1.1 8 8 0 0 1-5.4-5.4 2 2 0 0 1 1.1-2.4z"/>'
};

/** Render an icon. @param {keyof P} name */
export function icon(name, size = 20, extraClass = '') {
  const path = P[name] || P.info;
  return `<svg class="ico ${extraClass}" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none"
    stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"
    aria-hidden="true" focusable="false">${path}</svg>`;
}

/** Solid/filled variant (used for stars, hearts). */
export function iconSolid(name, size = 20, extraClass = '') {
  const path = P[name] || P.info;
  return `<svg class="ico ${extraClass}" viewBox="0 0 24 24" width="${size}" height="${size}"
    fill="currentColor" stroke="none" aria-hidden="true" focusable="false">${path}</svg>`;
}

export const ICON_NAMES = Object.keys(P);
export default icon;
