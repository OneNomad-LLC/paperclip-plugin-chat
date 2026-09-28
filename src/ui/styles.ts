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
.pcc-row { display: flex; align-items: center; border-radius: 10px; }
.pcc-row:hover { background: color-mix(in oklch, var(--accent) 60%, transparent); }
.pcc-row.on { background: var(--accent); }
.pcc-row-main { flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; padding: 9px 8px 9px 10px; text-align: left; }
.pcc-row-text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.pcc-row-top { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
.pcc-row-title { flex: 1; min-width: 0; font-weight: 500; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pcc-row-time { flex: none; font-size: 11px; color: var(--muted-foreground); }
.pcc-row-meta { font-size: 12px; color: var(--muted-foreground); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pcc-row-actions { display: none; padding-right: 4px; }
.pcc-row:hover .pcc-row-actions { display: flex; }
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
.pcc-head { display: flex; align-items: center; gap: 10px; padding: 12px 20px; border-bottom: 1px solid var(--border); }
.pcc-head-text { display: flex; flex-direction: column; min-width: 0; }
.pcc-head-text b { font-size: 14px; font-weight: 600; }
.pcc-head-text span { font-size: 12px; color: var(--muted-foreground); }
.pcc-scroll { flex: 1; min-height: 0; overflow-y: auto; }
.pcc-column { max-width: 760px; margin: 0 auto; padding: 28px 24px 160px; display: flex; flex-direction: column; gap: 26px; }
.pcc-intro { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 56px 0 8px; }
.pcc-intro h3 { margin: 14px 0 6px; font-size: 20px; font-weight: 600; letter-spacing: -.01em; }
.pcc-intro p { margin: 0 auto; max-width: 460px; color: var(--muted-foreground); line-height: 1.55; }
.pcc-suggest { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin-top: 22px; }
.pcc-suggest button { padding: 8px 14px; border: 1px solid var(--border) !important; border-radius: 999px; background: var(--background) !important; font-size: 13px; color: var(--foreground); transition: background .15s, border-color .15s; }
.pcc-suggest button:hover { background: var(--accent) !important; border-color: color-mix(in oklch, var(--foreground) 25%, var(--border)) !important; }

.pcc-avatar { display: inline-block; flex: none; }
.pcc-avatar svg { display: block; width: 100%; height: 100%; }
.pcc-msg.user { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
.pcc-msg.user .pcc-bubble { max-width: 80%; padding: 9px 14px; border-radius: 18px 18px 6px 18px; background: var(--pcc-blue); color: white; font-size: 14px; line-height: 21px; white-space: pre-wrap; overflow-wrap: anywhere; box-shadow: 0 1px 2px oklch(0% 0 0 / .08); }
.pcc-msg.user .pcc-time { opacity: 0; transition: opacity .15s; }
.pcc-msg.user:hover .pcc-time { opacity: 1; }
.pcc-msg.user.queued .pcc-bubble { background: transparent !important; color: var(--foreground) !important; border: 1px dashed color-mix(in oklch, var(--pcc-blue) 55%, var(--border)) !important; box-shadow: none; cursor: pointer; text-align: left; font: inherit; font-size: 14px; line-height: 21px; }
.pcc-msg.user.queued.editing .pcc-bubble { border-style: solid !important; border-color: var(--pcc-blue) !important; box-shadow: 0 0 0 3px color-mix(in oklch, var(--pcc-blue) 18%, transparent); }
.pcc-queued-meta { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; color: var(--muted-foreground); }
.pcc-editing { pointer-events: auto; max-width: 760px; margin: 0 auto 8px; font-size: 12px; color: var(--foreground); background: color-mix(in oklch, var(--pcc-blue) 12%, var(--background)); border: 1px solid color-mix(in oklch, var(--pcc-blue) 35%, var(--border)); border-radius: 10px; padding: 6px 12px; }
.pcc-editing kbd { font: 10px ui-monospace, monospace; border: 1px solid var(--border); border-bottom-width: 2px; border-radius: 4px; padding: 0 4px; }
.pcc-time { padding: 0 4px; font-size: 11px; color: var(--muted-foreground); font-variant-numeric: tabular-nums; }
.pcc-msg.assistant { display: grid; grid-template-columns: 28px 1fr; column-gap: 12px; align-items: start; }
.pcc-content { min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.pcc-who { display: flex; align-items: center; gap: 8px; min-height: 28px; }
.pcc-who b { font-size: 14px; font-weight: 600; }
.pcc-tools { display: flex; gap: 2px; opacity: 0; transition: opacity .15s; }
.pcc-msg.assistant:hover .pcc-tools { opacity: 1; }
.pcc-body { font-size: 15px; line-height: 1.65; overflow-wrap: anywhere; }
.pcc-body p { margin: 0 0 10px; }
.pcc-body p:last-child, .pcc-body ul:last-child, .pcc-body ol:last-child { margin-bottom: 0; }
.pcc-body ul, .pcc-body ol { padding-left: 20px; margin: 4px 0 12px; }
.pcc-body li { margin: 3px 0; }
.pcc-body h1, .pcc-body h2, .pcc-body h3, .pcc-body h4 { font-size: 15px; font-weight: 600; margin: 16px 0 6px; }
.pcc-body code { font-size: 13px; padding: 1px 5px; border-radius: 5px; background: var(--accent); }
.pcc-body pre { background: var(--accent); border-radius: 10px; padding: 12px 14px; overflow-x: auto; }
.pcc-body pre code { padding: 0; background: none; }
.pcc-error { margin: 0; color: rgb(220, 38, 38); font-size: 13px; }
.pcc-grow { flex: 1; }
.pcc-activity { display: flex; align-items: center; gap: 10px; font-size: 13px; color: var(--muted-foreground); min-height: 20px; }
.pcc-typing { display: inline-flex; gap: 4px; }
.pcc-typing i { width: 6px; height: 6px; border-radius: 3px; background: var(--muted-foreground); animation: pcc-bounce 1.2s ease-in-out infinite; }
.pcc-typing i:nth-child(2) { animation-delay: .15s; }
.pcc-typing i:nth-child(3) { animation-delay: .3s; }
@keyframes pcc-bounce { 0%, 80%, 100% { opacity: .3; transform: translateY(0); } 40% { opacity: 1; transform: translateY(-3px); } }
@media (prefers-reduced-motion: reduce) { .pcc-typing i { animation: none; opacity: .6; } }

.pcc-dock { position: absolute; left: 0; right: 0; bottom: 0; padding: 24px 24px 14px; pointer-events: none; background: linear-gradient(to bottom, transparent, var(--background) 45%); }
.pcc-composer { pointer-events: auto; max-width: 760px; margin: 0 auto; display: flex; align-items: flex-end; gap: 10px; border: 1px solid var(--border); border-radius: 22px; background: var(--background); box-shadow: 0 1px 2px oklch(0% 0 0 / .06), 0 10px 30px oklch(0% 0 0 / .10); padding: 10px 10px 10px 18px; transition: border-color .15s, box-shadow .15s; }
.pcc-composer:focus-within { border-color: color-mix(in oklch, var(--pcc-blue) 55%, var(--border)); box-shadow: 0 0 0 3px color-mix(in oklch, var(--pcc-blue) 18%, transparent), 0 10px 30px oklch(0% 0 0 / .10); }
.pcc-composer textarea { flex: 1; resize: none; border: 0; outline: none; background: transparent; color: var(--foreground); font: inherit; font-size: 15px; line-height: 24px; min-height: 24px; max-height: 240px; padding: 4px 0; }
.pcc-composer textarea::placeholder { color: var(--muted-foreground); }
.pcc-composer textarea:disabled { opacity: .55; }
.pcc-send { flex: none; width: 34px; height: 34px; border-radius: 17px !important; display: grid; place-items: center; background: var(--pcc-blue) !important; color: white !important; transition: transform .15s, opacity .15s; }
.pcc-send:hover:not(:disabled) { transform: scale(1.06); }
.pcc-send:disabled { opacity: .3; cursor: default; }
.pcc-hint { pointer-events: auto; max-width: 760px; margin: 8px auto 0; display: flex; justify-content: space-between; gap: 12px; font-size: 11px; color: var(--muted-foreground); padding: 0 12px; }
.pcc-hint kbd { font: 10px ui-monospace, monospace; border: 1px solid var(--border); border-bottom-width: 2px; border-radius: 4px; padding: 0 4px; }
`;
