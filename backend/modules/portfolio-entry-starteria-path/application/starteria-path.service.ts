import {
  PortfolioEntrySessionError,
} from '../../portfolio-entry-sessions/application/portfolio-entry-session-errors';
import {
  parseCriticalHandoffPayload,
  PortfolioEntryCriticalHandoffValidationError,
  PORTFOLIO_ENTRY_CRITICAL_HANDOFF_SCHEMA_VERSION,
  type PortfolioEntryCriticalHandoffCurrentness,
  type PortfolioEntryCriticalHandoffRecord,
} from '../../portfolio-entry-sessions/domain/portfolio-entry-critical-handoff.types';
import {
  BUSINESS_CAPABILITY_BOUNDARY_VERSION,
  STARTERIA_PATH_PROJECTION_VERSION,
  STARTERIA_PATH_SCHEMA_VERSION,
  type ConfirmedCurrentCriticalHandoffInput,
  type StarteriaPathAvailableProjection,
  type StarteriaPathProjection,
} from '../../portfolio-entry/domain/starteria-path.types';
import { projectStarteriaPath } from '../../portfolio-entry/presentation/starteria-path-projection';
import {
  parseStarteriaPathDto,
  STARTERIA_PATH_PUBLIC_VERSIONS,
  STARTERIA_PATH_DTO_SCHEMA_VERSION,
  type StarteriaPathDto,
  type StarteriaPathSourceBindingDto,
  type StarteriaPathUnavailableDto,
} from '../presentation/starteria-path.dto';

export type StarteriaPathOwnedSessionContext = Readonly<{
  id: string;
  contextRevision: number;
}>;

export type StarteriaPathProjector = (input: ConfirmedCurrentCriticalHandoffInput) => StarteriaPathProjection;

export type StarteriaPathServiceDependencies = Readonly<{
  getOwnedSessionContext: (sessionId: string, ownerUserId: string) => Promise<StarteriaPathOwnedSessionContext>;
  getLatestCriticalHandoff: (sessionId: string) => Promise<PortfolioEntryCriticalHandoffCurrentness | null>;
  projector?: StarteriaPathProjector;
}>;

export class StarteriaPathError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = 'StarteriaPathError';
  }

  static handoffNotFound(): StarteriaPathError {
    return new StarteriaPathError('STARTERIA_PATH_HANDOFF_NOT_FOUND', 'Critical Handoff not found.');
  }

  static invalidSource(): StarteriaPathError {
    return new StarteriaPathError('STARTERIA_PATH_SOURCE_INVALID', 'Critical Handoff source is invalid.');
  }

  static readFailed(): StarteriaPathError {
    return new StarteriaPathError('STARTERIA_PATH_READ_FAILED', 'Starteria Path could not be read.');
  }

  static projectionFailed(): StarteriaPathError {
    return new StarteriaPathError('STARTERIA_PATH_PROJECTION_FAILED', 'Starteria Path could not be projected.');
  }
}

const STALE_BOUNDARY_STATEMENT = 'The Critical Handoff is no longer current for this Portfolio Entry session.';
const UNCONFIRMED_BOUNDARY_STATEMENT = 'The session owner must confirm the Critical Handoff before a Path can be read.';
const INVALID_BOUNDARY_STATEMENT = 'No Path is available because the Critical Handoff cannot be safely read.';

export class StarteriaPathService {
  private readonly projector: StarteriaPathProjector;

  constructor(private readonly dependencies: StarteriaPathServiceDependencies) {
    this.projector = dependencies.projector ?? ((input) => projectStarteriaPath(input, {
      schemaVersion: STARTERIA_PATH_SCHEMA_VERSION,
      projectionVersion: STARTERIA_PATH_PROJECTION_VERSION,
      businessCapabilityBoundaryVersion: BUSINESS_CAPABILITY_BOUNDARY_VERSION,
    }));
  }

