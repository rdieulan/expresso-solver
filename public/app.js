document.addEventListener('DOMContentLoaded', () => {
  const frm = document.getElementById('frm');
  const out = document.getElementById('out');
  const players = document.getElementById('players');
  const depth = document.getElementById('depth');
  const position = document.getElementById('position');
  const hand = document.getElementById('hand');
  const format = document.getElementById('format');
  const showRange = document.getElementById('showRange');
  const metaLine = document.getElementById('metaLine');
  const btnCopy = document.getElementById('btnCopy');
  const btnClear = document.getElementById('btnClear');
  const visual = document.getElementById('visual');
  const rangeCard = document.getElementById('rangeCard');
  const decisionsList = document.getElementById('decisionsList');

  // Profile elements
  const profileSelect = document.getElementById('profileSelect');
  const btnRefreshProfiles = document.getElementById('btnRefreshProfiles');
  const rangesFileInput = document.getElementById('rangesFile');
  const btnUpload = document.getElementById('btnUpload');
  const uploadStatus = document.getElementById('uploadStatus');
  const uploadProfileName = document.getElementById('uploadProfileName');

  let lastJson = null;

  // Simple validation patterns
  const shortPattern = /^([AHKQJT2-9])([AHKQJT2-9])(s|o)?$/i; // AKs, AKo, AA
  const fullCardPattern = /^([AHKQJT2-9])[CDHS]([AHKQJT2-9])[CDHS]$/i; // AhKs

  function normalizeClientHandGuess(input) {
    const s = (input || '').replace(/\s+/g, '').toUpperCase();
    if (shortPattern.test(s)) return s;
    if (fullCardPattern.test(s)) return s;
    return null;
  }

  function validateHandInput() {
    const v = hand.value.trim();
    const ok = normalizeClientHandGuess(v) !== null;
    if (!ok) {
      hand.classList.add('is-invalid');
      if (!document.getElementById('handHelp')) {
        const help = document.createElement('div');
        help.id = 'handHelp';
        help.className = 'invalid-feedback';
        help.textContent = 'Format de main invalide (ex: AhKs, AKs, AK, TsTh)';
        hand.parentNode.appendChild(help);
      }
    } else {
      hand.classList.remove('is-invalid');
      const h = document.getElementById('handHelp');
      if (h) h.remove();
    }
    return ok;
  }

  function actionBadge(action) {
    const span = document.createElement('button');
    span.type = 'button';
    span.classList.add('btn', 'btn-sm', 'badge-action');
    span.textContent = action.toUpperCase();
    switch (action) {
      case 'fold':
        span.classList.add('btn-secondary');
        break;
      case 'call':
        span.classList.add('btn-primary');
        break;
      case 'raise':
        span.classList.add('btn-warning');
        span.classList.add('text-dark');
        break;
      case 'shove':
        span.classList.add('btn-danger');
        break;
      default:
        span.classList.add('btn-light');
    }
    // clicking badge copies action to clipboard
    span.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(action.toUpperCase());
        span.textContent = action.toUpperCase() + ' ✓';
        setTimeout(() => { span.textContent = action.toUpperCase(); }, 900);
      } catch (e) {
        // ignore
      }
    });
    return span;
  }

  function formatProbsInline(probs) {
    if (!probs) return null;
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.gap = '6px';
    container.style.alignItems = 'center';

    const actions = ['fold','call','raise','shove'];
    for (const a of actions) {
      const v = probs[a] || 0;
      if (v > 0) {
        const s = document.createElement('span');
        s.className = 'small text-muted';
        s.textContent = `${Math.round(v*100)}% ${a}`;
        container.appendChild(s);
      }
    }
    return container;
  }

  function renderProbBar(probs) {
    if (!probs) return null;
    const total = Object.values(probs).reduce((s, x) => s + (x || 0), 0);
    if (total <= 0) return null;
    const wrapper = document.createElement('div');
    wrapper.style.width = '160px';
    wrapper.style.height = '12px';
    wrapper.style.display = 'flex';
    wrapper.style.border = '1px solid #e6e6e6';
    wrapper.style.borderRadius = '4px';
    wrapper.style.overflow = 'hidden';

    const colors = { fold: '#6c757d', call: '#0d6efd', raise: '#ffc107', shove: '#dc3545' };
    for (const k of ['fold','call','raise','shove']) {
      const v = (probs[k] || 0) / total;
      const seg = document.createElement('div');
      seg.style.width = `${Math.round(v*100)}%`;
      seg.style.background = colors[k];
      seg.title = `${Math.round(v*100)}% ${k}`;
      wrapper.appendChild(seg);
    }
    return wrapper;
  }

  function clearOutput() {
    out.textContent = 'Aucune requête effectuée.';
    metaLine.textContent = 'Aucune requête effectuée.';
    btnCopy.style.display = 'none';
    visual.style.display = 'none';
    rangeCard.innerHTML = '';
    decisionsList.innerHTML = '';
    lastJson = null;
    hand.classList.remove('is-invalid');
    const h = document.getElementById('handHelp'); if (h) h.remove();
  }

  // Adjust positions allowed based on players count
  function adjustPositions() {
    const p = Number(players.value);
    const current = position.value;
    position.innerHTML = '';
    if (p === 2) {
      const o1 = document.createElement('option'); o1.value = 'SB'; o1.text = 'SB';
      const o2 = document.createElement('option'); o2.value = 'BB'; o2.text = 'BB';
      position.appendChild(o1); position.appendChild(o2);
      if (current === 'BTN') position.value = 'SB';
    } else {
      const o1 = document.createElement('option'); o1.value = 'BTN'; o1.text = 'BTN';
      const o2 = document.createElement('option'); o2.value = 'SB'; o2.text = 'SB';
      const o3 = document.createElement('option'); o3.value = 'BB'; o3.text = 'BB';
      position.appendChild(o1); position.appendChild(o2); position.appendChild(o3);
      position.value = current || 'BTN';
    }
  }

  players.addEventListener('change', () => adjustPositions());
  adjustPositions();

  btnClear.addEventListener('click', () => {
    clearOutput();
  });

  btnCopy.addEventListener('click', async () => {
    if (!lastJson) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(lastJson, null, 2));
      btnCopy.textContent = 'Copié ✓';
      setTimeout(() => { btnCopy.textContent = 'Copier'; }, 1400);
    } catch (e) {
      alert('Impossible de copier: ' + String(e));
    }
  });

  hand.addEventListener('input', () => validateHandInput());

  // Profiles: fetch and populate
  async function fetchProfiles() {
    try {
      const res = await fetch('/api/profiles');
      if (!res.ok) throw new Error('Erreur récupération profils');
      const data = await res.json();
      const list = data.profiles || [];
      profileSelect.innerHTML = '';
      for (const p of list) {
        const opt = document.createElement('option');
        opt.value = p.name;
        opt.text = p.name + (p.active ? ' (actif)' : '');
        if (p.active) opt.selected = true;
        profileSelect.appendChild(opt);
      }
    } catch (e) {
      console.error(e);
      profileSelect.innerHTML = '<option>error</option>';
    }
  }

  btnRefreshProfiles.addEventListener('click', async () => {
    await fetchProfiles();
  });

  // Select profile
  profileSelect.addEventListener('change', async () => {
    const name = profileSelect.value;
    if (!name) return;
    try {
      const res = await fetch('/api/profiles/select', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body && body.error ? body.error : 'Erreur activation profil');
      // Update UI
      await fetchProfiles();
      metaLine.textContent = `Profil activé: ${name}`;
    } catch (e) {
      alert('Impossible d\'activer le profil: ' + String(e));
    }
  });

  // Form submit -> decide
  frm.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (!validateHandInput()) { out.textContent = 'Format de main invalide.'; metaLine.textContent = 'Erreur'; return; }

    out.textContent = 'Chargement...';
    metaLine.textContent = 'Chargement...';
    btnCopy.style.display = 'none';
    visual.style.display = 'none';

    try {
      const q = new URLSearchParams();
      q.set('players', players.value);
      q.set('depth', depth.value);
      q.set('position', position.value);
      q.set('hand', hand.value);
      if (showRange.checked) q.set('showRange', 'true');

      const url = `/api/decide?${q.toString()}`;
      const res = await fetch(url);
      if (!res.ok) { const err = await res.json().catch(()=>null); out.textContent = 'Erreur: ' + (err && err.error ? err.error : res.statusText); metaLine.textContent='Erreur'; return; }

      const data = await res.json();
      lastJson = data;
      metaLine.textContent = `players=${data.meta.players}, depth=${data.meta.depth}bb, hero=${data.meta.heroPos}, hand=${data.meta.handInput} (norm: ${data.meta.normalized}) | profile=${data.meta.profile}`;

      if (format.value === 'json') { out.textContent = JSON.stringify(data, null, 2); btnCopy.style.display = ''; }
      else {
        // pretty output
        let txt = '';
        if (data.range) {
          let rtxt = '';
          if (data.range.FirstIn) { rtxt += 'FirstIn:\n'; for (const k of Object.keys(data.range.FirstIn).sort()) rtxt += `  ${k} -> ${data.range.FirstIn[k]}\n`; }
          if (data.range.VsOpen) { rtxt += 'VsOpen:\n'; for (const v of Object.keys(data.range.VsOpen)) { rtxt += `  contre ${v}:\n`; for (const k of Object.keys(data.range.VsOpen[v]).sort()) rtxt += `    ${k} -> ${data.range.VsOpen[v][k]}\n`; } }
          if (data.range.VsShove) { rtxt += 'VsShove:\n'; for (const v of Object.keys(data.range.VsShove)) { rtxt += `  contre ${v}:\n`; for (const k of Object.keys(data.range.VsShove[v]).sort()) rtxt += `    ${k} -> ${data.range.VsShove[v][k]}\n`; } }
          txt += rtxt + '\n';
        }
        txt += 'Decisions:\n'; for (const d of data.decisions) { const tag = d.villain ? `${d.scenario} vs ${d.villain}` : d.scenario; const probsTxt = d.probs ? ' ' + Object.keys(d.probs).map(k=> d.probs[k] ? `${Math.round(d.probs[k]*100)}%${k[0].toUpperCase()}`: '').filter(Boolean).join('/') : ''; txt += `[${tag}] ${d.hand} -> ${d.action}${probsTxt}\n`; }
        out.textContent = txt;

        // visual
        visual.style.display = '';
        rangeCard.innerHTML = '';
        if (data.range) {
          const heroHand = (data.meta && data.meta.normalized) ? data.meta.normalized : null;
          if (data.range.FirstIn) { const h = document.createElement('div'); h.innerHTML = '<strong>FirstIn</strong><br/>'; const ul = document.createElement('div'); for (const k of Object.keys(data.range.FirstIn).sort()) { const r = document.createElement('div'); r.textContent = `${k} -> ${data.range.FirstIn[k]}`; if (heroHand && k.toUpperCase() === heroHand.toUpperCase()) r.style.backgroundColor = '#fff3cd'; ul.appendChild(r); } h.appendChild(ul); rangeCard.appendChild(h); }
          if (data.range.VsOpen) { const h = document.createElement('div'); h.innerHTML = '<strong>VsOpen</strong><br/>'; for (const v of Object.keys(data.range.VsOpen)) { const title = document.createElement('div'); title.textContent = `contre ${v}:`; title.style.marginTop='6px'; h.appendChild(title); for (const k of Object.keys(data.range.VsOpen[v]).sort()) { const r = document.createElement('div'); r.textContent = `  ${k} -> ${data.range.VsOpen[v][k]}`; if (heroHand && k.toUpperCase()===heroHand.toUpperCase()) r.style.backgroundColor='#fff3cd'; h.appendChild(r); } } rangeCard.appendChild(h); }
          if (data.range.VsShove) { const h = document.createElement('div'); h.innerHTML = '<strong>VsShove</strong><br/>'; for (const v of Object.keys(data.range.VsShove)) { const title = document.createElement('div'); title.textContent = `contre ${v}:`; title.style.marginTop='6px'; h.appendChild(title); for (const k of Object.keys(data.range.VsShove[v]).sort()) { const r = document.createElement('div'); r.textContent = `  ${k} -> ${data.range.VsShove[v][k]}`; if (heroHand && k.toUpperCase()===heroHand.toUpperCase()) r.style.backgroundColor='#fff3cd'; h.appendChild(r); } } rangeCard.appendChild(h); }
        }

        // decisions visual list
        decisionsList.innerHTML = '';
        const groups = {};
        for (const d of data.decisions) { const key = d.villain ? `${d.scenario} vs ${d.villain}` : d.scenario; if (!groups[key]) groups[key] = []; groups[key].push(d); }
        for (const key of Object.keys(groups)) { const box = document.createElement('div'); box.className='mb-2 p-2 border rounded'; const title=document.createElement('div'); title.innerHTML=`<strong>${key}</strong>`; box.appendChild(title); for (const d of groups[key]) { const row=document.createElement('div'); row.className='d-flex align-items-center justify-content-between mt-1'; const left=document.createElement('div'); left.style.display='flex'; left.style.flexDirection='column'; const lbl=document.createElement('div'); lbl.textContent=d.hand; lbl.style.cursor='pointer'; lbl.addEventListener('click', async ()=>{ try{ await navigator.clipboard.writeText(`${d.hand} -> ${d.action}`); lbl.style.background='#eef'; setTimeout(()=>lbl.style.background='',600);}catch(e){} }); left.appendChild(lbl);
            // probs inline
            const probsInline = formatProbsInline(d.probs);
            if (probsInline) left.appendChild(probsInline);
            row.appendChild(left);

            const right=document.createElement('div'); right.style.display='flex'; right.style.flexDirection='column'; right.style.alignItems='flex-end'; const badge=actionBadge(d.action); right.appendChild(badge);
            const bar = renderProbBar(d.probs); if (bar) { bar.style.marginTop='6px'; right.appendChild(bar); }
            row.appendChild(right);

            box.appendChild(row); }
          decisionsList.appendChild(box); }

        btnCopy.style.display = '';
      }

    } catch (e) { out.textContent = 'Erreur: ' + String(e); metaLine.textContent = 'Erreur'; }
  });

  // Upload handler: read selected file, parse JSON, POST to /api/upload optionally with ?name=
  btnUpload.addEventListener('click', async () => {
    uploadStatus.textContent = '';
    const file = rangesFileInput.files && rangesFileInput.files[0];
    if (!file) { uploadStatus.textContent = 'Aucun fichier sélectionné'; return; }
    uploadStatus.textContent = 'Lecture du fichier...';
    try {
      const txt = await file.text();
      let json;
      try { json = JSON.parse(txt); } catch (e) { uploadStatus.textContent = 'JSON invalide: ' + (e && e.message ? e.message : String(e)); return; }
      uploadStatus.textContent = 'Upload...';
      const name = (uploadProfileName && uploadProfileName.value) ? encodeURIComponent(uploadProfileName.value.trim()) : '';
      const url = name ? `/api/upload?name=${name}` : '/api/upload';
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(json) });
      const body = await res.json().catch(() => null);
      if (!res.ok) { uploadStatus.textContent = 'Erreur upload: ' + (body && body.error ? body.error : res.statusText); }
      else { uploadStatus.textContent = 'Upload OK — ranges activées'; await fetchProfiles(); }
    } catch (err) { uploadStatus.textContent = 'Erreur: ' + String(err); }
  });

  // Initial fetch profiles
  fetchProfiles().catch(()=>{});

});
