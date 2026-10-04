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
