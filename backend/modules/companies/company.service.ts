import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { config } from '../../config';
import { AppError } from '../../shared/errors/AppError';
import { calculateContextScore } from './context-score';
import { ContextAiClient } from './context-ai-client';
import {
  CONTEXT_EXTRACTOR_VERSION,
  MAX_CONTEXT_FILE_BYTES,
  detectContextMime,
  fetchPublicWebsite,
  normalizeDomain,
  readContextFile,
  sanitizeFileName,
  saveContextFile,
  sha256,
  slugify,
} from './context-utils';
import type {
  AddMembershipInput,
  CreateAreaInput,
  CreateCompanyInput,
  CreateNoteInput,
  CreateSnapshotInput,
  CreateUrlSourceInput,
  SubmitContributionInput,
  UpdateAreaInput,
  UpdateCompanyInput,
  UpdateContextInput,
  UpdateMembershipInput,
} from './company.schemas';

type Actor = { id: string; role: string; email?: string };

type CompanyAccess = {
  canRead: boolean;
  canEdit: boolean;
  canPublish: boolean;
  canAdmin: boolean;
};

function publicCompanySelect() {
  return {
    memberships: true,
    versions: { orderBy: { versionNumber: 'desc' as const }, take: 1 },
    areas: { where: { status: 'ACTIVE' as any }, orderBy: { createdAt: 'desc' as const } },
    sources: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' as const } },
  };
}

function latestVersionWhere(companyId: string) {
  return { companyId, status: { in: ['PUBLISHED', 'DRAFT'] as any } };
}

function labelSourceStatus(status: string): string {
  const map: Record<string, string> = {
    PENDING: 'Pendiente',
    PROCESSING: 'Analizando',
    PROCESSED: 'Procesada',
    PARTIAL: 'Procesada parcialmente',
    BLOCKED: 'Bloqueada por el sitio',
    ERROR: 'Error',
    NEEDS_REVIEW: 'Requiere revision',
    STALE: 'Desactualizada',
    DELETED: 'Eliminada',
  };
  return map[status] ?? status;
}

function normalizePdfText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7e]/g, '?');
}

