import { describe, expect, it } from 'vitest';
import { reconstruct } from '../reconstruction.service';

describe('reconstruct (E2E Job-Driven §14)', () => {
  it('piloto con resultados mixtos: sostiene lo observado, marca la contradicción y no reinicia', () => {
    const reading = reconstruct({
      name: 'Piloto autoservicio',
      summary: 'Llevamos 4 meses con un piloto de autoservicio en 2 sucursales.',
      evidence: [
        { summary: 'El costo por solicitud bajó 18% en la sucursal A', classification: 'supports', source: 'reporte-A' },
        { summary: 'La sucursal B no muestra cambios y subió el reclamo', classification: 'contradicts' },
      ],
    });
    expect(reading.restartFromStep0).toBe(false);
    expect(reading.provenance).toBe('USER_DECLARED');
    expect(reading.sustainableClaims).toEqual([{ claim: 'El costo por solicitud bajó 18% en la sucursal A (sólo donde se observó; hay evidencia en contra)', evidence: ['reporte-A'] }]);
    expect(reading.contradictions).toHaveLength(1);
    expect(reading.availableEvidence).toEqual({ supports: 1, contradicts: 1, insufficient: 0 });
    expect(reading.nextMaterialUncertainty).toMatch(/no coinciden/);
    // Sin meta explícita, el primer gate abierto es Step 0: se re-entra ahí, no se reinicia todo.
    expect(reading.suggestedReentryStep).toBe(0);
    expect(reading.gates.find((g) => g.step === 3)?.status).toBe('met');
  });

  it('evidencia consistente y meta clara: re-entra en el primer gate abierto', () => {
    const reading = reconstruct({
      name: 'Tablero',
      summary: 'El retrabajo bajó 30% con el tablero.',
      goal: 'Reducir retrabajo comercial',
      evidence: [{ summary: 'Horas de retrabajo bajaron de 500 a 350', classification: 'supports' }],
      decisionsTaken: [],
    });
    expect(reading.contradictions).toEqual([]);
    expect(reading.sustainableClaims[0].claim).toBe('Horas de retrabajo bajaron de 500 a 350');
    expect(reading.suggestedReentryStep).toBe(2);
    expect(reading.gaps.map((g) => g.step)).toEqual([2, 3, 4]);
  });

  it('sin evidencia no inventa nada sostenible', () => {
    const reading = reconstruct({ name: 'Idea', summary: 'Tenemos una idea.', evidence: [] });
    expect(reading.sustainableClaims).toEqual([]);
    expect(reading.availableEvidence).toEqual({ supports: 0, contradicts: 0, insufficient: 0 });
    expect(reading.nextMaterialUncertainty).toBe('¿Qué se buscaba mover y qué decisión habilitaba?');
  });
});

// Auditoría E2E F-09 (probe P07): "Abandono bajó 20%" y "Coste subió 5%" se cruzaban como
// contradicción y se pedía explicar por qué no coinciden. Son compatibles: es un tradeoff.
describe('reconstruct — tradeoffs no son contradicciones (F-09)', () => {
  it('beneficio y costo sobre temas distintos: tradeoff, no contradicción', () => {
    const reading = reconstruct({
      name: 'Onboarding',
      summary: 'Rediseñamos el onboarding.',
      goal: 'Reducir abandono',
      evidence: [
        { summary: 'El abandono bajó 20%', classification: 'supports' },
        { summary: 'El coste por usuario subió 5%', classification: 'contradicts' },
      ],
    });
    expect(reading.contradictions).toEqual([]);
    expect(reading.tradeoffs).toEqual([{ benefit: 'El abandono bajó 20%', cost: 'El coste por usuario subió 5%' }]);
    expect(reading.sustainableClaims[0].claim).toBe('El abandono bajó 20%');
    expect(reading.nextMaterialUncertainty).not.toMatch(/no coinciden/);
    expect(reading.nextMaterialUncertainty).toMatch(/compensa/);
  });

  it('si declaran el mismo claim, es contradicción aunque usen palabras distintas', () => {
    const reading = reconstruct({
      name: 'Piloto',
      summary: 'Piloto.',
      evidence: [
        { summary: 'Los usuarios terminan el alta', classification: 'supports', claim: 'retención' },
        { summary: 'La mitad abandona en el paso 2', classification: 'contradicts', claim: 'Retención' },
      ],
    });
    expect(reading.contradictions).toHaveLength(1);
    expect(reading.tradeoffs).toEqual([]);
  });

  it('con varias evidencias, sólo empareja las del mismo tema', () => {
    const reading = reconstruct({
      name: 'Mixto',
      summary: 'Resultados mixtos.',
      evidence: [
        { summary: 'El retrabajo bajó 30%', classification: 'supports' },
        { summary: 'El tiempo de respuesta mejoró', classification: 'supports' },
        { summary: 'El retrabajo volvió a subir en marzo', classification: 'contradicts' },
      ],
    });
    expect(reading.contradictions).toEqual([{ supports: 'El retrabajo bajó 30%', contradicts: 'El retrabajo volvió a subir en marzo' }]);
    expect(reading.tradeoffs).toEqual([{ benefit: 'El tiempo de respuesta mejoró', cost: 'El retrabajo volvió a subir en marzo' }]);
    expect(reading.sustainableClaims.map((c) => c.claim)).toEqual([
      'El retrabajo bajó 30% (sólo donde se observó; hay evidencia en contra)',
      'El tiempo de respuesta mejoró',
    ]);
  });
});
