/**
 * scripts/check-i18n-parity.mjs — G03: Build fails if any i18n key is missing
 *
 * R: BUILD_PLAN.md §M12 (G03)
 *
 * Compara messages/pt.json e messages/en.json.
 * Se existirem chaves presentes numa língua mas ausentes na outra, o processo
 * termina com código 1, falhando o build.
 *
 * Executado como parte do prebuild: "check-i18n && paraglide-js compile ..."
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../../..");

function loadJson(relPath) {
  const fullPath = resolve(ROOT, relPath);
  try {
    return JSON.parse(readFileSync(fullPath, "utf-8"));
  } catch (e) {
    console.error(`❌ Cannot read ${relPath}: ${e.message}`);
    process.exit(1);
  }
}

const pt = loadJson("messages/pt.json");
const en = loadJson("messages/en.json");

const ptKeys = new Set(Object.keys(pt));
const enKeys = new Set(Object.keys(en));

const missingInEn = [...ptKeys].filter((k) => !enKeys.has(k));
const missingInPt = [...enKeys].filter((k) => !ptKeys.has(k));

let hasErrors = false;

if (missingInEn.length > 0) {
  console.error(`\n❌ [i18n] ${missingInEn.length} key(s) present in pt.json but MISSING in en.json:`);
  for (const k of missingInEn) {
    console.error(`   - ${k}`);
  }
  hasErrors = true;
}

if (missingInPt.length > 0) {
  console.error(`\n❌ [i18n] ${missingInPt.length} key(s) present in en.json but MISSING in pt.json:`);
  for (const k of missingInPt) {
    console.error(`   - ${k}`);
  }
  hasErrors = true;
}

if (hasErrors) {
  console.error("\n💥 Build aborted: i18n parity check failed. Add the missing keys above.\n");
  process.exit(1);
} else {
  console.log(`✅ [i18n] Parity OK — ${ptKeys.size} keys in pt + en`);
}
