// Swarm de roles (2026-10-10): POST /projects/:id/evidence daba 500 siempre porque el controller
// pasaba user.name como ownerId (FK a User).
import { describe, expect, it, vi } from 'vitest';
import { EvidenceController } from '../evidence.controller';

describe('EvidenceController.create', () => {
  it('guarda como owner el id del usuario, no su nombre', async () => {
    const service = { createEvidence: vi.fn().mockResolvedValue({ id: 'e1' }) } as any;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    const body = { name: 'Informe', type: 'PDF', stepRef: 1 };
    await new EvidenceController(service).create({ params: { projectId: 'p1' }, user: { id: 'u1', name: 'Ana' }, body } as any, res, vi.fn());
    expect(service.createEvidence).toHaveBeenCalledWith('p1', 'u1', body);
    expect(res.status).toHaveBeenCalledWith(201);
  });
});
