/**
 * jev-calibration.ts — KAN-76 / ADR-032.
 *
 * Mide el clasificador Jev de Portfolio Entry contra frases reales etiquetadas y muestra qué pasa
 * con cada umbral posible. Usa el mismo JevClassifier que corre en producción, así que lo que mide
 * es lo que el producto hace.
 *
 * Set: docs/portfolio-entry/testing/PORTFOLIO_ENTRY_JEV_CALIBRATION_FIXTURES_v0.1.json, aparte de
 * los 26 casos del AI Harness (ajustar contra esos haría que la suite mida memoria).
 *
 * Uso (desde front/, con JEV_API_KEY en el entorno o en ../.env):
 *   NODE_PATH=./node_modules npx tsx ../backend/scripts/jev-calibration.ts [ruta-al-set.json]
 *
 * Llama a Jev una vez por frase. No toca la base ni escribe nada.
 */
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { JevClassifier, JEV_THRESHOLDS } from '../modules/portfolio-entry-runtime/agent/jev-classifier';

dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

type CalibrationCase = {
  id: string;
  input: string;
  expected_entry_state: string;
  expected_intent: string;
};

const fixturePath = process.argv[2]
  ?? path.resolve(process.cwd(), '../docs/portfolio-entry/testing/PORTFOLIO_ENTRY_JEV_CALIBRATION_FIXTURES_v0.1.json');
const apiKey = process.env.JEV_API_KEY?.trim() || process.env.TYPESAFE_API_KEY?.trim();
if (!apiKey) {
  console.error('Falta JEV_API_KEY.');
  process.exit(2);
}

const cases = (JSON.parse(fs.readFileSync(fixturePath, 'utf8')).cases as CalibrationCase[])
  .filter((c) => !c.id.endsWith('EJEMPLO'));
if (cases.length === 0) {
  console.error(`${fixturePath} no tiene frases cargadas todavía.`);
  process.exit(1);
}

const classifier = new JevClassifier({ apiKey });
const THRESHOLDS = [0.5, 0.6, 0.7, 0.8];

type Raw = { id: string; expected: string; choice: string; confidence: number };
const raw: { entry: Raw[]; intent: Raw[] } = { entry: [], intent: [] };

async function main(): Promise<void> {
  for (const c of cases) {
    const result = await classifier.classifyRaw(c.input);
    raw.entry.push({ id: c.id, expected: c.expected_entry_state, choice: result.frame.choice, confidence: result.frame.confidence });
    raw.intent.push({ id: c.id, expected: c.expected_intent, choice: result.primary_intent.choice, confidence: result.primary_intent.confidence });
    process.stdout.write('.');
  }
  console.log(`\n${cases.length} frases · umbrales en producción: entry ${JEV_THRESHOLDS.entryState}, intent ${JEV_THRESHOLDS.primaryIntent}\n`);

  for (const [field, rows] of Object.entries(raw)) {
    console.log(`${field}`);
    for (const threshold of THRESHOLDS) {
      let correct = 0; let confidentWrong = 0; let toUnknown = 0;
      for (const r of rows) {
        const applied = r.confidence >= threshold ? r.choice : 'unknown';
        if (applied === r.expected) correct += 1;
        else if (applied === 'unknown') toUnknown += 1;
        else confidentWrong += 1;
      }
      console.log(`  umbral ${threshold}: correctas ${correct}/${rows.length} · equivocadas con confianza ${confidentWrong} · pasaron a unknown sin serlo ${toUnknown}`);
    }
    const wrong = rows.filter((r) => r.choice !== r.expected);
    for (const r of wrong) console.log(`    ${r.id}: esperado ${r.expected}, Jev ${r.choice} (${r.confidence.toFixed(2)})`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(2);
});
