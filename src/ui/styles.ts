export const CSS = `
.pcc { --pcc-blue: rgb(37, 99, 235); color: var(--foreground); font-size: 14px; line-height: 1.45; }
.pcc * { box-sizing: border-box; }
.pcc button { font: inherit; color: inherit; background: none; border: 0; cursor: pointer; }
.pcc .muted { color: var(--muted-foreground); }
.pcc svg.pcc-i { width: 16px; height: 16px; flex: none; stroke: currentColor; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.pcc svg.pcc-i.sm { width: 14px; height: 14px; }

.pcc-page { display: flex; min-height: 0; overflow: hidden; border-top: 1px solid var(--border); }
.pcc-side { width: 260px; flex: none; border-right: 1px solid var(--border); display: flex; flex-direction: column; min-height: 0; }
.pcc-side header { display: flex; align-items: center; justify-content: space-between; padding: 12px 12px 10px 16px; }
.pcc-side h1 { font-size: 14px; font-weight: 600; margin: 0; }
.pcc-list { flex: 1; overflow: auto; padding: 0 8px 8px; display: flex; flex-direction: column; gap: 2px; }
.pcc-empty-list { padding: 8px; margin: 0; font-size: 13px; }
.pcc-row { display: flex; align-items: center; border-radius: 8px; }
.pcc-row:hover, .pcc-row.on { background: var(--accent); }
.pcc-row-main { flex: 1; min-width: 0; display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: 8px 10px; text-align: left; }
.pcc-row-title { font-weight: 500; font-size: 13px; width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pcc-row-meta { font-size: 12px; color: var(--muted-foreground); }
.pcc-row-actions { display: none; padding-right: 4px; }
.pcc-row:hover .pcc-row-actions, .pcc-row.on .pcc-row-actions { display: flex; }
.pcc-row.editing { padding: 6px; gap: 4px; }
.pcc-row.editing input { flex: 1; min-width: 0; height: 30px; padding: 0 8px; border: 1px solid var(--border); border-radius: 6px; background: var(--background); color: var(--foreground); font: inherit; }
.pcc-icon-btn { width: 28px; height: 28px; display: grid; place-items: center; border-radius: 6px; color: var(--muted-foreground); }
.pcc-icon-btn:hover { background: var(--accent); color: var(--foreground); }

.pcc-picker { margin: 0 12px 10px; padding: 10px; border: 1px solid var(--border); border-radius: 10px; background: var(--background); }
.pcc-picker-label { margin: 0 0 6px; font-size: 12px; color: var(--muted-foreground); }
.pcc-picker select { width: 100%; height: 32px; border: 1px solid var(--border); border-radius: 8px; padding: 0 8px; background: var(--background); color: var(--foreground); font: inherit; }
.pcc-picker-row { display: flex; justify-content: flex-end; gap: 6px; margin-top: 8px; }
.pcc-btn { height: 30px; padding: 0 12px; border-radius: 8px; border: 1px solid var(--border) !important; background: var(--background) !important; }
.pcc-btn.sm { height: 28px; padding: 0 10px; font-size: 13px; }
.pcc-btn.primary { background: var(--foreground) !important; color: var(--background) !important; border-color: transparent !important; }
.pcc-btn:disabled { opacity: .5; cursor: default; }

.pcc-main { flex: 1; min-width: 0; display: flex; flex-direction: column; min-height: 0; }
.pcc-center-empty { max-width: 420px; text-align: center; margin: auto; padding: 32px 24px; }
.pcc-center-empty .ico { width: 44px; height: 44px; border-radius: 12px; background: var(--accent); display: grid; place-items: center; margin: 0 auto; }
.pcc-center-empty h3 { margin: 12px 0 6px; font-size: 16px; }
.pcc-center-empty p { color: var(--muted-foreground); margin: 0 0 16px; }

.pcc-thread { position: relative; flex: 1; min-height: 0; display: flex; flex-direction: column; }
.pcc-scroll { flex: 1; min-height: 0; overflow-y: auto; }
.pcc-column { max-width: 740px; margin: 0 auto; padding: 24px 24px 180px; display: flex; flex-direction: column; gap: 22px; }
.pcc-intro { text-align: center; padding: 48px 0 8px; }
.pcc-intro h3 { margin: 12px 0 6px; font-size: 18px; font-weight: 600; }
.pcc-intro p { margin: 0 auto; max-width: 440px; color: var(--muted-foreground); }

.pcc-msg.user { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
.pcc-msg.user .pcc-bubble { max-width: 85%; padding: 8px 14px; border-radius: 14px 14px 5px 14px; background: var(--pcc-blue); color: white; font-size: 14px; line-height: 20px; white-space: pre-wrap; overflow-wrap: anywhere; }
.pcc-time { padding: 0 4px; font-size: 11px; color: var(--muted-foreground); }
.pcc-msg.assistant { display: flex; flex-direction: column; gap: 8px; }
.pcc-who { display: flex; align-items: center; gap: 8px; font-size: 14px; }
.pcc-who b { font-weight: 600; }
.pcc-avatar { width: 24px; height: 24px; border-radius: 12px; display: inline-grid; place-items: center; background: var(--accent); color: var(--muted-foreground); font-size: 10px; font-weight: 600; letter-spacing: .02em; flex: none; }
.pcc-avatar.lg { width: 44px; height: 44px; border-radius: 22px; font-size: 14px; }
.pcc-body { font-size: 15px; line-height: 24px; overflow-wrap: anywhere; }
.pcc-body p { margin: 0 0 10px; }
.pcc-body p:last-child { margin-bottom: 0; }
.pcc-error { margin: 0; color: rgb(220, 38, 38); font-size: 13px; }
.pcc-meta { display: flex; align-items: center; gap: 6px; font-size: 11px; color: var(--muted-foreground); }
.pcc-meta a { color: inherit; text-decoration: none; }
.pcc-meta a:hover { color: var(--foreground); text-decoration: underline; }
.pcc-grow { flex: 1; }
.pcc-activity { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--muted-foreground); }
.pcc-dot { width: 8px; height: 8px; border-radius: 4px; background: var(--pcc-blue); animation: pcc-pulse 1.2s ease-in-out infinite; }
@keyframes pcc-pulse { 0%, 100% { opacity: .35; } 50% { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .pcc-dot { animation: none; } }

.pcc-dock { position: absolute; left: 0; right: 0; bottom: 0; padding: 0 24px 16px; pointer-events: none; background: linear-gradient(to bottom, transparent, var(--background) 40%); }
.pcc-composer { pointer-events: auto; max-width: 740px; margin: 0 auto; border: 1px solid var(--border); border-radius: 14px; background: var(--background); box-shadow: 0 1px 2px oklch(0% 0 0 / .05), 0 8px 24px oklch(0% 0 0 / .06); padding: 12px 12px 10px 16px; }
.pcc-composer textarea { width: 100%; resize: none; border: 0; outline: none; background: transparent; color: var(--foreground); font: inherit; font-size: 15px; line-height: 24px; min-height: 48px; max-height: 240px; padding: 0; }
.pcc-composer textarea::placeholder { color: var(--muted-foreground); }
.pcc-composer textarea:disabled { opacity: .6; }
.pcc-composer-row { display: flex; align-items: center; gap: 10px; margin-top: 6px; }
.pcc-note { flex: 1; font-size: 12px; color: var(--muted-foreground); }
.pcc-chip { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--foreground); padding: 0 6px; }
.pcc-send { width: 32px; height: 32px; border-radius: 16px !important; display: grid; place-items: center; background: var(--foreground) !important; color: var(--background) !important; transition: transform .15s; }
.pcc-send:hover:not(:disabled) { transform: scale(1.05); }
.pcc-send:disabled { opacity: .35; cursor: default; }
`;
