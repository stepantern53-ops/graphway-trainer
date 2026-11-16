/** Линейные иконки интерфейса GraphWay. Декоративные: всегда aria-hidden, смысл передаёт текст или aria-label кнопки. */
const paths = {
  left: <path d="M15 5l-7 7 7 7" />,
  right: <path d="M9 5l7 7-7 7" />,
  down: <path d="M7 10l5 5 5-5" />,
  home: <path d="M4 11l8-6.5 8 6.5M6.5 9.5V19h11V9.5" />,
  play: <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" />,
  pause: <><rect x="7" y="5.5" width="3.6" height="13" rx="1.4" fill="currentColor" stroke="none" /><rect x="13.4" y="5.5" width="3.6" height="13" rx="1.4" fill="currentColor" stroke="none" /></>,
  menu: <path d="M5 7h14M5 12h14M5 17h14" />,
  book: <path d="M4 5.5c2.8-1 5.6-1 8 .8 2.4-1.8 5.2-1.8 8-.8v13c-2.8-1-5.6-1-8 .8-2.4-1.8-5.2-1.8-8-.8zM12 6.3v13" />,
  graph: <><path d="M4 4v16h16" /><path d="M7 16l4-5 3 2.5L19 7" /></>,
  check: <path d="M5 12.5l4.2 4.2L19 7" />,
  lock: <><rect x="5.5" y="10.5" width="13" height="9.5" rx="2.5" /><path d="M8.5 10.5V8a3.5 3.5 0 017 0v2.5" /></>,
  grid: <><rect x="4.5" y="4.5" width="6.2" height="6.2" rx="1.8" /><rect x="13.3" y="4.5" width="6.2" height="6.2" rx="1.8" /><rect x="4.5" y="13.3" width="6.2" height="6.2" rx="1.8" /><rect x="13.3" y="13.3" width="6.2" height="6.2" rx="1.8" fill="currentColor" /></>,
  levels: <><rect x="4" y="4" width="7" height="7" rx="2" /><rect x="13" y="4" width="7" height="7" rx="2" /><rect x="4" y="13" width="7" height="7" rx="2" /><path d="M14.5 16.5l2 2 3-4" /></>,
  target: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" /></>,
  eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" /></>,
  hint: <><circle cx="12" cy="12" r="8.5" strokeDasharray="3.2 2.6" /><path d="M12 7.8v5" /><circle cx="12" cy="16.2" r="1.3" fill="currentColor" stroke="none" /></>,
  spark: <path d="M12 3l1.8 6.2L20 11l-6.2 1.8L12 19l-1.8-6.2L4 11l6.2-1.8z" fill="currentColor" stroke="none" />,
  expand: <path d="M4.5 9V4.5H9M15 4.5h4.5V9M19.5 15v4.5H15M9 19.5H4.5V15" />,
  collapse: <path d="M9 4.5V9H4.5M19.5 9H15V4.5M15 19.5V15h4.5M4.5 15H9v4.5" />,
  user: <><circle cx="12" cy="8.5" r="3.8" /><path d="M4.8 19.5c1.4-3.3 4-5 7.2-5s5.8 1.7 7.2 5" /></>,
  logout: <path d="M14 5h4.5v14H14M10 8l-4 4 4 4M6 12h9" />,
  slider: <><path d="M4 8h16M4 16h16" /><circle cx="9" cy="8" r="2.6" fill="currentColor" stroke="none" /><circle cx="15" cy="16" r="2.6" fill="currentColor" stroke="none" /></>
} as const;
export type IconName = keyof typeof paths;
export function Icon({ name, size = 20, className }: { name: IconName; size?: number; className?: string }) {
  return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name]}</svg>;
}
