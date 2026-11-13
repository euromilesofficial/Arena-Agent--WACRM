/* ============================================================
   Icon set (stroke, 24 grid) — inline SVG paths, no icon dependency
   ============================================================ */
import type { CSSProperties } from "react";

const P: Record<string, string> = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.8V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.8"/><path d="M9.5 21v-6h5v6"/>',
    inbox: '<path d="M3 12h4l2 3h6l2-3h4"/><path d="M5.6 5.4 3 12v6a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-6l-2.6-6.6A1 1 0 0 0 17.5 5h-11a1 1 0 0 0-.9.4Z"/>',
    dashboard: '<rect x="3" y="3" width="7.5" height="7.5" rx="1.6"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6"/>',
    users: '<path d="M16 20v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 18.5V20"/><circle cx="10" cy="8" r="3.2"/><path d="M20 20v-1.6a3.4 3.4 0 0 0-2.6-3.3"/><path d="M15.6 5.2a3.1 3.1 0 0 1 0 5.9"/>',
    megaphone: '<path d="M4 10.5v3a1 1 0 0 0 1 1h2l7 4V5.5l-7 4H5a1 1 0 0 0-1 1Z"/><path d="M18 9a4 4 0 0 1 0 6"/><path d="M8 15v4"/>',
    zap: '<path d="M13 2 4.5 13.5H11l-1 8.5L19.5 10H13l0-8Z"/>',
    chart: '<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c2.4 2.5 3.6 5.5 3.6 9s-1.2 6.5-3.6 9c-2.4-2.5-3.6-5.5-3.6-9S9.6 5.5 12 3Z"/>',
    file: '<path d="M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7l-4-4Z"/><path d="M14 3v4h4"/><path d="M9 13h6"/><path d="M9 17h4"/>',
    palette: '<path d="M12 21a9 9 0 1 1 9-9c0 2.2-1.8 3-3.5 3H16a2 2 0 0 0-1.4 3.4A2 2 0 0 1 12 21Z"/><circle cx="8.5" cy="10.5" r="1"/><circle cx="12" cy="7.5" r="1"/><circle cx="15.5" cy="10" r="1"/>',
    blocks: '<rect x="3" y="3" width="8" height="8" rx="1.6"/><rect x="13" y="3" width="8" height="8" rx="1.6"/><rect x="3" y="13" width="8" height="8" rx="1.6"/><path d="M17 13v8"/><path d="M13 17h8"/>',
    menu: '<path d="M4 6h16"/><path d="M4 12h10"/><path d="M4 18h16"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="m4 17 4.5-4.5a1.5 1.5 0 0 1 2.1 0L15 17"/><path d="m14 14 1.7-1.7a1.5 1.5 0 0 1 2.1 0L21 15.7"/>',
    form: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8"/><path d="M8 12h8"/><path d="M8 16h4"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.8-3.8"/>',
    upload: '<path d="M12 16V4"/><path d="m7.5 8.5 4.5-4.5 4.5 4.5"/><path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/>',
    languages: '<path d="M3 6h10"/><path d="M8 3.5V6"/><path d="M10.5 6c0 4-3 7.5-7 9"/><path d="M5.5 10.5c1.4 2.6 3.4 4.2 6 5"/><path d="m13 20 4-10 4 10"/><path d="M14.6 16.4h4.8"/>',
    shield: '<path d="M12 3l7.5 3v5.5c0 4.6-3 8.1-7.5 9.5-4.5-1.4-7.5-4.9-7.5-9.5V6L12 3Z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z"/>',
    sliders: '<path d="M4 6h10"/><path d="M18 6h2"/><circle cx="16" cy="6" r="2"/><path d="M4 12h4"/><path d="M12 12h8"/><circle cx="10" cy="12" r="2"/><path d="M4 18h10"/><path d="M18 18h2"/><circle cx="16" cy="18" r="2"/>',
    bell: '<path d="M18 15V10a6 6 0 1 0-12 0v5l-1.5 3h15L18 15Z"/><path d="M9.5 21a2.6 2.6 0 0 0 5 0"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.2a2.5 2.5 0 1 1 3.7 2.2c-.8.5-1.3 1-1.3 2"/><circle cx="12" cy="17" r=".6" fill="currentColor" stroke="none"/>',
    plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
    chevDown: '<path d="m6 9 6 6 6-6"/>',
    chevRight: '<path d="m9 6 6 6-6 6"/>',
    chevLeft: '<path d="m15 6-6 6 6 6"/>',
    check: '<path d="m5 13 4 4L19 7"/>',
    x: '<path d="M6 6l12 12"/><path d="M18 6 6 18"/>',
    alert: '<path d="M10.3 4.3 2.9 17a1.8 1.8 0 0 0 1.6 2.7h15a1.8 1.8 0 0 0 1.6-2.7L13.7 4.3a1.9 1.9 0 0 0-3.4 0Z"/><path d="M12 9v4"/><circle cx="12" cy="16.6" r=".7" fill="currentColor" stroke="none"/>',
    lock: '<rect x="4.5" y="10" width="15" height="11" rx="2"/><path d="M8 10V7.5a4 4 0 0 1 8 0V10"/>',
    server: '<rect x="3" y="3.5" width="18" height="7" rx="2"/><rect x="3" y="13.5" width="18" height="7" rx="2"/><path d="M7 7h.01"/><path d="M7 17h.01"/>',
    activity: '<path d="M3 12h3.5l2.5-7 4 14 2.5-7H21"/>',
    gauge: '<path d="M12 14 16 9"/><circle cx="12" cy="14" r="1.3" fill="currentColor" stroke="none"/><path d="M3.5 18a9.5 9.5 0 1 1 17 0"/>',
    trendUp: '<path d="m3 16 5.5-5.5 3.5 3.5L21 5"/><path d="M15 5h6v6"/>',
    trendDown: '<path d="m3 8 5.5 5.5L12 10l9 9"/><path d="M21 13v6h-6"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="16" rx="2.5"/><path d="M8 3v4"/><path d="M16 3v4"/><path d="M3.5 10h17"/>',
    pencil: '<path d="M4 20h4L20 8a2.8 2.8 0 0 0-4-4L4 16v4Z"/><path d="m14.5 5.5 4 4"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M15 5.5A2.5 2.5 0 0 0 12.5 3H6a2 2 0 0 0-2 2v8"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.8"/>',
    trash: '<path d="M4 7h16"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><path d="M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13"/><path d="M10 11v6"/><path d="M14 11v6"/>',
    archive: '<rect x="3" y="4" width="18" height="4.5" rx="1.5"/><path d="M4.5 8.5V19a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1V8.5"/><path d="M10 12.5h4"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-13.7-4.9L3 9"/><path d="M4 13a8 8 0 0 0 13.7 4.9L21 15"/><path d="M3 4v5h5"/><path d="M21 20v-5h-5"/>',
    download: '<path d="M12 4v12"/><path d="m7.5 11.5 4.5 4.5 4.5-4.5"/><path d="M4 18v1a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-1"/>',
    sparkles: '<path d="m12 3 1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3Z"/><path d="M18 15.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9.9-2.1Z"/>',
    wifi: '<path d="M4 9a12 12 0 0 1 16 0"/><path d="M7 12.4a8 8 0 0 1 10 0"/><path d="M10 15.8a4 4 0 0 1 4 0"/><circle cx="12" cy="19" r="1" fill="currentColor" stroke="none"/>',
    arrowRight: '<path d="M4 12h15"/><path d="m13 6 6 6-6 6"/>',
    arrowUpRight: '<path d="M7 17 17 7"/><path d="M8 7h9v9"/>',
    more: '<circle cx="5.5" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1.4" fill="currentColor" stroke="none"/>',
    filter: '<path d="M3.5 5h17l-6.6 8v6l-3.8-2v-4L3.5 5Z"/>',
    external: '<path d="M14 4h6v6"/><path d="M20 4 11 13"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5V12l3 2"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m4 7.5 7.2 5.3a1.4 1.4 0 0 0 1.6 0L20 7.5"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none"/>',
    cursor: '<path d="m4 3 7 18 2.6-7.4L21 11 4 3Z"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/>',
    rocket: '<path d="M12 3c3.5 1.5 5.5 5 5.5 9L14 15h-4l-3.5-3C6.5 8 8.5 4.5 12 3Z"/><path d="M9 16c-1.5 1-2 3-1.5 5 2 .5 4 0 5-1.5"/><circle cx="12" cy="10" r="1.4"/>',
    link: '<path d="M10 13.5a4 4 0 0 0 5.7 0l2.8-2.8a4 4 0 0 0-5.7-5.7L11.4 6.4"/><path d="M14 10.5a4 4 0 0 0-5.7 0l-2.8 2.8a4 4 0 0 0 5.7 5.7l1.4-1.4"/>',
    book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5V5.5Z"/><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H19v3H6.5"/>',
    lifebuoy: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.6"/><path d="m5.6 5.6 3.9 3.9"/><path d="m14.5 14.5 3.9 3.9"/><path d="m18.4 5.6-3.9 3.9"/><path d="m9.5 14.5-3.9 3.9"/>',
    sheet: '<rect x="3.5" y="4" width="17" height="16" rx="2"/><path d="M3.5 9.5h17"/><path d="M9.5 9.5V20"/><path d="M15 9.5V20"/>',
    building: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 7h2"/><path d="M13 7h2"/><path d="M9 11h2"/><path d="M13 11h2"/><path d="M9 15h2"/><path d="M13 15h2"/><path d="M10.5 21v-3h3v3"/>',
    columns: '<rect x="3" y="4" width="7.5" height="16" rx="1.6"/><rect x="13.5" y="4" width="7.5" height="16" rx="1.6"/>',
    type: '<path d="M4 6h16"/><path d="M12 6v13"/><path d="M9 19h6"/>',
    folder: '<path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h4l2 2.5h9A1.5 1.5 0 0 1 21 10v8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18V7.5Z"/>',
    code: '<path d="m9 8-5 4 5 4"/><path d="m15 8 5 4-5 4"/>',
    sitemap: '<rect x="9" y="3" width="6" height="4.5" rx="1.2"/><rect x="3" y="16.5" width="6" height="4.5" rx="1.2"/><rect x="15" y="16.5" width="6" height="4.5" rx="1.2"/><path d="M12 7.5v4.5"/><path d="M6 16.5V12h12v4.5"/>',
    coins: '<ellipse cx="9" cy="7" rx="5.5" ry="2.8"/><path d="M3.5 7v4c0 1.5 2.5 2.8 5.5 2.8s5.5-1.3 5.5-2.8V7"/><path d="M14.6 12.4c2.6.4 4.4 1.5 4.4 2.7v3.2c0 1.5-2.5 2.8-5.5 2.8-2.4 0-4.4-.8-5.2-1.9"/>',
    gauge2: '<path d="M12 21a9 9 0 1 1 9-9"/><path d="M12 12l4.5-4.5"/><path d="M21 12v9h-9"/>',
    dot: '<circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/>',
    pause: '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',
    play: '<path d="M7 4.8 19 12 7 19.2V4.8Z"/>',
    beaker: '<path d="M9 3h6"/><path d="M10 3v6.2L5.4 18a2 2 0 0 0 1.7 3h9.8a2 2 0 0 0 1.7-3L14 9.2V3"/><path d="M7.5 14h9"/>',
    user: '<circle cx="12" cy="8" r="3.6"/><path d="M5 20.5a7 7 0 0 1 14 0"/>',
    logout: '<path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3"/><path d="M16 8l4 4-4 4"/><path d="M20 12H9"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5"/><circle cx="12" cy="8" r=".8" fill="currentColor" stroke="none"/>',
    key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 8-8"/><path d="m16 4 3 3"/><path d="m13.5 6.5 3 3"/>',
    pricing: '<path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h11A2.5 2.5 0 0 1 20 8.5v7a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 15.5v-7Z"/><path d="M4 11h16"/>'
  };

export type IconName = keyof typeof P;

export function Icon({ name, size = 15, className, style }: {
  name: string; size?: number; className?: string; style?: CSSProperties;
}) {
  return (
    <svg
      className={`ico ${className ?? ""}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={style}
      dangerouslySetInnerHTML={{ __html: P[name] || P.dot }}
    />
  );
}