  async getStarteriaPathForOwnedSession(input: {
    sessionId: string;
    ownerUserId: string;
  }): Promise<StarteriaPathDto> {
    const ownedSession = await this.getOwnedSessionContext(input.sessionId, input.ownerUserId);
    let currentness: PortfolioEntryCriticalHandoffCurrentness | null;
    try {
      currentness = await this.getLatestSource(input.sessionId);
    } catch (error) {
      if (error instanceof StarteriaPathError && error.code === 'STARTERIA_PATH_SOURCE_INVALID') {
        return this.unavailableInvalid();
      }
      throw error;
    }
    if (!currentness) throw StarteriaPathError.handoffNotFound();

    const artifact = currentness.artifact;
    if (artifact.sessionId !== ownedSession.id) return this.unavailableInvalid();
    if (!currentness.isCurrent || artifact.sourceContextRevision !== ownedSession.contextRevision) {
      return this.unavailable('STALE', STALE_BOUNDARY_STATEMENT);
    }
    if (!hasValidSourceIdentity(artifact)) return this.unavailableInvalid();
    if (artifact.schemaVersion !== PORTFOLIO_ENTRY_CRITICAL_HANDOFF_SCHEMA_VERSION) {
      return this.unavailableInvalid();
    }
    if (artifact.confirmationState !== 'confirmed') {
      return this.unavailable('UNAVAILABLE_UNCONFIRMED', UNCONFIRMED_BOUNDARY_STATEMENT);
    }

    let payload;
    try {
      payload = parseCriticalHandoffPayload(artifact.schemaVersion, artifact.payload);
    } catch (error) {
      if (error instanceof PortfolioEntryCriticalHandoffValidationError) return this.unavailableInvalid();
      throw StarteriaPathError.readFailed();
    }

    const projectorInput: ConfirmedCurrentCriticalHandoffInput = {
      artifactId: artifact.id,
      artifactVersion: artifact.artifactVersion,
      sourceContextRevision: artifact.sourceContextRevision,
      conclusionStatus: payload.conclusionStatus,
      finalReading: payload.finalReading,
      decisionInView: payload.decisionInView,
      usableNow: payload.usableNow,
      decisionChangingUnknowns: payload.decisionChangingUnknowns,
      firstMovement: payload.firstMovement,
    };

    let projection: StarteriaPathProjection;
    try {
      projection = this.projector(projectorInput);
    } catch {
      throw StarteriaPathError.projectionFailed();
    }

    try {
      return this.toDto(projection, artifact);
    } catch {
      return this.unavailableInvalid();
    }
  }

  private async getOwnedSessionContext(
    sessionId: string,
    ownerUserId: string,
  ): Promise<StarteriaPathOwnedSessionContext> {
    try {
      const session = await this.dependencies.getOwnedSessionContext(sessionId, ownerUserId);
      if (!Number.isSafeInteger(session.contextRevision) || session.contextRevision < 0) {
        throw StarteriaPathError.readFailed();
      }
      return session;
    } catch (error) {
      if (error instanceof PortfolioEntrySessionError || error instanceof StarteriaPathError) throw error;
      throw StarteriaPathError.readFailed();
    }
  }

  private async getLatestSource(sessionId: string): Promise<PortfolioEntryCriticalHandoffCurrentness | null> {
    try {
      return await this.dependencies.getLatestCriticalHandoff(sessionId);
    } catch (error) {
      if (error instanceof PortfolioEntrySessionError || error instanceof PortfolioEntryCriticalHandoffValidationError) {
        if (error instanceof PortfolioEntryCriticalHandoffValidationError) throw StarteriaPathError.invalidSource();
        throw error;
      }
      throw StarteriaPathError.readFailed();
    }
  }

