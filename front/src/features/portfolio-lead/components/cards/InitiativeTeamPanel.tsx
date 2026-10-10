/**
 * InitiativeTeamPanel — el equipo real de una iniciativa, visto desde el portafolio.
 *
 * Lee GET /portfolio/initiatives/:projectId/team (filas TeamMember, heredadas del reto al crear
 * más los overrides) y, si la sesión tiene `portfolio:write` (lo mismo que exige el router para
 * PUT/DELETE), deja cambiar rol, agregar y quitar. El servidor sigue autorizando; acá sólo se
 * decide qué se pinta.
 *
 * Reglas que la UI respeta en vez de dejar que el backend las rechace:
 * - al OWNER no se lo quita (409 CANNOT_REMOVE_OWNER) ni se lo degrada: el PUT no lo impide,
 *   pero dejaría la iniciativa sin owner y no hay flujo de transferencia.
 * - no se ofrece OWNER al agregar ni al cambiar rol, por la misma razón (dos owners).
 * - se agrega por usuario existente (el PUT exige un userId real, 404 USER_NOT_FOUND si no).
 *   Los candidatos salen del equipo del reto; para otro usuario se puede pegar su ID.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getInitiativeTeam,
  listChallengeTeam,
  removeInitiativeTeamMember,
  upsertInitiativeTeamMember,
} from '../../../../app/services/portfolioService';
import { useOptionalApp } from '../../../../app/context/AppContext';
import { can } from '../../../../app/authz/permissions';
import { Badge } from '../../../../app/components/ui/badge';
import { Button } from '../../../../app/components/ui/button';
import {
  adaptInitiativeTeam,
  type InitiativeTeamMemberView,
  type InitiativeTeamRole,
  type InitiativeTeamView,
} from '../../domain/adapters';

export const INITIATIVE_TEAM_ROLE_LABEL: Record<InitiativeTeamRole, string> = {
  OWNER: 'Propietario',
  EDITOR: 'Editor',
  VIEWER: 'Lector',
};

const ASSIGNABLE_ROLES: Array<Exclude<InitiativeTeamRole, 'OWNER'>> = ['EDITOR', 'VIEWER'];
const OTHER_USER = '__otro__';

type Candidate = { userId: string; name: string };

function errorMessage(err: unknown, fallback: string): string {
  const message = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
  return typeof message === 'string' && message ? message : fallback;
}

export function InitiativeTeamPanel({
  projectId,
  challengeId,
  initiativeName,
}: {
  projectId?: string | null;
  challengeId?: string | null;
  initiativeName?: string;
}) {
  const app = useOptionalApp();
  const canManage = can(app?.user, 'portfolio:write');

  const [team, setTeam] = useState<InitiativeTeamView | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [challengeCandidates, setChallengeCandidates] = useState<Candidate[]>([]);
  const [newUser, setNewUser] = useState('');
  const [newUserId, setNewUserId] = useState('');
  const [newRole, setNewRole] = useState<Exclude<InitiativeTeamRole, 'OWNER'>>('EDITOR');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    if (!projectId) return;
    try {
      setTeam(adaptInitiativeTeam(await getInitiativeTeam(projectId)));
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Candidatos para agregar: personas reales del equipo del reto. Sólo si se puede gestionar;
  // un fallo acá no rompe el panel (queda la opción de pegar un ID).
  useEffect(() => {
    if (!canManage || !challengeId) return;
    let cancelled = false;
    listChallengeTeam(challengeId)
      .then((rows) => {
        if (cancelled) return;
        setChallengeCandidates(
          rows
            .filter((row) => row.userId)
            .map((row) => ({ userId: row.userId as string, name: row.user?.name || row.user?.email || (row.userId as string) })),
        );
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [canManage, challengeId]);

  const candidates = useMemo(() => {
    const inTeam = new Set(team?.members.map((m) => m.userId) ?? []);
    return challengeCandidates.filter((c) => !inTeam.has(c.userId));
  }, [challengeCandidates, team]);

  const runAction = async (userId: string, action: () => Promise<unknown>, fallback: string) => {
    setBusyUserId(userId);
    setActionError(null);
    try {
      await action();
      await load();
    } catch (err) {
      setActionError(errorMessage(err, fallback));
    } finally {
      setBusyUserId(null);
      setConfirmRemoveId(null);
    }
  };

  const changeRole = (member: InitiativeTeamMemberView, role: InitiativeTeamRole) => {
    if (member.role === 'OWNER' || role === 'OWNER' || role === member.role || !projectId) return;
    void runAction(member.userId, () => upsertInitiativeTeamMember(projectId, member.userId, { role }), 'No pudimos cambiar el rol.');
  };

  const remove = (member: InitiativeTeamMemberView) => {
    if (member.role === 'OWNER' || !projectId) return;
    void runAction(member.userId, () => removeInitiativeTeamMember(projectId, member.userId), 'No pudimos quitar a la persona.');
  };

  const targetUserId = newUser === OTHER_USER ? newUserId.trim() : newUser;

  const add = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!projectId || !targetUserId) return;
    setAdding(true);
    setActionError(null);
    try {
      await upsertInitiativeTeamMember(projectId, targetUserId, { role: newRole });
      setNewUser('');
      setNewUserId('');
      await load();
    } catch (err) {
      setActionError(errorMessage(err, 'No pudimos agregar a la persona.'));
    } finally {
      setAdding(false);
    }
  };

  return (
    <section
      className="rounded-3xl border border-slate-200 bg-white p-5"
      aria-label={initiativeName ? `Equipo de la iniciativa ${initiativeName}` : 'Equipo de la iniciativa'}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500" style={{ fontWeight: 700 }}>EQUIPO DE LA INICIATIVA</p>
          <p className="mt-1 text-sm text-slate-600">
            Personas con acceso a esta iniciativa. Al crearla se heredan del equipo del reto.
          </p>
        </div>
        {team ? <Badge variant="neutral">{team.label || `Equipo de ${team.members.length}`}</Badge> : null}
      </div>

      {!projectId ? (
        <p className="mt-3 text-sm text-slate-600">Esta iniciativa todavía no tiene un proyecto vinculado, así que no tiene equipo.</p>
      ) : loadError ? (
        <p role="alert" className="mt-3 text-sm text-rose-700">No pudimos leer el equipo de esta iniciativa.</p>
      ) : !team ? (
        <p role="status" className="mt-3 text-sm text-slate-500">Leyendo equipo…</p>
      ) : (
        <>
          {team.members.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">Esta iniciativa no tiene personas en su equipo.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {team.members.map((member) => {
                const isOwner = member.role === 'OWNER';
                const busy = busyUserId === member.userId;
                return (
                  <li
                    key={member.userId}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-950">{member.name}</p>
                      {member.email && member.email !== member.name ? <p className="text-xs text-slate-500">{member.email}</p> : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {member.inherited ? <Badge variant="outline">Heredado del reto</Badge> : null}
                      <Badge variant={member.status === 'PENDING' ? 'warning' : 'success'}>
                        {member.status === 'PENDING' ? 'Invitación pendiente' : 'Activo'}
                      </Badge>
                      {canManage && !isOwner ? (
                        <>
                          <label className="sr-only" htmlFor={`team-role-${member.userId}`}>Rol de {member.name}</label>
                          <select
                            id={`team-role-${member.userId}`}
                            value={member.role}
                            disabled={busy}
                            onChange={(event) => changeRole(member, event.target.value as InitiativeTeamRole)}
                            className="rounded-xl border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
                          >
                            {ASSIGNABLE_ROLES.map((role) => (
                              <option key={role} value={role}>{INITIATIVE_TEAM_ROLE_LABEL[role]}</option>
                            ))}
                          </select>
                          {confirmRemoveId === member.userId ? (
                            <>
                              <Button type="button" size="sm" variant="destructive" disabled={busy} onClick={() => remove(member)}>
                                Confirmar quitar
                              </Button>
                              <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => setConfirmRemoveId(null)}>
                                Cancelar
                              </Button>
                            </>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              aria-label={`Quitar a ${member.name}`}
                              onClick={() => setConfirmRemoveId(member.userId)}
                            >
                              Quitar
                            </Button>
                          )}
                        </>
                      ) : (
                        <Badge variant="secondary">{INITIATIVE_TEAM_ROLE_LABEL[member.role]}</Badge>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {actionError ? <p role="alert" className="mt-3 text-sm text-rose-700">{actionError}</p> : null}

          {canManage ? (
            <form className="mt-4 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-4" onSubmit={add} aria-label="Agregar persona al equipo">
              <div className="flex min-w-[12rem] flex-1 flex-col gap-1">
                <label className="text-xs text-slate-500" style={{ fontWeight: 700 }} htmlFor="team-new-user">Persona</label>
                <select
                  id="team-new-user"
                  value={newUser}
                  onChange={(event) => setNewUser(event.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                >
                  <option value="">Elige una persona</option>
                  {candidates.map((candidate) => (
                    <option key={candidate.userId} value={candidate.userId}>{candidate.name} (equipo del reto)</option>
                  ))}
                  <option value={OTHER_USER}>Otro usuario (por ID)</option>
                </select>
              </div>
              {newUser === OTHER_USER ? (
                <div className="flex min-w-[12rem] flex-1 flex-col gap-1">
                  <label className="text-xs text-slate-500" style={{ fontWeight: 700 }} htmlFor="team-new-user-id">ID de usuario</label>
                  <input
                    id="team-new-user-id"
                    value={newUserId}
                    onChange={(event) => setNewUserId(event.target.value)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                  />
                </div>
              ) : null}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-500" style={{ fontWeight: 700 }} htmlFor="team-new-role">Rol</label>
                <select
                  id="team-new-role"
                  value={newRole}
                  onChange={(event) => setNewRole(event.target.value as Exclude<InitiativeTeamRole, 'OWNER'>)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                >
                  {ASSIGNABLE_ROLES.map((role) => (
                    <option key={role} value={role}>{INITIATIVE_TEAM_ROLE_LABEL[role]}</option>
                  ))}
                </select>
              </div>
              <Button type="submit" size="sm" disabled={!targetUserId || adding}>Agregar</Button>
            </form>
          ) : null}
        </>
      )}
    </section>
  );
}
