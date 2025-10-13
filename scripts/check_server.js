(async () => {
  const u = 'http://localhost:3000';
  try {
    const p = await (await fetch(u + '/api/profiles')).text();
    console.log('--- /api/profiles ---');
    console.log(p);

    const d = await (await fetch(u + '/api/decide?players=2&depth=10&position=SB&hand=AKS')).text();
    console.log('\n--- /api/decide ---');
    console.log(d);

    const js = await (await fetch(u + '/app.js')).text();
    console.log('\n--- /app.js (head 1200 chars) ---');
    console.log(js.slice(0, 1200));
    console.log('\ncontains formatProbsInline:', js.includes('formatProbsInline'));
  } catch (e) {
    console.error('ERROR', e && e.message ? e.message : e);
    process.exit(1);
  }
})();

