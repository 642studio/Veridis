export function renderDashboardHtml(): string {
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>VERIDIS Console Bridge Dashboard</title>
  <style>
    :root {
      --bg: #0b1217;
      --panel: #101b23;
      --panel-border: #1f3545;
      --ink: #dbe7f2;
      --muted: #90a4b5;
      --accent: #3ac6ff;
      --good: #33d17a;
      --warn: #ffb454;
      --bad: #ff6b6b;
      --chip: #162733;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
      background: radial-gradient(circle at top right, #173146 0%, var(--bg) 52%);
      color: var(--ink);
      min-height: 100vh;
    }

    .wrap {
      max-width: 1240px;
      margin: 0 auto;
      padding: 20px 16px 40px;
    }

    .top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }

    h1 {
      margin: 0;
      font-size: 1.25rem;
      letter-spacing: 0.02em;
    }

    .sub {
      color: var(--muted);
      font-size: 0.92rem;
      margin-top: 4px;
    }

    .chips {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .chip {
      padding: 6px 10px;
      border-radius: 999px;
      background: var(--chip);
      border: 1px solid var(--panel-border);
      font-size: 0.82rem;
      color: var(--muted);
    }

    .chip strong {
      color: var(--ink);
      margin-left: 4px;
      font-weight: 600;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(12, minmax(0, 1fr));
      gap: 12px;
    }

    .card {
      border: 1px solid var(--panel-border);
      border-radius: 12px;
      background: linear-gradient(180deg, rgba(20, 40, 54, 0.48), rgba(10, 18, 26, 0.72));
      padding: 12px;
      min-height: 92px;
    }

    .card h2 {
      margin: 0 0 10px 0;
      font-size: 0.95rem;
      text-transform: uppercase;
      letter-spacing: 0.07em;
      color: var(--muted);
    }

    .span-3 { grid-column: span 3; }
    .span-4 { grid-column: span 4; }
    .span-5 { grid-column: span 5; }
    .span-6 { grid-column: span 6; }
    .span-7 { grid-column: span 7; }
    .span-8 { grid-column: span 8; }
    .span-12 { grid-column: span 12; }

    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 7px 0;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
      font-size: 0.92rem;
    }

    .row:first-of-type { border-top: none; padding-top: 0; }

    .label { color: var(--muted); }

    .status {
      font-weight: 700;
      font-size: 0.85rem;
      padding: 3px 8px;
      border-radius: 999px;
      display: inline-block;
    }

    .ok { color: var(--good); border: 1px solid color-mix(in oklab, var(--good) 65%, #000); }
    .warn { color: var(--warn); border: 1px solid color-mix(in oklab, var(--warn) 65%, #000); }
    .bad { color: var(--bad); border: 1px solid color-mix(in oklab, var(--bad) 65%, #000); }
    .info { color: var(--accent); border: 1px solid color-mix(in oklab, var(--accent) 65%, #000); }

    .controls {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .btn-row {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    button {
      border: 1px solid var(--panel-border);
      border-radius: 10px;
      padding: 8px 12px;
      background: #14202a;
      color: var(--ink);
      cursor: pointer;
      font-weight: 600;
    }

    button:hover { border-color: var(--accent); }
    button:disabled { opacity: 0.5; cursor: not-allowed; }

    input {
      width: 100%;
      border: 1px solid var(--panel-border);
      background: #0d1720;
      color: var(--ink);
      padding: 9px 11px;
      border-radius: 10px;
      font-size: 0.92rem;
    }

    .mono {
      font-family: "IBM Plex Mono", Menlo, monospace;
      font-size: 0.84rem;
      color: #d7e6f6;
      background: rgba(14, 26, 36, 0.72);
      border: 1px solid rgba(255, 255, 255, 0.07);
      border-radius: 8px;
      padding: 8px;
      line-height: 1.35;
      white-space: pre-wrap;
      word-break: break-word;
    }

    .vision {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }

    .snapshot {
      border: 1px solid var(--panel-border);
      border-radius: 10px;
      overflow: hidden;
      background: #091118;
    }

    .snapshot img {
      width: 100%;
      height: 210px;
      object-fit: cover;
      display: block;
      background: #111;
    }

    .snapshot .meta {
      padding: 8px;
      font-size: 0.8rem;
      color: var(--muted);
      border-top: 1px solid rgba(255, 255, 255, 0.06);
    }

    .timeline {
      display: grid;
      gap: 8px;
      max-height: 320px;
      overflow: auto;
      padding-right: 4px;
    }

    .event {
      border: 1px solid rgba(255, 255, 255, 0.09);
      border-radius: 10px;
      padding: 9px;
      background: rgba(9, 15, 20, 0.65);
    }

    .event .head {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      font-size: 0.8rem;
      color: var(--muted);
    }

    .event .msg {
      margin-top: 5px;
      font-size: 0.9rem;
      color: var(--ink);
    }

    .empty {
      color: var(--muted);
      padding: 8px;
      border: 1px dashed rgba(255, 255, 255, 0.15);
      border-radius: 8px;
      font-size: 0.88rem;
    }

    .err {
      color: var(--bad);
      font-size: 0.86rem;
      margin-top: 5px;
    }

    @media (max-width: 980px) {
      .span-3, .span-4, .span-5, .span-6, .span-7, .span-8, .span-12 { grid-column: span 12; }
      .vision { grid-template-columns: 1fr; }
      .snapshot img { height: 230px; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="top">
      <div>
        <h1>VERIDIS Console Voice + Vision Dashboard (Experimental)</h1>
        <div class="sub">Control and monitor del bridge en tiempo real</div>
      </div>
      <div class="chips">
        <div class="chip">Bridge port<strong>3400</strong></div>
        <div class="chip">Auto refresh<strong>1.5s</strong></div>
        <div class="chip">Last update<strong id="lastUpdate">-</strong></div>
      </div>
    </div>

    <div class="grid">
      <section class="card span-4">
        <h2>Runtime</h2>
        <div class="row"><span class="label">State</span><span id="stateBadge" class="status info">-</span></div>
        <div class="row"><span class="label">Realtime WS</span><span id="wsBadge" class="status warn">-</span></div>
        <div class="row"><span class="label">Microphone</span><span id="micBadge" class="status warn">-</span></div>
        <div class="row"><span class="label">Muted</span><span id="mutedBadge" class="status warn">-</span></div>
      </section>

      <section class="card span-4">
        <h2>Controls</h2>
        <div class="controls">
          <div class="btn-row">
            <button id="muteBtn" type="button">Mute</button>
            <button id="unmuteBtn" type="button">Unmute</button>
            <button id="refreshBtn" type="button">Refresh now</button>
          </div>
          <input id="utteranceInput" type="text" value="dame el estado del sistema" />
          <button id="turnBtn" type="button">Run Test Turn</button>
          <div id="controlMessage" class="sub"></div>
          <div id="controlError" class="err"></div>
        </div>
      </section>

      <section class="card span-4">
        <h2>Voice Stream</h2>
        <div class="row"><span class="label">Partial transcript</span></div>
        <div id="partialTranscript" class="mono">-</div>
        <div class="row" style="margin-top:8px;"><span class="label">Final transcript</span></div>
        <div id="finalTranscript" class="mono">-</div>
      </section>

      <section class="card span-6">
        <h2>Last Interaction</h2>
        <div class="row"><span class="label">Turn ID</span><span id="turnIdText">-</span></div>
        <div class="row"><span class="label">Wake transcript</span><span id="wakeText">-</span></div>
        <div class="row"><span class="label">User utterance</span><span id="userText">-</span></div>
        <div class="row"><span class="label">Assistant reply</span><span id="replyText">-</span></div>
        <div class="row"><span class="label">Latency</span><span id="latencyText">-</span></div>
        <div class="row"><span class="label">Vision summary</span><span id="visionSummaryText">-</span></div>
        <div class="row"><span class="label">Finished at</span><span id="finishedAtText">-</span></div>
        <div id="interactionError" class="err"></div>
      </section>

      <section class="card span-6">
        <h2>Vision Snapshots</h2>
        <div id="visionGrid" class="vision"></div>
      </section>

      <section class="card span-12">
        <h2>Recent Activity</h2>
        <div id="activityList" class="timeline"></div>
      </section>
    </div>
  </div>

  <script>
    const el = {
      lastUpdate: document.getElementById('lastUpdate'),
      stateBadge: document.getElementById('stateBadge'),
      wsBadge: document.getElementById('wsBadge'),
      micBadge: document.getElementById('micBadge'),
      mutedBadge: document.getElementById('mutedBadge'),
      partialTranscript: document.getElementById('partialTranscript'),
      finalTranscript: document.getElementById('finalTranscript'),
      turnIdText: document.getElementById('turnIdText'),
      wakeText: document.getElementById('wakeText'),
      userText: document.getElementById('userText'),
      replyText: document.getElementById('replyText'),
      latencyText: document.getElementById('latencyText'),
      visionSummaryText: document.getElementById('visionSummaryText'),
      finishedAtText: document.getElementById('finishedAtText'),
      interactionError: document.getElementById('interactionError'),
      visionGrid: document.getElementById('visionGrid'),
      activityList: document.getElementById('activityList'),
      muteBtn: document.getElementById('muteBtn'),
      unmuteBtn: document.getElementById('unmuteBtn'),
      refreshBtn: document.getElementById('refreshBtn'),
      turnBtn: document.getElementById('turnBtn'),
      utteranceInput: document.getElementById('utteranceInput'),
      controlMessage: document.getElementById('controlMessage'),
      controlError: document.getElementById('controlError')
    };

    function escapeHtml(text) {
      if (typeof text !== 'string') return '';
      return text
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
    }

    function fmtDate(iso) {
      if (!iso) return '-';
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return iso;
      return d.toLocaleString();
    }

    function setBadge(node, text, mode) {
      node.textContent = text;
      node.className = 'status ' + mode;
    }

    async function postJson(url, payload) {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload ? JSON.stringify(payload) : undefined
      });
      let json = null;
      try { json = await response.json(); } catch (_) { json = null; }
      if (!response.ok) {
        throw new Error((json && json.error) ? json.error : ('HTTP ' + response.status));
      }
      return json;
    }

    async function refresh() {
      const response = await fetch('/dashboard/data', { cache: 'no-store' });
      if (!response.ok) throw new Error('No data from /dashboard/data');
      const data = await response.json();
      render(data);
    }

    function render(data) {
      const status = data.status || {};
      const interaction = data.interaction;
      const transcripts = data.transcripts || {};
      const activity = Array.isArray(data.activity) ? data.activity : [];

      el.lastUpdate.textContent = new Date().toLocaleTimeString();

      setBadge(el.stateBadge, status.state || '-', 'info');
      setBadge(el.wsBadge, status.runtime && status.runtime.realtimeConnected ? 'Connected' : 'Disconnected', status.runtime && status.runtime.realtimeConnected ? 'ok' : 'bad');
      setBadge(el.micBadge, status.runtime && status.runtime.microphoneRunning ? 'Running' : 'Stopped', status.runtime && status.runtime.microphoneRunning ? 'ok' : 'bad');
      setBadge(el.mutedBadge, status.muted ? 'Muted' : 'Live', status.muted ? 'warn' : 'ok');

      el.partialTranscript.textContent = transcripts.partial || '-';
      el.finalTranscript.textContent = transcripts.final || '-';

      el.turnIdText.textContent = interaction && interaction.turnId ? interaction.turnId : '-';
      el.wakeText.textContent = interaction && interaction.wakeTranscript ? interaction.wakeTranscript : '-';
      el.userText.textContent = interaction && interaction.utterance ? interaction.utterance : '-';
      el.replyText.textContent = interaction && interaction.reply ? interaction.reply : '-';
      el.latencyText.textContent = interaction && typeof interaction.latencyMs === 'number' ? String(interaction.latencyMs) + ' ms' : '-';
      el.visionSummaryText.textContent = interaction && interaction.visionSummary ? interaction.visionSummary : '-';
      el.finishedAtText.textContent = interaction && interaction.finishedAt ? fmtDate(interaction.finishedAt) : '-';
      el.interactionError.textContent = interaction && interaction.error ? interaction.error : '';

      const snapshots = interaction && Array.isArray(interaction.snapshots) ? interaction.snapshots : [];
      if (snapshots.length === 0) {
        el.visionGrid.innerHTML = '<div class="empty">No snapshots yet. Run a turn or trigger wake phrase.</div>';
      } else {
        el.visionGrid.innerHTML = snapshots.map(function (snap) {
          const img = snap.imageDataUrl
            ? '<img src="' + snap.imageDataUrl + '" alt="' + escapeHtml(snap.source || 'snapshot') + '" />'
            : '<div class="empty">Image preview unavailable</div>';
          return '<div class="snapshot">' + img +
            '<div class="meta">' +
            '<div><strong>' + escapeHtml(snap.source || 'snapshot') + '</strong></div>' +
            '<div>' + escapeHtml(fmtDate(snap.capturedAt)) + '</div>' +
            '</div></div>';
        }).join('');
      }

      if (activity.length === 0) {
        el.activityList.innerHTML = '<div class="empty">No activity yet.</div>';
      } else {
        el.activityList.innerHTML = activity.map(function (entry) {
          const meta = entry && entry.data ? escapeHtml(JSON.stringify(entry.data)) : '';
          return '<article class="event">' +
            '<div class="head"><span>' + escapeHtml(entry.type || 'event') + '</span><span>' + escapeHtml(fmtDate(entry.at)) + '</span></div>' +
            '<div class="msg">' + escapeHtml(entry.message || '-') + '</div>' +
            (meta ? '<div class="mono" style="margin-top:8px;">' + meta + '</div>' : '') +
            '</article>';
        }).join('');
      }
    }

    async function sendControl(url, payload) {
      el.controlError.textContent = '';
      try {
        const result = await postJson(url, payload);
        el.controlMessage.textContent = 'OK: ' + new Date().toLocaleTimeString();
        return result;
      } catch (error) {
        el.controlError.textContent = error instanceof Error ? error.message : String(error);
        throw error;
      }
    }

    el.muteBtn.addEventListener('click', async function () {
      await sendControl('/control/mute');
      await refresh();
    });

    el.unmuteBtn.addEventListener('click', async function () {
      await sendControl('/control/unmute');
      await refresh();
    });

    el.refreshBtn.addEventListener('click', async function () {
      await refresh();
    });

    el.turnBtn.addEventListener('click', async function () {
      const utterance = String(el.utteranceInput.value || '').trim();
      if (!utterance) {
        el.controlError.textContent = 'Ingresa un texto para test-turn.';
        return;
      }
      el.turnBtn.disabled = true;
      try {
        await sendControl('/control/test-turn', { utterance: utterance });
        await refresh();
      } finally {
        el.turnBtn.disabled = false;
      }
    });

    async function loop() {
      try {
        await refresh();
      } catch (error) {
        el.controlError.textContent = 'Refresh error: ' + (error instanceof Error ? error.message : String(error));
      } finally {
        setTimeout(loop, 1500);
      }
    }

    loop();
  </script>
</body>
</html>`;
}
