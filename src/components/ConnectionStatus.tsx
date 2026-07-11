import type { ConnectionValidationResult } from "../simulation/gear-geometry";
import type { GearSystem } from "../simulation/gear-system";

interface ConnectionStatusProps {
  readonly gearSystem: GearSystem;
  readonly validation: ConnectionValidationResult;
}

export function ConnectionStatus({
  gearSystem,
  validation,
}: ConnectionStatusProps) {
  const invalidConnections = gearSystem.connections.filter(
    (connection) =>
      !validation.byConnectionId[connection.id]?.isGeometricallyValid,
  );
  const jammedComponents = validation.jammedComponents;
  const summary = summarizeConnectionState(
    gearSystem.connections.length,
    invalidConnections.length,
    jammedComponents.length,
  );
  const gearsById = new Map(gearSystem.gears.map((gear) => [gear.id, gear]));

  return (
    <section
      className="connectionStatusPanel"
      aria-label="Pitch geometry status"
    >
      <strong aria-label="Connection status" aria-live="polite" role="status">
        {summary}
      </strong>

      {invalidConnections.length > 0 ? (
        <ul>
          {invalidConnections.map((connection) => {
            const result = validation.byConnectionId[connection.id];

            return (
              <li key={connection.id}>
                <b>{connection.id}</b>: {formatConnectionIssues(result)}
              </li>
            );
          })}
        </ul>
      ) : null}

      {jammedComponents.length > 0 ? (
        <ul>
          {jammedComponents.map((component) => (
            <li key={component.connectionIds.join("|")}>
              <b>Jammed</b>:{" "}
              {component.gearIds
                .map((gearId) => gearsById.get(gearId)?.label ?? gearId)
                .join(", ")}{" "}
              ({component.reason.replace("-", " ")})
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function summarizeConnectionState(
  totalConnections: number,
  invalidConnections: number,
  jammedComponents: number,
): string {
  if (invalidConnections === 0 && jammedComponents === 0) {
    return `All ${totalConnections} connections valid`;
  }

  const parts: string[] = [];

  if (invalidConnections > 0) {
    parts.push(
      `${invalidConnections} broken connection${invalidConnections === 1 ? "" : "s"}`,
    );
  }

  if (jammedComponents > 0) {
    parts.push(
      `${jammedComponents} jammed component${jammedComponents === 1 ? "" : "s"}`,
    );
  }

  return parts.join("; ");
}

function formatConnectionIssues(
  result: ConnectionValidationResult["byConnectionId"][string] | undefined,
): string {
  if (!result) {
    return "validation unavailable";
  }

  return result.issueCodes
    .map((issueCode) => {
      switch (issueCode) {
        case "missing-endpoint":
          return "missing endpoint";
        case "self-connection":
          return "self-connection";
        case "module-mismatch":
          return "module mismatch";
        case "mesh-distance":
          return `mesh distance ${formatDistances(result)}`;
        case "compound-center":
          return `compound center ${formatDistances(result)}`;
        default:
          return assertUnreachableIssueCode(issueCode);
      }
    })
    .join("; ");
}

function assertUnreachableIssueCode(issueCode: never): string {
  return `unrecognized issue "${String(issueCode)}"`;
}

function formatDistances(
  result: ConnectionValidationResult["byConnectionId"][string],
): string {
  if (
    result.expectedCenterDistance === null ||
    result.actualCenterDistance === null
  ) {
    return "unavailable";
  }

  return `expected ${result.expectedCenterDistance.toFixed(2)} px, actual ${result.actualCenterDistance.toFixed(2)} px`;
}
