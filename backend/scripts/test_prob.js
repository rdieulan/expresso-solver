(async () => {
  const u = 'http://localhost:3000';
  function sleep(ms) { return new Promise(res => setTimeout(res, ms)); }
  try {
    const N = 30;
    const counts = {};
    for (let i = 0; i < N; i++) {
      const res = await fetch(`${u}/api/decide?players=2&depth=10&position=SB&hand=AKS`);
      if (!res.ok) {
        console.error('Request failed', res.status, await res.text());
        process.exit(1);
      }
      const j = await res.json();
      const first = j.decisions.find(d => d.scenario === 'FirstIn');
      const action = first.action;
      counts[action] = (counts[action] || 0) + 1;
      const probs = first.probs || null;
      const keys = probs ? Object.keys(probs) : null;
      console.log(`${i+1}. action=${action}, probsKeys=${JSON.stringify(keys)}, probs=${JSON.stringify(probs)}`);
      // small delay
      await sleep(30);
    }
    console.log('Summary counts:', counts);
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
})();

