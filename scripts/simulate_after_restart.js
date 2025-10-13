(async () => {
  const u = 'http://localhost:3000';
  try {
    // activate exploit profile
    const sel = await fetch(u + '/api/profiles/select', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'exploit' }) });
    const selText = await sel.text();
    console.log('select status', sel.status, selText);

    const N = 200;
    const counts = {};
    for (let i = 0; i < N; i++) {
      const res = await fetch(u + '/api/decide?players=2&depth=10&position=SB&hand=AKS');
      if (!res.ok) {
        console.error('decide failed', res.status, await res.text());
        break;
      }
      const j = await res.json();
      const first = j.decisions.find(d => d.scenario === 'FirstIn');
      const act = first.action;
      counts[act] = (counts[act] || 0) + 1;
      if (i < 10) console.log(`${i + 1}. action=${act}, probs=${JSON.stringify(first.probs)}`);
    }
    console.log('summary', counts);
  } catch (e) {
    console.error('ERROR', e && e.message ? e.message : e);
    process.exit(1);
  }
})();

