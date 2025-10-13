import { promises as fs } from 'fs';
import path from 'path';
import { RangeRepository } from '../ranges/RangeRepository';

export async function listProfiles(profilesDir: string): Promise<string[]> {
  const abs = path.resolve(profilesDir);
  try {
    const files = await fs.readdir(abs, { withFileTypes: true });
    return files
      .filter((f) => f.isFile() && f.name.endsWith('.json'))
      .map((f) => f.name.replace(/\.json$/, ''))
      .sort();
  } catch (e) {
    return [];
  }
}

export async function loadProfile(profilesDir: string, name: string): Promise<RangeRepository> {
  const abs = path.resolve(profilesDir, `${name}.json`);
  return RangeRepository.fromFile(abs);
}

export async function profileExists(profilesDir: string, name: string): Promise<boolean> {
  const abs = path.resolve(profilesDir, `${name}.json`);
  try {
    await fs.access(abs);
    return true;
  } catch (e) {
    return false;
  }
}

