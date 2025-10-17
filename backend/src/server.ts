import express from "express";
import cors from "cors";
import path from "path";
import { promises as fs } from "fs";
import { RangeRepository } from "./ranges/RangeRepository";
import { DecisionEngine } from "./DecisionEngine";
import { parsePlayersCount, normalizeHandLabel, allVillainPositions, Scenario, Position } from "./domain";

async function main() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '2mb' }));

  const publicPath = path.resolve(__dirname, "..", "public");
  const distFrontendPath = path.resolve(__dirname, "..", "dist-frontend");

  // If a built frontend exists in dist-frontend, prefer serving it; otherwise fall back to public/
  let serveFrontend = false;
  try {
    await fs.access(distFrontendPath);
    serveFrontend = true;
  } catch (e) {
    serveFrontend = false;
  }

  if (serveFrontend) {
    app.use(express.static(distFrontendPath));
    console.log(`Serving frontend from ${distFrontendPath}`);
  } else {
    app.use(express.static(publicPath));
    console.log(`Serving static files from ${publicPath}`);
  }

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
          profiles[name] = JSON.parse(raw);
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

  // Initialize repo/engine based on currentProfile or fallback to data/ranges.json
  const rangesPath = path.resolve(__dirname, "..", "data", "ranges.json");
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
      repo = RangeRepository.fromObject(profiles[name]);
      engine = new DecisionEngine(repo);
      currentProfile = name;
      res.json({ ok: true, active: currentProfile });
    } catch (err: any) {
      res.status(400).json({ error: err && err.message ? err.message : String(err) });
    }
  });

  // API: GET /api/decide?players=3&depth=10&hand=AKs
  app.get("/api/decide", async (req, res) => {
    try {
      const q = req.query as Record<string, string | undefined>;
      const players = parsePlayersCount(Number(q.players || ""));
      const depth = Math.max(5, Math.min(15, Math.round(Number(q.depth || "0"))));
      const handInput = String(q.hand || "");
      const normalized = normalizeHandLabel(handInput);

      // Backend no longer accepts `position` or `showRange` query params.
      // Compute allowed hero positions directly from players count.
      const allowed = players === 2 ? [Position.SB, Position.BB] : [Position.BTN, Position.SB, Position.BB];
      const targetHeroPositions: Position[] = allowed as Position[];

      const decisions: Array<any> = [];
      const ranges: Record<string, any> = {};

      for (const heroPos of targetHeroPositions) {
        // Try to use the position node from the repository to enumerate available scenarios
        const positionNode = repo.getPositionNode({ players, depth, heroPos });
        if (positionNode && typeof positionNode === 'object') {
          const scenarioKeys = Object.keys(positionNode as Record<string, unknown>);
          for (const scKey of scenarioKeys) {
            if (!scKey) continue;
            // Open is a special case: no villain dimension
            if (scKey === 'Open') {
              const dFirst = engine.decide({ players, depth, heroPos, scenario: (scKey as any), hand: handInput });
              decisions.push({ heroPos, scenario: scKey, villain: null, hand: dFirst.handLabel, action: dFirst.action, probs: dFirst.probs || null });
              continue;
            }

            const scNode = (positionNode as any)[scKey];
            if (scNode && typeof scNode === 'object') {
              const scNodeKeys = Object.keys(scNode);
              // Determine whether this scenario uses villain positions by intersecting with allowed villains
              const villainsAllowed = allVillainPositions(players, heroPos).map(p => String(p));
              const intersection = scNodeKeys.filter(k => villainsAllowed.includes(k));

              if (intersection.length > 0) {
                // per-villain entries
                for (const v of intersection) {
                  const d = engine.decide({ players, depth, heroPos, scenario: (scKey as any), villainPos: (v as any), hand: handInput });
                  decisions.push({ heroPos, scenario: scKey, villain: v, hand: d.handLabel, action: d.action, probs: d.probs || null });
                }
              } else {
                // no villain dimension: treat as direct mapping hand->value
                const d = engine.decide({ players, depth, heroPos, scenario: (scKey as any), hand: handInput });
                decisions.push({ heroPos, scenario: scKey, villain: null, hand: d.handLabel, action: d.action, probs: d.probs || null });
              }
            }
          }
        } else {
          // Fallback to previous behavior when no position node available (backwards compatibility)
          // Open
          const dFirst = engine.decide({ players, depth, heroPos, scenario: Scenario.Open, hand: handInput });
          decisions.push({ heroPos, scenario: Scenario.Open, villain: null, hand: dFirst.handLabel, action: dFirst.action, probs: dFirst.probs || null });

          const villains = allVillainPositions(players, heroPos);
          for (const v of villains) {
            const dOpen = engine.decide({ players, depth, heroPos, scenario: Scenario.VsOpen, villainPos: v, hand: handInput });
            decisions.push({ heroPos, scenario: Scenario.VsOpen, villain: v, hand: dOpen.handLabel, action: dOpen.action, probs: dOpen.probs || null });
            const dShove = engine.decide({ players, depth, heroPos, scenario: Scenario.VsShove, villainPos: v, hand: handInput });
            decisions.push({ heroPos, scenario: Scenario.VsShove, villain: v, hand: dShove.handLabel, action: dShove.action, probs: dShove.probs || null });
          }
        }

        // include range for the first hero position only (to keep payload small and backward compatible)
        if (!ranges[String(heroPos)]) {
          try {
            ranges[String(heroPos)] = repo.getPositionNode({ players, depth, heroPos });
          } catch (e) {
            ranges[String(heroPos)] = null;
          }
        }
      }

      const out: any = {
        meta: { players, depth, handInput, normalized, profile: currentProfile, heroPositions: targetHeroPositions.map(p => String(p)) },
        decisions,
        ranges
      };

      // For backward compatibility, set `range` to the first hero position node if available
      if (targetHeroPositions.length > 0) {
        out.range = ranges[String(targetHeroPositions[0])] || null;
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
      repo = RangeRepository.fromObject(body);
      // replace runtime repo/engine
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

  // SPA fallback: serve index.html for non-api GET requests
  app.get('*', async (req, res) => {
    try {
      if (req.path.startsWith('/api')) return res.status(404).end();
      const indexPath = serveFrontend ? path.join(distFrontendPath, 'index.html') : path.join(publicPath, 'index.html');
      const html = await fs.readFile(indexPath, 'utf8');
      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    } catch (e) {
      res.status(404).send('Not found');
    }
  });

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;

  // Start server and handle common errors (like port already in use)
  const server = app.listen(port, () => {
    console.log(`Server started at http://localhost:${port} — static from ${serveFrontend ? distFrontendPath : publicPath}`);
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
