export const CSS = `
.pcc { color: var(--foreground); font-size: 13px; line-height: 1.45; }
.pcc * { box-sizing: border-box; }
.pcc button { font: inherit; color: inherit; background: none; border: 0; cursor: pointer; }
.pcc textarea, .pcc input, .pcc select { font: inherit; color: inherit; }
.pcc svg.pcc-i { width: 16px; height: 16px; flex: none; stroke: currentColor; fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.pcc svg.pcc-i.sm { width: 14px; height: 14px; }
.pcc .muted { color: var(--muted-foreground); }

.pcc-page { display: flex; height: 100%; min-width: 0; overflow: hidden; }

.pcc-side { width: 272px; flex: none; border-right: 1px solid var(--border); display: flex; flex-direction: column; min-height: 0; background: var(--background); }
.pcc-side header { display: flex; align-items: center; justify-content: space-between; padding: 14px 12px; border-bottom: 1px solid var(--border); }
.pcc-side h1 { font-size: 14px; font-weight: 600; margin: 0; }
.pcc-list { overflow: auto; padding: 6px; flex: 1; }
.pcc-empty-list { padding: 16px 10px; }

.pcc-row { display: flex; align-items: center; gap: 4px; border-radius: 8px; padding: 2px; }
.pcc-row:hover { background: var(--accent); }
.pcc-row.on { background: var(--accent); }
.pcc-row-main { flex: 1; min-width: 0; text-align: left; display: flex; flex-direction: column; gap: 2px; padding: 7px 8px; border-radius: 6px; }
.pcc-row-title { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; }
.pcc-row-meta { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--muted-foreground); font-size: 11.5px; }
.pcc-row-actions { display: none; gap: 2px; padding-right: 4px; }
.pcc-row:hover .pcc-row-actions { display: flex; }
.pcc-icon-btn { display: grid; place-items: center; width: 24px; height: 24px; border-radius: 6px; color: var(--muted-foreground); }
.pcc-icon-btn:hover { background: var(--background); color: var(--foreground); }
.pcc-row.editing { padding: 4px 6px; gap: 6px; }
.pcc-row.editing input { flex: 1; min-width: 0; height: 28px; padding: 0 8px; border: 1px solid var(--border); border-radius: 6px; background: var(--background); }

.pcc-btn { display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 12px; border-radius: 8px; border: 1px solid var(--border); background: var(--background); white-space: nowrap; }
.pcc-btn:hover { background: var(--accent); }
.pcc-btn.primary { background: var(--primary); color: var(--primary-foreground); border-color: transparent; }
.pcc-btn.primary:hover { opacity: .92; }
.pcc-btn:disabled { opacity: .5; cursor: default; }
.pcc-btn.sm { height: 26px; padding: 0 9px; font-size: 12.5px; }

.pcc-picker { margin: 0 6px 8px; padding: 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--accent); display: flex; flex-direction: column; gap: 8px; }
.pcc-picker-label { margin: 0; font-size: 12px; color: var(--muted-foreground); }
.pcc-picker select { height: 32px; padding: 0 8px; border: 1px solid var(--border); border-radius: 6px; background: var(--background); }
.pcc-picker-row { display: flex; justify-content: flex-end; gap: 6px; }

.pcc-main { flex: 1; min-width: 0; display: flex; flex-direction: column; min-height: 0; }
.pcc-thread { flex: 1; min-height: 0; display: flex; flex-direction: column; }
.pcc-thread-head { height: 48px; flex: none; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 8px; padding: 0 16px; }
.pcc-agent { font-weight: 600; }
.pcc-agent-role { color: var(--muted-foreground); text-transform: capitalize; }

.pcc-scroll { flex: 1; min-height: 0; overflow: auto; padding: 18px 20px; display: flex; flex-direction: column; gap: 16px; }

.pcc-msg { display: flex; flex-direction: column; gap: 4px; max-width: 720px; }
.pcc-msg.user { align-self: flex-end; align-items: flex-end; }
.pcc-msg.assistant { align-self: flex-start; align-items: flex-start; }
.pcc-bubble { border-radius: 12px; padding: 9px 13px; white-space: pre-wrap; overflow-wrap: anywhere; }
.pcc-msg.user .pcc-bubble { background: var(--primary); color: var(--primary-foreground); }
.pcc-msg.assistant .pcc-bubble { background: var(--accent); }
.pcc-msg.assistant .pcc-bubble.error { background: color-mix(in oklch, red 12%, var(--accent)); border: 1px solid color-mix(in oklch, red 35%, var(--border)); }
.pcc-bubble :first-child { margin-top: 0; }
.pcc-bubble :last-child { margin-bottom: 0; }
.pcc-bubble p { margin: 0 0 8px; }
.pcc-bubble pre { background: var(--background); border: 1px solid var(--border); border-radius: 8px; padding: 10px; overflow: auto; }
.pcc-bubble code { font: 12px ui-monospace, monospace; }
.pcc-bubble ul, .pcc-bubble ol { margin: 0 0 8px; padding-left: 20px; }
.pcc-bubble a { color: inherit; text-decoration: underline; }
.pcc-msg-meta { display: flex; align-items: center; gap: 8px; color: var(--muted-foreground); font-size: 11.5px; padding: 0 2px; }
.pcc-run-link { color: var(--muted-foreground); text-decoration: none; border-bottom: 1px dotted var(--muted-foreground); }
.pcc-run-link:hover { color: var(--foreground); }

.pcc-activity { display: flex; align-items: center; gap: 6px; color: var(--muted-foreground); font-size: 12px; padding: 2px; }
.pcc-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--muted-foreground); animation: pcc-pulse 1.2s ease-in-out infinite; }
@keyframes pcc-pulse { 0%, 100% { opacity: .3; } 50% { opacity: 1; } }

.pcc-composer { flex: none; border-top: 1px solid var(--border); padding: 12px 16px; display: flex; flex-direction: column; gap: 8px; }
.pcc-notice { margin: 0; padding: 6px 10px; border-radius: 6px; background: var(--accent); color: var(--muted-foreground); font-size: 12px; }
.pcc-composer textarea { width: 100%; min-height: 40px; max-height: 200px; resize: none; padding: 9px 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--background); }
.pcc-composer textarea:focus { outline: none; border-color: var(--muted-foreground); }
.pcc-composer textarea:disabled { opacity: .6; }
.pcc-composer-row { display: flex; align-items: center; gap: 10px; }
.pcc-composer-row .muted { flex: 1; min-width: 0; font-size: 11.5px; }

.pcc-center-empty { margin: auto; max-width: 380px; text-align: center; padding: 24px; display: flex; flex-direction: column; align-items: center; gap: 10px; }
.pcc-center-empty .ico { width: 44px; height: 44px; border-radius: 12px; background: var(--accent); display: grid; place-items: center; }
.pcc-center-empty h3 { margin: 0; font-size: 15px; }
.pcc-center-empty p { margin: 0; color: var(--muted-foreground); }

.pcc-navlink { display: flex; align-items: center; gap: 8px; }
`;
