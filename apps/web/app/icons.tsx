/**
 * One drawn icon style for the whole app (Constant, 2026-11-07): simple line icons, all the
 * same weight, instead of a mix of emoji that look different on every phone.
 *
 * Pages still name icons by emoji (icon: "🎓"), so nothing had to change page by page: <Icon of="🎓" />
 * draws the matching line icon, and any emoji without a drawing shows as the emoji itself.
 * The team admin uses the same set by name (see ICONS keys).
 */

export const ICONS: Record<string, string> = {
  home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c0-4 3.4-6.5 7.5-6.5s7.5 2.5 7.5 6.5"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><path d="M16 4.6a3.5 3.5 0 010 6.8M21.5 20c0-3-1.8-5.2-4.5-5.8"/>',
  grad: '<path d="M2.5 9L12 4l9.5 5-9.5 5z"/><path d="M6 11v5c2 2 10 2 12 0v-5"/><path d="M21.5 9v6"/>',
  check: '<circle cx="12" cy="12" r="8.5"/><path d="M8 12.5l2.7 2.7L16.5 9.5"/>',
  tick: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  puzzle: '<path d="M10 3.5a2 2 0 014 0V6h3.5a1 1 0 011 1v3.5a2 2 0 010 4V18a1 1 0 01-1 1H14v-1.5a2 2 0 00-4 0V19H6.5a1 1 0 01-1-1v-3.5a2 2 0 010-4V7a1 1 0 011-1H10z"/>',
  folder: '<path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><path d="M3 11h18"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l5 5"/>',
  compass: '<circle cx="12" cy="12" r="8.5"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>',
  chart: '<path d="M4 20h16"/><path d="M7 16v-5M12 16V7M17 16v-8"/>',
  wrench: '<path d="M14.5 4.5a4.5 4.5 0 015.3 5.9L9 21l-3-3L16.8 7.2a4.5 4.5 0 01-2.3-2.7z"/>',
  toolbox: '<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M9 8V6a2 2 0 012-2h2a2 2 0 012 2v2M3 13h18M10 12v3M14 12v3"/>',
  bag: '<path d="M5 8h14l-1 13H6z"/><path d="M9 8V6a3 3 0 016 0v2"/>',
  medal: '<circle cx="12" cy="14.5" r="5"/><path d="M8.5 10L6 3h4l2 5 2-5h4l-2.5 7"/>',
  trophy: '<path d="M8 4h8v6a4 4 0 01-8 0z"/><path d="M8 6H5a3 3 0 003 3M16 6h3a3 3 0 01-3 3"/><path d="M12 14v4M8.5 21h7M9.5 18h5"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  file: '<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5"/><path d="M9 13h7M9 17h5"/>',
  pen: '<path d="M4 20l4-1L19.5 7.5a2.1 2.1 0 00-3-3L5 16z"/><path d="M14.5 6.5l3 3"/>',
  pencil: '<path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 013 3L8 19z"/><path d="M14.5 6.5l3 3M4 20h5"/>',
  clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4a3 3 0 016 0"/><path d="M9 11h6M9 15h4"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 8l9 6 9-6"/>',
  heartmail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 8l9 6 9-6"/>',
  money: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6.5 9.5v.01M17.5 14.5v.01"/>',
  receipt: '<path d="M6 3h12v18l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5-2 1.5z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  scale: '<path d="M12 4v16M5 20h14M4 8h16"/><path d="M7 8l-3 6a3 3 0 006 0zM17 8l-3 6a3 3 0 006 0z"/>',
  owl: '<circle cx="12" cy="13" r="7.5"/><circle cx="9.5" cy="11.5" r="1.3"/><circle cx="14.5" cy="11.5" r="1.3"/><path d="M4.5 13l1.5-7 3 3M19.5 13L18 6l-3 3M12 14l1.5 2h-3z"/>',
  robot: '<rect x="4" y="8" width="16" height="11" rx="3"/><path d="M12 8V4M9.5 3.5h5"/><circle cx="9" cy="13" r="1.2"/><circle cx="15" cy="13" r="1.2"/><path d="M9 16.5h6"/>',
  book: '<path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2z"/><path d="M4 21V5"/><path d="M8 7h7M8 11h5"/>',
  note: '<path d="M6 3h12v18H6z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  key: '<circle cx="8" cy="14" r="4"/><path d="M11 11l9-9M16 6l2.5 2.5M13 9l2.5 2.5"/>',
  school: '<path d="M3 21h18M5 21V9l7-5 7 5v12"/><path d="M10 21v-5h4v5M9 11h.01M15 11h.01M12 13h.01"/>',
  bank: '<path d="M3 9l9-5 9 5H3zM4 21h16M6 12v6M10 12v6M14 12v6M18 12v6"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 018 0v3"/><path d="M12 15v2"/>',
  card: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18M7 14h4"/>',
  help: '<circle cx="12" cy="12" r="8.5"/><path d="M9.5 9.5a2.5 2.5 0 015 0c0 1.5-2.5 2-2.5 3.5M12 17h.01"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  logout: '<path d="M15 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3"/><path d="M10 17l-5-5 5-5M5 12h11"/>',
  ball: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7l4.5 3.3-1.7 5.4H9.2L7.5 10.3z"/><path d="M12 3.5V7M3.8 10.3l3.7 0M20.2 10.3l-3.7 0M9.2 15.7l-2.5 3.2M14.8 15.7l2.5 3.2"/>',
  bulb: '<path d="M9 18h6M10 21h4"/><path d="M8 11a4 4 0 118 0c0 2-1.5 2.8-2 4.5h-4C9.5 13.8 8 13 8 11z"/>',
  plus: '<circle cx="12" cy="12" r="8.5"/><path d="M12 8v8M8 12h8"/>',
  steth: '<path d="M6 4v5a4 4 0 008 0V4"/><path d="M10 13v3a4 4 0 008 0v-1"/><circle cx="18" cy="12.5" r="2"/>',
  handshake: '<path d="M3 11l4-4h4l3 3-2 2a1.5 1.5 0 01-2-2M21 11l-4-4h-3"/><path d="M3 11l5 5 3 3 3-3M21 11l-5 5"/>',
  shield: '<path d="M12 3l7.5 3v6c0 4.5-3.2 7.8-7.5 9-4.3-1.2-7.5-4.5-7.5-9V6z"/><path d="M9 12l2 2 4-4"/>',
  ring: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.5"/><path d="M12 3.5v5M12 15.5v5M3.5 12h5M15.5 12h5"/>',
  hand: '<path d="M8 13V6a1.5 1.5 0 013 0v5V4.5a1.5 1.5 0 013 0V11V6a1.5 1.5 0 013 0v7.5a6 6 0 01-12 0V9a1.5 1.5 0 013 0z"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6"/>',
  link: '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1.5 1.5"/><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1.5-1.5"/>',
  trend: '<path d="M4 18l5-6 4 3 7-8"/><path d="M15 7h5v5"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
  timer: '<circle cx="12" cy="13" r="7.5"/><path d="M12 9v4l2.5 2M9.5 3h5M12 3v2.5"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>',
  palette: '<path d="M12 3.5a8.5 8.5 0 100 17c1.5 0 2-1 1.5-2s0-2 1.5-2h1.5a4 4 0 004-4c0-5-4-9-8.5-9z"/><circle cx="8" cy="10" r="1.2"/><circle cx="12" cy="7.5" r="1.2"/><circle cx="16" cy="10" r="1.2"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
  globe: '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.5 2.6 3.5 5.4 3.5 8.5s-1 5.9-3.5 8.5c-2.5-2.6-3.5-5.4-3.5-8.5s1-5.9 3.5-8.5z"/>',
  upload: '<path d="M12 16V5M7 10l5-5 5 5"/><path d="M4 19h16"/>',
  slides: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M12 16v4M8 20h8"/>',
  share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/>',
  bug: '<rect x="7.5" y="8" width="9" height="12" rx="4.5"/><path d="M9.5 8a2.5 2.5 0 015 0M3.5 13h4M16.5 13h4M4.5 8.5l3 2M19.5 8.5l-3 2M4.5 18.5l3-2M19.5 18.5l-3-2"/>',
  back: '<path d="M15 18l-6-6 6-6"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M6 11a6 6 0 0012 0M12 17v4M9 21h6"/>',
  flag: '<path d="M5 21V4"/><path d="M5 4h12l-2.5 4L17 12H5"/>',
  heart: '<path d="M12 20s-7-4.5-7-10a4 4 0 017-2.5A4 4 0 0119 10c0 5.5-7 10-7 10z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>',
  leaf: '<path d="M5 19c0-8 5-13 14-13-0 9-5 14-13 14"/><path d="M5 19l9-9"/>',
  pin: '<path d="M12 21s-6-5.5-6-11a6 6 0 0112 0c0 5.5-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/>',
  phone: '<rect x="7" y="2.5" width="10" height="19" rx="2"/><path d="M11 18h2"/>',
  eye: '<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6z"/><circle cx="12" cy="12" r="2.8"/>',
  print: '<path d="M7 8V3h10v5"/><rect x="4" y="8" width="16" height="9" rx="2"/><path d="M7 14h10v7H7z"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 00-2-2H5a2 2 0 00-2 2v9a2 2 0 002 2h3"/>',
  spark: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12"/><path d="M4 6h.01M4 12h.01M4 18h.01"/>',
  dollar: '<circle cx="12" cy="12" r="8.5"/><path d="M12 6.5v11M14.5 9.2c0-1.1-1.1-1.9-2.5-1.9S9.5 8 9.5 9.2c0 2.6 5 1.4 5 4.1 0 1.2-1.1 2-2.5 2s-2.5-.8-2.5-2"/>',
  music: '<circle cx="7" cy="17" r="3"/><circle cx="17" cy="15" r="3"/><path d="M10 17V5l10-2v12"/>',
  trees: '<path d="M8 21v-4M16 21v-3"/><path d="M8 17l-4 0 4-6-2.5 0L8 5l2.5 6-2.5 0z"/><path d="M16 18l-3.5 0L16 11h-2l2-5 2 5h-2l3.5 7z"/>',
  horse: '<path d="M4 20l3-8 4-3 1-5 3 2 4 1v3l-2 1-1 4v5"/><path d="M8 20v-4M16 20v-4"/>',
  flask: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 001.8 3h10.4a2 2 0 001.8-3l-5-9V3"/><path d="M8 15h8"/>',
  rocket: '<path d="M12 3c3.5 2 5 6 5 10l-5 4-5-4c0-4 1.5-8 5-10z"/><circle cx="12" cy="10" r="1.6"/><path d="M7 13l-2.5 3 3.5.5M17 13l2.5 3-3.5.5M10 19l2 2.5 2-2.5"/>',
  cross: '<circle cx="12" cy="12" r="8.5"/><path d="M9 9l6 6M15 9l-6 6"/>',
  warn: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17h.01"/>',
};