function escapePdfText(value: string): string {
  return normalizePdfText(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function wrapPdfLine(line: string, width = 96): string[] {
  const words = normalizePdfText(line).split(/\s+/);
  const out: string[] = [];
  let current = '';
  for (const word of words) {
    if (!word) continue;
    if (`${current} ${word}`.trim().length > width) {
      if (current) out.push(current);
      current = word;
    } else {
      current = `${current} ${word}`.trim();
    }
  }
  if (current) out.push(current);
  return out.length ? out : [''];
}

function renderSimplePdf(lines: string[]): Buffer {
  const wrapped = lines.flatMap((line) => wrapPdfLine(line));
  const pages: string[][] = [];
  for (let i = 0; i < wrapped.length; i += 52) pages.push(wrapped.slice(i, i + 52));
  if (!pages.length) pages.push(['Contexto de empresa']);

  const objects: Record<number, string> = {};
  const kids: string[] = [];
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  pages.forEach((pageLines, index) => {
    const contentNo = 3 + index * 2;
    const pageNo = contentNo + 1;
    kids.push(`${pageNo} 0 R`);
    const stream = [
      'BT',
      '/F1 10 Tf',
      '50 792 Td',
      '14 TL',
      ...pageLines.map((line) => `(${escapePdfText(line)}) Tj T*`),
      'ET',
    ].join('\n');
    objects[contentNo] = `<< /Length ${Buffer.byteLength(stream, 'ascii')} >>\nstream\n${stream}\nendstream`;
    objects[pageNo] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /Contents ${contentNo} 0 R >>`;
  });
  objects[2] = `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pages.length} >>`;

  const maxObject = Math.max(...Object.keys(objects).map(Number));
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (let i = 1; i <= maxObject; i += 1) {
    offsets[i] = Buffer.byteLength(pdf, 'ascii');
    pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf, 'ascii');
  pdf += `xref\n0 ${maxObject + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= maxObject; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${maxObject + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, 'ascii');
}

export class CompanyService {
  constructor(
    private prisma: PrismaClient,
    private aiClient = new ContextAiClient(),
  ) {}

  private async access(companyId: string, actor: Actor): Promise<CompanyAccess & { company: any }> {
    const [company, actorUser] = await Promise.all([
      this.prisma.company.findUnique({
        where: { id: companyId },
        include: { memberships: true },
      }),
      this.prisma.user.findUnique({ where: { id: actor.id }, select: { organizationId: true } }),
    ]);
    if (!company || company.deletedAt) {
      throw AppError.notFound('Empresa', 'COMPANY_NOT_FOUND');
    }
    if (company.organizationId && (!actorUser?.organizationId || company.organizationId !== actorUser.organizationId)) {
      throw AppError.notFound('Empresa', 'COMPANY_NOT_FOUND');
    }
    if (actor.role === 'admin' && company.organizationId === actorUser?.organizationId) {
      return { company, canRead: true, canEdit: true, canPublish: true, canAdmin: true };
    }
    const owner = company.ownerUserId === actor.id && company.scope === 'PERSONAL';
    const membership = company.memberships.find((m: any) => m.userId === actor.id && m.status === 'APPROVED');
    const role = membership?.role;
    const canRead = owner || Boolean(membership);
    const canEdit = owner || role === 'OWNER' || role === 'CURATOR' || role === 'EDITOR';
    const canPublish = role === 'OWNER' || role === 'CURATOR';
    const canAdmin = owner || role === 'OWNER';
    return { company, canRead, canEdit, canPublish, canAdmin };
  }

  private async initiativeProject(initiativeId: string, actor: Actor) {
    const [project, actorUser] = await Promise.all([
      this.prisma.project.findUnique({ where: { id: initiativeId }, include: { teamMembers: true } }),
      this.prisma.user.findUnique({ where: { id: actor.id }, select: { organizationId: true } }),
    ]);
    if (!project?.organizationId || !actorUser?.organizationId || project.organizationId !== actorUser.organizationId) {
      throw AppError.notFound('Proyecto', 'PROJECT_NOT_FOUND');
    }
    return project;
  }

  private assertRead(access: CompanyAccess): void {
    if (!access.canRead) throw AppError.forbidden('No tienes acceso a esta empresa.', 'COMPANY_ACCESS_DENIED');
  }

  private assertEdit(access: CompanyAccess): void {
    if (!access.canEdit) throw AppError.forbidden('No puedes modificar esta empresa.', 'COMPANY_EDIT_DENIED');
  }

  private async writeAudit(actorId: string, action: string, resource: string, resourceId: string, details?: Record<string, unknown>) {
    await this.prisma.auditLog.create({
      data: { userId: actorId, action, resource, resourceId, details: (details ?? {}) as any },
    });
  }

  private enqueueUrlSource(actor: Actor, companyId: string, input: CreateUrlSourceInput): void {
    void this.createUrlSource(actor, companyId, input).catch((err) =>
      this.writeAudit(actor.id, 'company.context_source.enqueue_failed', 'Company', companyId, {
        sourceType: input.sourceType,
        url: input.url,
        errorCode: err?.code ?? 'CONTEXT_SOURCE_CREATE_FAILED',
        errorMessage: err instanceof Error ? err.message : 'No fue posible registrar la fuente.',
      }).catch(() => undefined),
    );
  }

  private async buildSnapshot(companyId: string, versionId?: string) {
    const [company, entries, sources, areas] = await Promise.all([
      this.prisma.company.findUnique({ where: { id: companyId } }),
      this.prisma.companyContextEntry.findMany({ where: { companyId }, orderBy: { createdAt: 'asc' } }),
      this.prisma.contextSource.findMany({ where: { companyId, deletedAt: null }, orderBy: { createdAt: 'desc' } }),
      this.prisma.companyArea.findMany({ where: { companyId, status: 'ACTIVE' }, include: { contexts: { orderBy: { version: 'desc' }, take: 1 } } }),
    ]);
    if (!company) throw AppError.notFound('Empresa', 'COMPANY_NOT_FOUND');
    const score = calculateContextScore(entries as any, sources as any);
    return {
      company: {
        id: company.id,
        name: company.name,
        sector: company.sector,
        country: company.country,
        employeeRange: company.employeeRange,
        websiteUrl: company.websiteUrl,
        linkedinUrl: company.linkedinUrl,
        scope: company.scope,
      },
      versionId,
      contextScore: score.score,
      contextLevel: score.level,
      scoreBreakdown: score.breakdown,
      missing: score.missing,
      entries: entries.map((entry: any) => ({
        dimension: entry.dimension,
        fieldKey: entry.fieldKey,
        value: entry.valueJson,
        sourceType: entry.sourceType,
        sourceId: entry.sourceId,
        confidence: entry.confidence,
        verificationStatus: entry.verificationStatus,
        updatedAt: entry.updatedAt,
      })),
      sources: sources.map((source: any) => ({
        id: source.id,
        sourceType: source.sourceType,
        url: source.url,
        originalFilename: source.originalFilename,
        status: source.status,
        statusLabel: labelSourceStatus(source.status),
        processedAt: source.processedAt,
        metadata: source.metadataJson,
      })),
      areas: areas.map((area: any) => ({
        id: area.id,
        name: area.name,
        description: area.description,
        leadRole: area.leadRole,
        context: area.contexts[0] ?? null,
      })),
    };
  }

  private async createVersion(companyId: string, actorId: string, status: 'DRAFT' | 'PUBLISHED' = 'DRAFT') {
    const last = await this.prisma.companyContextVersion.findFirst({
      where: { companyId },
      orderBy: { versionNumber: 'desc' },
    });
    const versionNumber = (last?.versionNumber ?? 0) + 1;
    const snapshot = await this.buildSnapshot(companyId);
    return this.prisma.companyContextVersion.create({
      data: {
        companyId,
        versionNumber,
        status,
        contextScore: snapshot.contextScore,
        contextLevel: snapshot.contextLevel as any,
        snapshotJson: snapshot as any,
        scoreBreakdownJson: snapshot.scoreBreakdown as any,
        missingJson: snapshot.missing as any,
        createdByUserId: actorId,
        ...(status === 'PUBLISHED' ? { publishedByUserId: actorId, publishedAt: new Date() } : {}),
      },
    });
  }

  async list(actor: Actor) {
    const actorUser = await this.prisma.user.findUnique({ where: { id: actor.id }, select: { organizationId: true } });
    if (!actorUser?.organizationId) return [];
    const companies = await this.prisma.company.findMany({
      where: {
        deletedAt: null,
        OR: [
          { ownerUserId: actor.id },
          { memberships: { some: { userId: actor.id, status: 'APPROVED' } } },
          ...(actor.role === 'admin' ? [{ organizationId: actorUser.organizationId }] : []),
        ],
      },
      include: publicCompanySelect(),
      orderBy: { updatedAt: 'desc' },
    });
    return companies.filter((company) => company.organizationId == null || company.organizationId === actorUser.organizationId);
  }

  async create(actor: Actor, data: CreateCompanyInput) {
    if (data.scope === 'ORGANIZATION' && actor.role !== 'admin') {
      throw AppError.forbidden('Solo un administrador puede crear una empresa organizacional.', 'COMPANY_ORG_CREATE_DENIED');
    }
    const actorUser = await this.prisma.user.findUnique({ where: { id: actor.id }, select: { organizationId: true } });
    if (data.scope === 'ORGANIZATION' && (!actorUser?.organizationId || (data.organizationId && data.organizationId !== actorUser.organizationId))) {
      throw AppError.notFound('Empresa', 'COMPANY_NOT_FOUND');
    }
    const websiteUrl = data.websiteUrl || undefined;
    const linkedinUrl = data.linkedinUrl || undefined;
    const company = await this.prisma.$transaction(async (tx) => {
      const row = await tx.company.create({
        data: {
          name: data.name.trim(),
          slug: slugify(data.name),
          normalizedDomain: normalizeDomain(websiteUrl),
          sector: data.sector.trim(),
          country: data.country.trim(),
          employeeRange: data.employeeRange,
          websiteUrl,
          linkedinUrl,
          ownerUserId: data.scope === 'ORGANIZATION' ? null : actor.id,
          organizationId: data.scope === 'ORGANIZATION' ? actorUser?.organizationId ?? null : null,
          scope: data.scope ?? 'PERSONAL',
          memberships: {
            create: {
              userId: actor.id,
              role: 'OWNER',
              status: 'APPROVED',
              approvedByUserId: actor.id,
              approvedAt: new Date(),
            },
          },
        },
      });
      await tx.companyContextEntry.createMany({
        data: [
          { companyId: row.id, dimension: 'IDENTITY', fieldKey: 'name', valueJson: data.name, sourceType: 'USER_INPUT', verificationStatus: 'USER_CONFIRMED', createdByUserId: actor.id },
          { companyId: row.id, dimension: 'IDENTITY', fieldKey: 'sector', valueJson: data.sector, sourceType: 'USER_INPUT', verificationStatus: 'USER_CONFIRMED', createdByUserId: actor.id },
          { companyId: row.id, dimension: 'IDENTITY', fieldKey: 'country', valueJson: data.country, sourceType: 'USER_INPUT', verificationStatus: 'USER_CONFIRMED', createdByUserId: actor.id },
          ...(data.employeeRange ? [{ companyId: row.id, dimension: 'IDENTITY' as any, fieldKey: 'employeeRange', valueJson: data.employeeRange, sourceType: 'USER_INPUT' as any, verificationStatus: 'USER_CONFIRMED' as any, createdByUserId: actor.id }] : []),
        ],
      });
      if (data.areaName?.trim()) {
        await tx.companyArea.create({
          data: { companyId: row.id, name: data.areaName.trim(), createdAt: new Date() },
        });
      }
      return row;
    });
    await this.createVersion(company.id, actor.id);
    await this.writeAudit(actor.id, 'company.create', 'Company', company.id, { scope: company.scope });
    if (websiteUrl) this.enqueueUrlSource(actor, company.id, { sourceType: 'WEBSITE', url: websiteUrl });
    if (linkedinUrl) this.enqueueUrlSource(actor, company.id, { sourceType: 'LINKEDIN', url: linkedinUrl });
    return this.get(actor, company.id);
  }

  async get(actor: Actor, companyId: string) {
    const access = await this.access(companyId, actor);
    this.assertRead(access);
    return this.prisma.company.findUnique({
      where: { id: companyId },
      include: publicCompanySelect(),
    });
  }

  async update(actor: Actor, companyId: string, data: UpdateCompanyInput) {
    const access = await this.access(companyId, actor);
    this.assertEdit(access);
    const updated = await this.prisma.company.update({
      where: { id: companyId },
      data: {
        ...(data.name ? { name: data.name.trim(), slug: slugify(data.name) } : {}),
        ...(data.sector ? { sector: data.sector.trim() } : {}),
        ...(data.country ? { country: data.country.trim() } : {}),
        employeeRange: data.employeeRange,
        websiteUrl: data.websiteUrl || undefined,
        linkedinUrl: data.linkedinUrl || undefined,
        normalizedDomain: data.websiteUrl ? normalizeDomain(data.websiteUrl) : undefined,
      },
    });
    await this.createVersion(companyId, actor.id);
    await this.writeAudit(actor.id, 'company.update', 'Company', companyId);
    if (data.websiteUrl) this.enqueueUrlSource(actor, companyId, { sourceType: 'WEBSITE', url: data.websiteUrl });
    if (data.linkedinUrl) this.enqueueUrlSource(actor, companyId, { sourceType: 'LINKEDIN', url: data.linkedinUrl });
    return updated;
  }

  async deleteOrArchive(actor: Actor, companyId: string) {
    const access = await this.access(companyId, actor);
    if (!access.canAdmin) throw AppError.forbidden('No puedes eliminar esta empresa.', 'COMPANY_DELETE_DENIED');
    const snapshotCount = await this.prisma.initiativeContextSnapshot.count({ where: { companyId } });
    if (access.company.scope === 'ORGANIZATION' || snapshotCount > 0) {
      await this.prisma.company.update({ where: { id: companyId }, data: { status: 'ARCHIVED', deletedAt: new Date() } });
    } else {
      await this.prisma.company.delete({ where: { id: companyId } });
    }
    await this.writeAudit(actor.id, 'company.delete_or_archive', 'Company', companyId, { snapshotCount });
  }

  async clone(actor: Actor, companyId: string) {
    const access = await this.access(companyId, actor);
    this.assertRead(access);
    const snapshot = await this.buildSnapshot(companyId);
    const cloned = await this.prisma.company.create({
      data: {
        name: `${access.company.name} (copia)`,
        slug: `${access.company.slug}-copia`,
        normalizedDomain: access.company.normalizedDomain,
        sector: access.company.sector,
        country: access.company.country,
        employeeRange: access.company.employeeRange,
        websiteUrl: access.company.websiteUrl,
        linkedinUrl: access.company.linkedinUrl,
        ownerUserId: actor.id,
        scope: 'PERSONAL',
        originCompanyId: companyId,
        originAuthorId: access.company.ownerUserId,
        clonedFromAt: new Date(),
        memberships: { create: { userId: actor.id, role: 'OWNER', status: 'APPROVED', approvedByUserId: actor.id, approvedAt: new Date() } },
      },
    });
    for (const entry of snapshot.entries) {
      await this.prisma.companyContextEntry.create({
        data: {
          companyId: cloned.id,
          dimension: entry.dimension as any,
          fieldKey: entry.fieldKey,
          valueJson: entry.value as any,
          sourceType: entry.sourceType as any,
          confidence: entry.confidence ?? null,
          verificationStatus: entry.verificationStatus as any,
          createdByUserId: actor.id,
        },
      });
    }
    await this.createVersion(cloned.id, actor.id);
    return this.get(actor, cloned.id);
  }

  async readContext(actor: Actor, companyId: string) {
    const access = await this.access(companyId, actor);
    this.assertRead(access);
    const versions = await this.prisma.companyContextVersion.findMany({ where: { companyId }, orderBy: { versionNumber: 'desc' } });
    const snapshot = await this.buildSnapshot(companyId, versions[0]?.id);
    return { ...snapshot, versions };
  }

  async updateContext(actor: Actor, companyId: string, input: UpdateContextInput) {
    const access = await this.access(companyId, actor);
    this.assertEdit(access);
    await this.prisma.$transaction(async (tx) => {
      for (const item of input.entries) {
        await tx.companyContextEntry.create({
          data: {
            companyId,
            dimension: item.dimension as any,
            fieldKey: item.fieldKey,
            valueJson: item.value as any,
            sourceType: item.sourceType as any,
            sourceId: item.sourceId,
            confidence: item.confidence,
            verificationStatus: item.verificationStatus as any,
            createdByUserId: actor.id,
          },
        });
      }
    });
    await this.createVersion(companyId, actor.id);
    return this.readContext(actor, companyId);
  }

  async versions(actor: Actor, companyId: string) {
    const access = await this.access(companyId, actor);
    this.assertRead(access);
    return this.prisma.companyContextVersion.findMany({ where: { companyId }, orderBy: { versionNumber: 'desc' } });
  }

  async publish(actor: Actor, companyId: string) {
    const access = await this.access(companyId, actor);
    if (!access.canPublish) {
      throw AppError.forbidden('No puedes publicar contexto organizacional.', 'COMPANY_PUBLISH_DENIED');
    }
    const version = await this.createVersion(companyId, actor.id, 'PUBLISHED');
    await this.writeAudit(actor.id, 'company.context.publish', 'CompanyContextVersion', version.id, { companyId });
    return version;
  }

  async score(actor: Actor, companyId: string) {
    const access = await this.access(companyId, actor);
    this.assertRead(access);
    const [entries, sources] = await Promise.all([
      this.prisma.companyContextEntry.findMany({ where: { companyId } }),
      this.prisma.contextSource.findMany({ where: { companyId, deletedAt: null } }),
    ]);
    return calculateContextScore(entries as any, sources as any);
  }

  async listAreas(actor: Actor, companyId: string) {
    const access = await this.access(companyId, actor);
    this.assertRead(access);
    return this.prisma.companyArea.findMany({
      where: { companyId, status: 'ACTIVE' },
      include: { contexts: { orderBy: { version: 'desc' }, take: 1 } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createArea(actor: Actor, companyId: string, input: CreateAreaInput) {
    const access = await this.access(companyId, actor);
    this.assertEdit(access);
    const area = await this.prisma.companyArea.create({
      data: {
        companyId,
        name: input.name,
        description: input.description,
        leadRole: input.leadRole,
        contexts: input.context ? {
          create: {
            purpose: input.context.purpose,
            autonomyLevel: input.context.autonomyLevel,
            dependenciesJson: input.context.dependencies ?? [],
            prioritiesJson: input.context.priorities ?? [],
            createdByUserId: actor.id,
          },
        } : undefined,
      },
      include: { contexts: true },
    });
    await this.createVersion(companyId, actor.id);
    return area;
  }

  async updateArea(actor: Actor, companyId: string, areaId: string, input: UpdateAreaInput) {
    const access = await this.access(companyId, actor);
    this.assertEdit(access);
    const area = await this.prisma.companyArea.findFirst({ where: { id: areaId, companyId } });
    if (!area) throw AppError.notFound('Area', 'COMPANY_AREA_NOT_FOUND');
    const latest = await this.prisma.companyAreaContext.findFirst({ where: { areaId }, orderBy: { version: 'desc' } });
    const updated = await this.prisma.companyArea.update({
      where: { id: areaId },
      data: {
        name: input.name,
        description: input.description,
        leadRole: input.leadRole,
        ...(input.context ? {
          contexts: {
            create: {
              version: (latest?.version ?? 0) + 1,
              purpose: input.context.purpose,
              autonomyLevel: input.context.autonomyLevel,
              dependenciesJson: input.context.dependencies ?? [],
              prioritiesJson: input.context.priorities ?? [],
              createdByUserId: actor.id,
            },
          },
        } : {}),
      },
      include: { contexts: { orderBy: { version: 'desc' }, take: 1 } },
    });
    await this.createVersion(companyId, actor.id);
    return updated;
  }

  async deleteArea(actor: Actor, companyId: string, areaId: string) {
    const access = await this.access(companyId, actor);
    this.assertEdit(access);
    const area = await this.prisma.companyArea.findFirst({ where: { id: areaId, companyId } });
    if (!area) throw AppError.notFound('Area', 'COMPANY_AREA_NOT_FOUND');
    await this.prisma.companyArea.update({ where: { id: areaId }, data: { status: 'ARCHIVED' } });
    await this.createVersion(companyId, actor.id);
  }

  async listSources(actor: Actor, companyId: string) {
    const access = await this.access(companyId, actor);
    this.assertRead(access);
    return this.prisma.contextSource.findMany({
      where: { companyId, deletedAt: null },
      include: { extractionRuns: { orderBy: { createdAt: 'desc' }, take: 1 } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createUrlSource(actor: Actor, companyId: string, input: CreateUrlSourceInput) {
    const access = await this.access(companyId, actor);
    this.assertEdit(access);
    if (input.areaId) {
      const area = await this.prisma.companyArea.findFirst({ where: { id: input.areaId, companyId, status: 'ACTIVE' } });
      if (!area) throw AppError.notFound('Area', 'COMPANY_AREA_NOT_FOUND');
    }
    if (input.sourceType === 'LINKEDIN' && !/linkedin\.com$/i.test(new URL(input.url).hostname.replace(/^www\./, ''))) {
      throw AppError.badRequest('La fuente LinkedIn debe apuntar a linkedin.com.', 'CONTEXT_LINKEDIN_URL_INVALID');
    }
    const source = await this.prisma.contextSource.create({
      data: {
        companyId,
        areaId: input.areaId,
        sourceType: input.sourceType as any,
        url: input.url,
        status: 'PENDING',
        createdByUserId: actor.id,
      },
    });
    const run = await this.prisma.contextExtractionRun.create({
      data: { sourceId: source.id, status: 'PENDING', extractorVersion: CONTEXT_EXTRACTOR_VERSION },
    });
    void this.processSource(actor, source.id, run.id).catch(() => undefined);
    return { source, run };
  }

  async uploadSource(actor: Actor, companyId: string, input: { fileName: string; mimeType?: string; bytes: Buffer; areaId?: string; requestId?: string }) {
    const access = await this.access(companyId, actor);
    this.assertEdit(access);
    if (input.areaId) {
      const area = await this.prisma.companyArea.findFirst({ where: { id: input.areaId, companyId, status: 'ACTIVE' } });
      if (!area) throw AppError.notFound('Area', 'COMPANY_AREA_NOT_FOUND');
    }
    if (!input.bytes.byteLength) throw AppError.badRequest('Archivo vacio.', 'CONTEXT_FILE_EMPTY');
    if (input.bytes.byteLength > MAX_CONTEXT_FILE_BYTES) {
      throw AppError.badRequest('El archivo excede el limite permitido.', 'CONTEXT_FILE_TOO_LARGE');
    }
    const fileName = sanitizeFileName(input.fileName);
    const mimeType = detectContextMime(fileName, input.mimeType, input.bytes);
    const contentHash = sha256(input.bytes);
    const duplicate = await this.prisma.contextSource.findFirst({ where: { companyId, contentHash, deletedAt: null } });
    if (duplicate) return { source: duplicate, duplicate: true };
    const sourceId = randomUUID();
    const storageKey = await saveContextFile(config.localStorageDir, companyId, sourceId, fileName, input.bytes);
    const source = await this.prisma.contextSource.create({
      data: {
        id: sourceId,
        companyId,
        areaId: input.areaId,
        sourceType: 'FILE',
        storageKey,
        mimeType,
        originalFilename: fileName,
        status: 'PENDING',
        contentHash,
        createdByUserId: actor.id,
      },
    });
    const run = await this.prisma.contextExtractionRun.create({
      data: { sourceId: source.id, status: 'PENDING', extractorVersion: CONTEXT_EXTRACTOR_VERSION },
    });
    void this.processSource(actor, source.id, run.id, input.bytes, input.requestId).catch(() => undefined);
    return { source, run };
  }

  async readSource(actor: Actor, sourceId: string) {
    const source = await this.prisma.contextSource.findUnique({ where: { id: sourceId }, include: { extractionRuns: true } });
    if (!source || source.deletedAt) throw AppError.notFound('Fuente', 'CONTEXT_SOURCE_NOT_FOUND');
    if (source.companyId) this.assertRead(await this.access(source.companyId, actor));
    return source;
  }

  async deleteSource(actor: Actor, sourceId: string) {
    const source = await this.readSource(actor, sourceId);
    if (source.companyId) this.assertEdit(await this.access(source.companyId, actor));
    await this.prisma.contextSource.update({ where: { id: sourceId }, data: { status: 'DELETED', deletedAt: new Date() } });
  }

  async reprocessSource(actor: Actor, sourceId: string) {
    const source = await this.readSource(actor, sourceId);
    if (source.companyId) this.assertEdit(await this.access(source.companyId, actor));
    const run = await this.prisma.contextExtractionRun.create({ data: { sourceId, status: 'PENDING', extractorVersion: CONTEXT_EXTRACTOR_VERSION } });
    void this.processSource(actor, sourceId, run.id).catch(() => undefined);
    return run;
  }

  private async processSource(actor: Actor, sourceId: string, runId: string, bytes?: Buffer, requestId?: string) {
    const source = await this.prisma.contextSource.findUnique({ where: { id: sourceId } });
    if (!source) return;
    await this.prisma.contextExtractionRun.update({ where: { id: runId }, data: { status: 'RUNNING', startedAt: new Date() } });
    await this.prisma.contextSource.update({ where: { id: sourceId }, data: { status: 'PROCESSING' } });
    try {
      let result: any;
      let rawContent = source.rawContent ?? '';
      let cleanContent = source.cleanContent ?? '';
      let metadata: Record<string, unknown> = {};
      if (source.sourceType === 'WEBSITE' || source.sourceType === 'LINKEDIN') {
        if (!source.url) throw AppError.badRequest('URL requerida.', 'CONTEXT_URL_REQUIRED');
        if (source.sourceType === 'LINKEDIN') {
          try {
            const fetched = await fetchPublicWebsite(source.url);
            rawContent = fetched.rawContent;
            cleanContent = fetched.cleanContent;
            metadata = fetched.metadata;
          } catch (err) {
            const message = err instanceof Error ? err.message : 'LinkedIn bloqueado';
            await this.prisma.contextSource.update({ where: { id: sourceId }, data: { status: 'BLOCKED', metadataJson: { reason: message } as any } });
            await this.prisma.contextExtractionRun.update({ where: { id: runId }, data: { status: 'BLOCKED', errorCode: 'LINKEDIN_BLOCKED', errorMessage: message, completedAt: new Date() } });
            return;
          }
        } else {
          const fetched = await fetchPublicWebsite(source.url);
          rawContent = fetched.rawContent;
          cleanContent = fetched.cleanContent;
          metadata = fetched.metadata;
        }
        result = await this.aiClient.extract({
          sourceType: source.sourceType as any,
          url: source.url,
          title: (metadata.title as string | undefined) ?? null,
          cleanContent,
          requestId,
          userId: actor.id,
          role: actor.role,
        });
      } else {
        if (!bytes && source.storageKey) {
          bytes = await readContextFile(config.localStorageDir, source.storageKey);
        }
        if (!bytes) throw AppError.badRequest('Archivo requerido.', 'CONTEXT_FILE_REQUIRED');
        result = await this.aiClient.extractFile({
          sourceType: 'FILE',
          mimeType: source.mimeType ?? 'application/octet-stream',
          fileName: source.originalFilename ?? 'documento',
          fileBase64: bytes.toString('base64'),
          requestId,
          userId: actor.id,
          role: actor.role,
        });
        rawContent = result.rawContent ?? '';
        cleanContent = result.cleanContent ?? '';
        metadata = { fileName: source.originalFilename, mimeType: source.mimeType };
      }
      await this.prisma.$transaction(async (tx) => {
        await tx.contextSource.update({
          where: { id: sourceId },
          data: {
            status: result.warnings?.length ? 'PARTIAL' : 'PROCESSED',
            rawContent,
            cleanContent,
            contentHash: sha256(cleanContent || rawContent || source.url || sourceId),
            metadataJson: metadata as any,
            extractedDataJson: result as any,
            processedAt: new Date(),
          },
        });
        for (const entry of result.entries ?? []) {
          await tx.companyContextEntry.create({
            data: {
              companyId: source.companyId!,
              dimension: entry.dimension as any,
              fieldKey: entry.fieldKey,
              valueJson: entry.value as any,
              sourceType: source.sourceType as any,
              sourceId,
              confidence: entry.confidence ?? 0.5,
              verificationStatus: entry.verificationStatus ?? 'INFERRED',
              createdByUserId: actor.id,
            },
          });
        }
        await tx.contextExtractionRun.update({
          where: { id: runId },
          data: {
            status: result.warnings?.length ? 'PARTIAL' : 'COMPLETED',
            provider: 'openrouter',
            model: result.model ?? null,
            tokensUsed: result.tokensUsed ?? null,
            estimatedCost: result.estimatedCost ?? null,
            completedAt: new Date(),
          },
        });
      });
      if (source.companyId) await this.createVersion(source.companyId, actor.id);
    } catch (err) {
      const message = err instanceof Error ? err.message.slice(0, 500) : 'unknown_error';
      await this.prisma.contextSource.update({ where: { id: sourceId }, data: { status: 'ERROR' } });
      await this.prisma.contextExtractionRun.update({ where: { id: runId }, data: { status: 'FAILED', errorCode: 'CONTEXT_EXTRACTION_FAILED', errorMessage: message, completedAt: new Date() } });
    }
  }

  async memberships(actor: Actor, companyId: string) {
    const access = await this.access(companyId, actor);
    this.assertRead(access);
    return this.prisma.companyMembership.findMany({ where: { companyId }, orderBy: { createdAt: 'asc' } });
  }

  async addMembership(actor: Actor, companyId: string, input: AddMembershipInput) {
    const access = await this.access(companyId, actor);
    if (!access.canAdmin) throw AppError.forbidden('No puedes administrar miembros.', 'COMPANY_MEMBER_DENIED');
    return this.prisma.companyMembership.upsert({
      where: { companyId_userId: { companyId, userId: input.userId } },
      create: { companyId, userId: input.userId, role: input.role as any, status: 'PENDING' },
      update: { role: input.role as any, status: 'PENDING' },
    });
  }

  async updateMembership(actor: Actor, companyId: string, membershipId: string, input: UpdateMembershipInput) {
    const access = await this.access(companyId, actor);
    if (!access.canAdmin) throw AppError.forbidden('No puedes administrar miembros.', 'COMPANY_MEMBER_DENIED');
    const membership = await this.prisma.companyMembership.findFirst({ where: { id: membershipId, companyId } });
    if (!membership) throw AppError.notFound('Miembro', 'COMPANY_MEMBERSHIP_NOT_FOUND');
    return this.prisma.companyMembership.update({
      where: { id: membershipId },
      data: {
        role: input.role as any,
        status: input.status as any,
        ...(input.status === 'APPROVED' ? { approvedByUserId: actor.id, approvedAt: new Date() } : {}),
      },
    });
  }

  async removeMembership(actor: Actor, companyId: string, membershipId: string) {
    return this.updateMembership(actor, companyId, membershipId, { status: 'REMOVED' });
  }

  async submitContribution(actor: Actor, companyId: string, input: SubmitContributionInput) {
    const access = await this.access(companyId, actor);
    this.assertRead(access);
    return this.prisma.companyContribution.create({
      data: {
        companyId,
        submittedByUserId: actor.id,
        targetDimension: input.targetDimension as any,
        proposedValueJson: input.proposedValue as any,
        evidenceSourceId: input.evidenceSourceId,
      },
    });
  }

  async listContributions(actor: Actor, companyId: string) {
    const access = await this.access(companyId, actor);
    this.assertRead(access);
    return this.prisma.companyContribution.findMany({ where: { companyId }, orderBy: { createdAt: 'desc' } });
  }

  async reviewContribution(actor: Actor, companyId: string, id: string, approved: boolean) {
    const access = await this.access(companyId, actor);
    if (!access.canPublish) throw AppError.forbidden('No puedes revisar aportes.', 'COMPANY_CONTRIBUTION_REVIEW_DENIED');
    const existing = await this.prisma.companyContribution.findFirst({ where: { id, companyId } });
    if (!existing) throw AppError.notFound('Aporte', 'COMPANY_CONTRIBUTION_NOT_FOUND');
    const contribution = await this.prisma.companyContribution.update({
      where: { id },
      data: { status: approved ? 'APPROVED' : 'REJECTED', reviewedByUserId: actor.id, reviewedAt: new Date() },
    });
    if (approved) {
      await this.prisma.companyContextEntry.create({
        data: {
          companyId,
          dimension: contribution.targetDimension,
          fieldKey: `contribution.${contribution.id}`,
          valueJson: contribution.proposedValueJson as any,
          sourceType: 'USER_INPUT',
          sourceId: contribution.evidenceSourceId,
          verificationStatus: 'USER_CONFIRMED',
          createdByUserId: actor.id,
        },
      });
      await this.createVersion(companyId, actor.id);
    }
    return contribution;
  }

  async createInitiativeSnapshot(actor: Actor, initiativeId: string, input: CreateSnapshotInput) {
    const project = await this.initiativeProject(initiativeId, actor);
    const isOwner = project.ownerId === actor.id || project.teamMembers.some((m: any) => m.userId === actor.id && m.role === 'OWNER' && m.status === 'ACTIVE');
    if (!isOwner && actor.role !== 'admin') throw AppError.forbidden('Solo el owner puede administrar el contexto de la iniciativa.', 'INITIATIVE_CONTEXT_DENIED');
    const access = await this.access(input.companyId, actor);
    this.assertRead(access);
    if (input.areaId) {
      const area = await this.prisma.companyArea.findFirst({ where: { id: input.areaId, companyId: input.companyId, status: 'ACTIVE' } });
      if (!area) throw AppError.notFound('Area', 'COMPANY_AREA_NOT_FOUND');
    }
    const version = await this.prisma.companyContextVersion.findFirst({ where: latestVersionWhere(input.companyId), orderBy: { versionNumber: 'desc' } });
    const createdVersion = version ?? await this.createVersion(input.companyId, actor.id);
    const snapshot = await this.buildSnapshot(input.companyId, createdVersion.id);
    const areaVersion = input.areaId
      ? (await this.prisma.companyAreaContext.findFirst({ where: { areaId: input.areaId }, orderBy: { version: 'desc' } }))?.version ?? null
      : null;
    return this.prisma.initiativeContextSnapshot.create({
      data: {
        initiativeId,
        companyId: input.companyId,
        companyVersionId: createdVersion.id,
        areaId: input.areaId,
        areaVersion,
        snapshotJson: snapshot as any,
        contextScore: snapshot.contextScore,
        createdByUserId: actor.id,
      },
    });
  }

  async readInitiativeSnapshot(actor: Actor, initiativeId: string) {
    const project = await this.initiativeProject(initiativeId, actor);
    const isMember = actor.role === 'admin' || project.teamMembers.some((m: any) => m.userId === actor.id && m.status === 'ACTIVE');
    if (!isMember) throw AppError.forbidden('No tienes acceso a esta iniciativa.', 'PROJECT_ACCESS_DENIED');
    return this.prisma.initiativeContextSnapshot.findFirst({
      where: { initiativeId },
      orderBy: { createdAt: 'desc' },
      include: { company: true, companyVersion: true, area: true },
    });
  }

  async syncInitiativeSnapshot(actor: Actor, initiativeId: string) {
    const current = await this.readInitiativeSnapshot(actor, initiativeId);
    if (!current) throw AppError.notFound('Snapshot', 'INITIATIVE_CONTEXT_NOT_FOUND');
    return this.createInitiativeSnapshot(actor, initiativeId, { companyId: current.companyId, areaId: current.areaId ?? undefined });
  }

  async createInitiativeNote(actor: Actor, initiativeId: string, input: CreateNoteInput) {
    const project = await this.initiativeProject(initiativeId, actor);
    const canWrite = project.ownerId === actor.id || project.teamMembers.some((m: any) => m.userId === actor.id && m.status === 'ACTIVE' && (m.role === 'OWNER' || m.role === 'EDITOR'));
    if (!canWrite && actor.role !== 'admin') throw AppError.forbidden('No puedes agregar notas al contexto.', 'INITIATIVE_CONTEXT_NOTE_DENIED');
    return this.prisma.initiativeContextNote.create({
      data: { initiativeId, authorUserId: actor.id, content: input.content, sourceType: 'PROJECT_NOTE' },
    });
  }

  async exportInitiativeContext(actor: Actor, initiativeId: string, format: 'markdown' | 'pdf' = 'markdown') {
    const snapshot = await this.readInitiativeSnapshot(actor, initiativeId);
    if (!snapshot) throw AppError.notFound('Snapshot', 'INITIATIVE_CONTEXT_NOT_FOUND');
    const data = snapshot.snapshotJson as any;
    const lines = [
      `# Contexto de empresa: ${data.company?.name ?? snapshot.company.name}`,
      '',
      `Fecha: ${snapshot.createdAt.toISOString()}`,
      `Version: ${snapshot.companyVersion.versionNumber}`,
      `Nivel de contexto disponible: ${data.contextLevel} (${snapshot.contextScore}%)`,
      '',
      '## Informacion considerada',
      ...(data.entries ?? []).map((entry: any) => `- ${entry.dimension}.${entry.fieldKey}: ${JSON.stringify(entry.value)}`),
      '',
      '## Fuentes',
      ...(data.sources ?? []).map((source: any) => `- ${source.sourceType}: ${source.url ?? source.originalFilename ?? source.id} (${source.statusLabel ?? source.status})`),
      '',
      '## Informacion faltante',
      ...((data.missing ?? []).length ? data.missing.map((item: string) => `- ${item}`) : ['- Sin brechas principales registradas.']),
      '',
      'Aviso: este export mantiene trazabilidad de fuentes y version. No modifica automaticamente el contexto de empresa.',
    ];
    return {
      format,
      fileName: `contexto-${snapshot.company.slug}-${snapshot.id}.${format === 'pdf' ? 'pdf' : 'md'}`,
      contentType: format === 'pdf' ? 'application/pdf' : 'text/markdown; charset=utf-8',
      body: format === 'pdf' ? renderSimplePdf(lines) : lines.join('\n'),
    };
  }
}
