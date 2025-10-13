import express from "express";
import cors from "cors";
import path from "path";
import { promises as fs } from "fs";
import { RangeRepository } from "./ranges/RangeRepository";
import { DecisionEngine } from "./DecisionEngine";
import { parsePlayersCount, parsePosition, normalizeHandLabel, allVillainPositions, Scenario, Position } from "./domain";

async function main() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '2mb' }));

  const publicPath = path.resolve(__dirname, "..", "public");
  app.use(express.static(publicPath));

  const profilesDir = path.resolve(__dirname, "..", "data", "profiles");

  // Load available profiles from data/profiles
  let profiles: Record<string, unknown> = {};
  async function loadProfiles() {
    profiles = {};
    try {
      const files = await fs.readdir(profilesDir);
      for (const f of files) {
        if (!f.toLowerCase().endsWith('.json')) continue;
        const name = f.replace(/\.json$/i, '');
        try {
          const raw = await fs.readFile(path.join(profilesDir, f), 'utf8');
          const json = JSON.parse(raw);
          profiles[name] = json;
        } catch (e) {
          console.error(`Erreur lecture profile ${f}:`, (e as Error).message);
        }
      }
    } catch (e) {
      // directory may not exist
      try {
        await fs.mkdir(profilesDir, { recursive: true });
      } catch {}
    }
  }

  await loadProfiles();

  // Default profile selection: prefer 'gto' if present
  const availableNames = Object.keys(profiles);
  let currentProfile = availableNames.includes('gto') ? 'gto' : (availableNames[0] || 'default');

  // Initialize repo/engine based on currentProfile or fallback to data/preflop.ranges.json
  const rangesPath = path.resolve(__dirname, "..", "data", "preflop.ranges.json");
  let repo = await (async () => {
    if (profiles[currentProfile]) {
      return RangeRepository.fromObject(profiles[currentProfile]);
    }
    // fallback to original file
    return await RangeRepository.fromFile(rangesPath);
  })();
  let engine = new DecisionEngine(repo);

  // API: GET /api/profiles -> list profiles with active flag
  app.get('/api/profiles', async (req, res) => {
    await loadProfiles();
    const list = Object.keys(profiles).map((n) => ({ name: n, active: n === currentProfile }));
    res.json({ profiles: list });
  });

  // Select a profile: POST /api/profiles/select { name }
  app.post('/api/profiles/select', async (req, res) => {
    try {
      // Reload profiles from disk to pick up any file edits
      await loadProfiles();

      const name = (req.body && req.body.name) || req.query.name;
      if (!name || typeof name !== 'string') return res.status(400).json({ error: 'Missing profile name' });
      if (!profiles[name]) return res.status(404).json({ error: 'Profile not found' });
      // validate and activate
      const newRepo = RangeRepository.fromObject(profiles[name]);
      repo = newRepo;
      engine = new DecisionEngine(repo);
      currentProfile = name;
      res.json({ ok: true, active: currentProfile });
    } catch (err: any) {
      res.status(400).json({ error: err && err.message ? err.message : String(err) });
    }
  });

  // API: GET /api/decide?players=3&depth=10&position=BTN&hand=AKs&showRange=true
  app.get("/api/decide", async (req, res) => {
    try {
      const q = req.query as Record<string, string | undefined>;
      const players = parsePlayersCount(Number(q.players || ""));
      const heroPos = parsePosition(String(q.position || ""), players);
      const depth = Math.max(5, Math.min(15, Math.round(Number(q.depth || "0"))));
      const handInput = String(q.hand || "");
      const normalized = normalizeHandLabel(handInput);
      const showRange = q.showRange === "true" || q.showRange === "1" || q.showRange === "true";

      const decisions: Array<any> = [];

      const dFirst = engine.decide({ players, depth, heroPos, scenario: Scenario.FirstIn, hand: handInput });
      decisions.push({ scenario: Scenario.FirstIn, villain: null, hand: dFirst.handLabel, action: dFirst.action, probs: dFirst.probs || null });

      const villains = allVillainPositions(players, heroPos);
      for (const v of villains) {
        const dOpen = engine.decide({ players, depth, heroPos, scenario: Scenario.VsOpen, villainPos: v, hand: handInput });
        decisions.push({ scenario: Scenario.VsOpen, villain: v, hand: dOpen.handLabel, action: dOpen.action, probs: dOpen.probs || null });
        const dShove = engine.decide({ players, depth, heroPos, scenario: Scenario.VsShove, villainPos: v, hand: handInput });
        decisions.push({ scenario: Scenario.VsShove, villain: v, hand: dShove.handLabel, action: dShove.action, probs: dShove.probs || null });
      }

      const out: any = {
        meta: { players, depth, heroPos, handInput, normalized, profile: currentProfile },
        decisions,
      };

      if (showRange) {
        out.range = repo.getPositionNode({ players, depth, heroPos });
      }

      res.json(out);
    } catch (e: any) {
      res.status(400).json({ error: e && e.message ? e.message : String(e) });
    }
  });

  // Upload ranges: POST /api/upload with JSON body, optional ?name=profileName to save as named profile
  app.post('/api/upload', async (req, res) => {
    try {
      const body = req.body;
      const name = (req.query && req.query.name) || (body && (body as any).name) || undefined;
      // instantiate a new repo (validation happens inside)
      const newRepo = RangeRepository.fromObject(body);
      // replace runtime repo/engine
      repo = newRepo;
      engine = new DecisionEngine(repo);

      // persist if name provided
      if (name && typeof name === 'string') {
        const filePath = path.join(profilesDir, `${name}.json`);
        await fs.writeFile(filePath, JSON.stringify(body, null, 2), 'utf8');
        // refresh profiles
        await loadProfiles();
        currentProfile = name;
      }

      res.json({ ok: true, message: 'Ranges uploaded and activated', profile: currentProfile });
    } catch (err: any) {
      res.status(400).json({ error: err && err.message ? err.message : String(err) });
    }
  });

  // Return a small summary of currently loaded ranges
  app.get('/api/current', (req, res) => {
    try {
      const summary: any = {};
      summary.note = 'Ranges loaded (use /api/decide to query)';
      summary.activeProfile = currentProfile;
      summary.availableProfiles = Object.keys(profiles);
      res.json(summary);
    } catch (e: any) {
      res.status(500).json({ error: String(e) });
    }
  });

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;

  // Start server and handle common errors (like port already in use)
  const server = app.listen(port, () => {
    console.log(`Server started at http://localhost:${port} — static from ${publicPath}`);
    console.log(`Process PID: ${process.pid}`);
    console.log(`Active profile: ${currentProfile}`);
  });

  server.on('error', (err: any) => {
    if (err && err.code === 'EADDRINUSE') {
      console.error(`Erreur: le port ${port} est déjà utilisé.`);
      console.error(`Si tu as déjà lancé le serveur dans un autre onglet, ferme-le (ou utilise "taskkill /PID <pid> /F").`);
      console.error(`Exemples de commandes (cmd.exe):`);
      console.error(`  netstat -aon | findstr :${port}`);
      console.error(`  taskkill /PID <pid> /F`);
      console.error(`Ou utilise un port différent: set PORT=4000 && npm run dev:web`);
      process.exit(1);
    }
    console.error('Server error:', err);
    process.exit(1);
  });
}

main().catch((e) => {
  console.error("Server failed to start:", e);
  process.exit(1);
});