/** Emoji used on pages → line icon of the same meaning. Add a line here and every page using that emoji changes. */
export const EMOJI: Record<string, string> = {
  "🏠": "home", "👤": "user", "👪": "users", "👥": "users", "🙋": "hand", "🤝": "handshake",
  "🎓": "grad", "✅": "check", "✔️": "tick", "🧩": "puzzle", "🗂️": "folder", "📁": "folder", "🔎": "search", "🔍": "search", "🧭": "compass", "📊": "chart", "📈": "trend",
  "🔧": "wrench", "🧰": "toolbox", "🛍️": "bag", "🎖️": "medal", "🏅": "medal", "🏆": "trophy", "🗓️": "calendar", "📅": "calendar", "📆": "calendar",
  "📄": "file", "📃": "file", "✍️": "pen", "✏️": "pencil", "📝": "note", "📋": "clipboard", "📨": "mail", "✉️": "mail", "📧": "mail", "💌": "heartmail",
  "💰": "money", "💵": "dollar", "💲": "dollar", "🧾": "receipt", "⚖️": "scale", "💳": "card",
  "🦉": "owl", "🤖": "robot", "📚": "book", "📖": "book", "🔑": "key", "🏫": "school", "🏛️": "bank", "🔐": "lock", "🔒": "lock",
  "❓": "help", "⭐": "star", "🌟": "spark", "✨": "spark", "☰": "menu", "🚪": "logout", "⚽": "ball", "💡": "bulb", "➕": "plus", "🩺": "steth",
  "🛡️": "shield", "🛟": "ring", "🗑️": "trash", "🔗": "link", "💬": "chat", "🎯": "target", "⏱️": "timer", "⏰": "timer", "ℹ️": "info", "🎨": "palette",
  "⚙️": "gear", "🌎": "globe", "🌍": "globe", "🎤": "mic", "🔊": "mic", "🚩": "flag", "❤️": "heart", "💛": "heart", "☀️": "sun", "🌱": "leaf", "📍": "pin", "📱": "phone", "👀": "eye", "🖨️": "print",
  "📣": "share", "🧪": "bug", "🎵": "music", "🌲": "trees", "🐴": "horse", "🧬": "flask", "🚀": "rocket", "❌": "cross", "⚠️": "warn", "📜": "file", "🎒": "bag", "🗒️": "note", "🗃️": "folder", "📌": "pin", "🧮": "chart",
};

export const iconName = (of: string): string | undefined => ICONS[of] ? of : EMOJI[of];

/** A line icon. `of` is an emoji (as pages write them) or an icon name; unknown emoji show as themselves. */
export function Icon({ of, className }: { of: string; className?: string }) {
  const name = iconName(of);
  if (!name) return <span className={className} aria-hidden="true">{of}</span>;
  return <svg className={`ico ${className ?? ""}`} viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICONS[name]! }} />;
}
