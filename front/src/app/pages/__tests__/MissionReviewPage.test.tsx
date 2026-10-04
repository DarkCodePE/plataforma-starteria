/**
 * MissionReviewPage.test.tsx — doc/STARTERIA_JOB_DRIVEN_E2E_EXPERIENCE_v0.2.md §18.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MissionReviewPage } from '../MissionReviewPage';

const navigate = vi.fn();
vi.mock('react-router', () => ({
  useParams: () => ({ projectId: 'p1' }),
  useNavigate: () => navigate,
}));

const getMissionReview = vi.fn();
vi.mock('../../../features/adaptive-core/services/adaptiveCoreService', () => ({
  getMissionReview: (id: string) => getMissionReview(id),
}));

const REVIEW = {
  projectId: 'p1',
  initiativeName: 'Autoservicio sucursales',
  independent: false,
  whatToMove: 'Bajar el costo por solicitud',
  inheritedContext: {
    strategicFront: { id: 'f1', name: 'Eficiencia operativa', desiredResult: null, kpi: 'Costo por solicitud', target: '10.00', horizon: '12 meses' },
    challenge: { id: 'c1', title: 'Reducir costo de atención', whyNow: 'El presupuesto depende de esto', successCriteria: null },
    initiativeContext: null,
  },
  expectedContribution: null,
  constraints: [],
  capacity: ['Tiempo disponible: acotado'],
  dependencies: [],
  whoCanHelp: ['Mentora', 'Equipo CX'],
  decisionToEnable: 'Escalar o no el autoservicio',
  openQuestions: ['¿Qué sucursales participan?'],
};

describe('MissionReviewPage', () => {
  beforeEach(() => {
    navigate.mockReset();
    getMissionReview.mockReset();
    getMissionReview.mockResolvedValue(REVIEW);
  });

  it('muestra los ocho campos de §18 y marca lo que falta como "Sin definir"', async () => {
    render(<MissionReviewPage />);
    expect(await screen.findByRole('heading', { name: /¿Qué estoy asumiendo exactamente\?/ })).toBeInTheDocument();
    for (const label of [
      'Qué quiere mover',
      'Contexto heredado',
      'Contribución esperada',
      'Restricciones',
      'Capacidad',
      'Dependencias',
      'Quién puede ayudar',
      'Qué decisión debo ayudar a habilitar',
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByText(/Frente: Eficiencia operativa · KPI Costo por solicitud · meta 10.00 · 12 meses/)).toBeInTheDocument();
    expect(screen.getByText('Mentora')).toBeInTheDocument();
    // contribución, restricciones y dependencias vienen vacías.
    expect(screen.getAllByText('Sin definir')).toHaveLength(3);
    expect(screen.getByText('¿Qué sucursales participan?')).toBeInTheDocument();
  });

  it('recién desde acá se abre Step 0', async () => {
    render(<MissionReviewPage />);
    fireEvent.click(await screen.findByRole('button', { name: /Asumir y empezar Step 0/ }));
    expect(navigate).toHaveBeenCalledWith('/projects/p1/step/0');
  });

  it('una iniciativa independiente habla de contexto de partida, no heredado (§16)', async () => {
    getMissionReview.mockResolvedValue({ ...REVIEW, independent: true, inheritedContext: { strategicFront: null, challenge: null, initiativeContext: 'Cotizaciones lentas' } });
    render(<MissionReviewPage />);
    expect(await screen.findByText('Contexto de partida')).toBeInTheDocument();
    expect(screen.queryByText('Contexto heredado')).not.toBeInTheDocument();
  });

  it('muestra error si no carga', async () => {
    getMissionReview.mockRejectedValue(new Error('boom'));
    render(<MissionReviewPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/No pudimos cargar/);
  });
});