  private toDto(
    projection: StarteriaPathProjection,
    artifact: PortfolioEntryCriticalHandoffRecord,
  ): StarteriaPathDto {
    if (!hasSupportedProjectionVersions(projection)) return this.unavailableInvalid();
    if (projection.pathStatus === 'unavailable_invalid') return this.unavailableInvalid();

    if (projection.pathStatus === 'unavailable_insufficient_basis') {
      if (!projectionSourceMatches(projection, artifact)) return this.unavailableInvalid();
      const result: StarteriaPathUnavailableDto = {
        experienceState: 'UNAVAILABLE_INSUFFICIENT_BASIS',
        boundaryStatement: projection.boundaryStatement,
        sourceBinding: sourceBindingFor(artifact),
        versions: STARTERIA_PATH_PUBLIC_VERSIONS,
      };
      return parseStarteriaPathDto(result) ?? this.unavailableInvalid();
    }

    if (!projectionSourceMatches(projection, artifact)) return this.unavailableInvalid();
    if (!isAvailableProjection(projection)) return this.unavailableInvalid();
    const available = projection;
    const pathStatus = available.pathStatus === 'supported' ? 'SUPPORTED' : 'BOUNDED';
    const result = {
      experienceState: pathStatus,
      starteriaPathStatus: pathStatus,
      valueBridge: {
        currentState: available.valueBridge.currentState,
        starteriaContribution: available.valueBridge.starteriaContribution.map((item) => ({
          statement: item.statement,
          capabilityClass: item.capabilityClass,
          availabilityState: item.availabilityState,
        })),
        tangibleOutcome: {
          statement: available.valueBridge.tangibleOutcome.statement,
          observableArtifact: available.valueBridge.tangibleOutcome.observableArtifact,
        },
        remainingDependency: available.valueBridge.remainingDependencies.map((item) => ({
          statement: item.statement,
          dependencyType: 'DECISION_CHANGING_UNKNOWN',
        })),
      },
      capabilityPath: available.capabilityPath.map((item) => ({
        capabilityType: item.capabilityType,
        statement: item.contextualStatement,
        whyRelevant: item.whyItMattersHere,
      })),
      dependencies: available.dependencies.map((item) => ({
        dependencyType: item.category,
        statement: item.statement,
        whyItMatters: item.whyItMatters,
      })),
      firstSupportedMovement: available.firstSupportedMovement === null
        ? null
        : {
          movement: available.firstSupportedMovement.movement,
          whyNow: available.firstSupportedMovement.whyNow,
          whatItMayClarify: available.firstSupportedMovement.whatItMayClarify,
          boundary: available.firstSupportedMovement.boundary,
        },
      boundaryStatement: available.boundaryStatement,
      sourceBinding: sourceBindingFor(artifact),
      versions: STARTERIA_PATH_PUBLIC_VERSIONS,
    };
    return parseStarteriaPathDto(result) ?? this.unavailableInvalid();
  }

  private unavailableInvalid(): StarteriaPathUnavailableDto {
    return this.unavailable('UNAVAILABLE_INVALID', INVALID_BOUNDARY_STATEMENT);
  }

  private unavailable(
    experienceState: StarteriaPathUnavailableDto['experienceState'],
    boundaryStatement: string,
  ): StarteriaPathUnavailableDto {
    const result: StarteriaPathUnavailableDto = {
      experienceState,
      boundaryStatement,
      versions: STARTERIA_PATH_PUBLIC_VERSIONS,
    };
    return result;
  }
}

function hasValidSourceIdentity(artifact: PortfolioEntryCriticalHandoffRecord): boolean {
  return artifact.id.trim().length > 0
    && Number.isSafeInteger(artifact.artifactVersion)
    && artifact.artifactVersion >= 1
    && Number.isSafeInteger(artifact.sourceContextRevision)
    && artifact.sourceContextRevision >= 0;
}

function hasSupportedProjectionVersions(projection: StarteriaPathProjection): boolean {
  return projection.versions.schemaVersion === STARTERIA_PATH_SCHEMA_VERSION
    && projection.versions.projectionVersion === STARTERIA_PATH_PROJECTION_VERSION
    && projection.versions.businessCapabilityBoundaryVersion === BUSINESS_CAPABILITY_BOUNDARY_VERSION;
}

function isAvailableProjection(projection: StarteriaPathProjection): projection is StarteriaPathAvailableProjection {
  return projection.pathStatus === 'supported' || projection.pathStatus === 'bounded';
}

function projectionSourceMatches(
  projection: StarteriaPathProjection,
  artifact: PortfolioEntryCriticalHandoffRecord,
): boolean {
  return projection.sourceBinding !== null
    && projection.sourceBinding.artifactId === artifact.id
    && projection.sourceBinding.artifactVersion === artifact.artifactVersion
    && projection.sourceBinding.sourceContextRevision === artifact.sourceContextRevision;
}

function sourceBindingFor(artifact: PortfolioEntryCriticalHandoffRecord): StarteriaPathSourceBindingDto {
  return {
    criticalHandoffId: artifact.id,
    criticalHandoffVersion: artifact.artifactVersion,
    sourceContextRevision: artifact.sourceContextRevision,
    current: true,
    confirmed: true,
    projectionVersion: STARTERIA_PATH_PROJECTION_VERSION,
    businessCapabilityBoundaryVersion: BUSINESS_CAPABILITY_BOUNDARY_VERSION,
    pathSchemaVersion: STARTERIA_PATH_DTO_SCHEMA_VERSION,
  };
}
