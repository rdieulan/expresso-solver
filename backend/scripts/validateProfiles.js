const fs = require('fs');
const path = require('path');

function loadJson(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    throw new Error(`Failed to read/parse JSON ${filePath}: ${e.message}`);
  }
}

function isVillainKey(k) {
  return ['BTN', 'SB', 'BB'].includes(k);
}

function validateProfileAgainstTemplate(template, profile, profileName) {
  const issues = [];

  for (const playersKey of Object.keys(template)) {
    if (!(playersKey in profile)) {
      issues.push(`Missing players key: ${playersKey}`);
      continue;
    }
    const tmplPlayers = template[playersKey];
    const profPlayers = profile[playersKey];

    for (const depthKey of Object.keys(tmplPlayers)) {
      if (!(depthKey in profPlayers)) {
        issues.push(`Missing depth ${depthKey} under players ${playersKey}`);
        continue;
      }
      const tmplDepth = tmplPlayers[depthKey];
      const profDepth = profPlayers[depthKey];

      for (const posKey of Object.keys(tmplDepth)) {
        if (!(posKey in profDepth)) {
          issues.push(`Missing position ${posKey} under players ${playersKey}/${depthKey}`);
          continue;
        }
        const tmplPos = tmplDepth[posKey] || {};
        const profPos = profDepth[posKey] || {};

        // check scenarios present in template
        for (const scKey of Object.keys(tmplPos)) {
          if (!(scKey in profPos)) {
            issues.push(`Missing scenario ${scKey} under ${playersKey}/${depthKey}/${posKey}`);
            continue;
          }

          const tmplSc = tmplPos[scKey] || {};
          const profSc = profPos[scKey] || {};

          // detect whether template scenario uses villain keys
          const tmplScKeys = Object.keys(tmplSc);
          const tmplVillains = tmplScKeys.filter(isVillainKey);
          if (tmplVillains.length > 0) {
            // require same villain keys in profile (at least those present in template)
            for (const v of tmplVillains) {
              if (!(v in profSc)) {
                issues.push(`Missing villain ${v} under scenario ${scKey} at ${playersKey}/${depthKey}/${posKey}`);
              }
            }
          } else {
            // template scenario has no villain-dim; profile must have scenario as object (could be empty)
            if (typeof profSc !== 'object' || profSc === null) {
              issues.push(`Scenario ${scKey} at ${playersKey}/${depthKey}/${posKey} should be an object (hand->value mapping)`);
            }
          }
        }

        // detect extra scenarios in profile not present in template
        for (const scKey of Object.keys(profPos)) {
          if (!(scKey in tmplPos)) {
            issues.push(`Extra scenario ${scKey} present in profile under ${playersKey}/${depthKey}/${posKey}`);
          }
        }
      }

      // detect extra positions in profile depth
      for (const posKey of Object.keys(profDepth)) {
        if (!(posKey in tmplPlayers[depthKey])) {
          issues.push(`Extra position ${posKey} present under ${playersKey}/${depthKey}`);
        }
      }
    }

    // detect extra depths in profile players
    for (const depthKey of Object.keys(profPlayers)) {
      if (!(depthKey in tmplPlayers)) {
        issues.push(`Extra depth ${depthKey} present under players ${playersKey}`);
      }
    }
  }

  // detect extra players in profile
  for (const playersKey of Object.keys(profile)) {
    if (!(playersKey in template)) {
      issues.push(`Extra players key ${playersKey} present in profile`);
    }
  }

  return issues;
}

function main() {
  const base = path.resolve(__dirname, '..');
  const templatePath = path.join(base, 'data', 'ranges.json');
  const profilesDir = path.join(base, 'data', 'profiles');

  if (!fs.existsSync(templatePath)) {
    console.error(`Template ranges.json not found at ${templatePath}`);
    process.exit(2);
  }
  if (!fs.existsSync(profilesDir)) {
    console.error(`Profiles directory not found at ${profilesDir}`);
    process.exit(2);
  }

  const template = loadJson(templatePath);

  const files = fs.readdirSync(profilesDir).filter(f => f.toLowerCase().endsWith('.json'));
  if (files.length === 0) {
    console.warn('No profile files found in', profilesDir);
    process.exit(0);
  }

  let hadErrors = false;
  for (const f of files) {
    const ppath = path.join(profilesDir, f);
    let profile;
    try {
      profile = loadJson(ppath);
    } catch (e) {
      console.error(`Failed to parse profile ${f}: ${e.message}`);
      hadErrors = true;
      continue;
    }

    const issues = validateProfileAgainstTemplate(template, profile, f);
    if (issues.length === 0) {
      console.log(`OK: ${f}`);
    } else {
      hadErrors = true;
      console.log(`Issues for ${f}:`);
      for (const it of issues) console.log(`  - ${it}`);
    }
  }

  if (hadErrors) process.exit(1);
  console.log('All profiles validated against template (no missing keys).');
  process.exit(0);
}

main();

