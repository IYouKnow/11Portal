import {
  DESKTOP_ICON_GAP_X,
  DESKTOP_ICON_GAP_Y,
  DESKTOP_ICON_HEIGHT,
  DESKTOP_ICON_MARGIN,
  DESKTOP_ICON_WIDTH,
  apps,
} from "./constants";
import type {
  AppID,
  DesktopSelectionState,
  IconPosition,
  IconPositionMap,
  SnapMode,
} from "./types";

export function clampDesktopIconPosition(
  position: IconPosition,
  bounds: DOMRect,
): IconPosition {
  const maxX = Math.max(0, bounds.width - DESKTOP_ICON_WIDTH);
  const maxY = Math.max(0, bounds.height - DESKTOP_ICON_HEIGHT);

  return {
    x: Math.max(0, Math.min(position.x, maxX)),
    y: Math.max(0, Math.min(position.y, maxY)),
  };
}

function getDesktopGridMetrics(bounds: DOMRect) {
  const usableWidth = Math.max(
    DESKTOP_ICON_WIDTH,
    bounds.width - DESKTOP_ICON_MARGIN * 2,
  );
  const usableHeight = Math.max(
    DESKTOP_ICON_HEIGHT,
    bounds.height - DESKTOP_ICON_MARGIN * 2,
  );
  const columns = Math.max(
    1,
    Math.floor(
      (usableWidth + DESKTOP_ICON_GAP_X) /
        (DESKTOP_ICON_WIDTH + DESKTOP_ICON_GAP_X),
    ),
  );
  const rows = Math.max(
    1,
    Math.floor(
      (usableHeight + DESKTOP_ICON_GAP_Y) /
        (DESKTOP_ICON_HEIGHT + DESKTOP_ICON_GAP_Y),
    ),
  );

  return { columns, rows };
}

function getDesktopGridCell(position: IconPosition, bounds: DOMRect) {
  const { columns, rows } = getDesktopGridMetrics(bounds);
  const column = Math.max(
    0,
    Math.min(
      columns - 1,
      Math.round(
        (position.x - DESKTOP_ICON_MARGIN) /
          (DESKTOP_ICON_WIDTH + DESKTOP_ICON_GAP_X),
      ),
    ),
  );
  const row = Math.max(
    0,
    Math.min(
      rows - 1,
      Math.round(
        (position.y - DESKTOP_ICON_MARGIN) /
          (DESKTOP_ICON_HEIGHT + DESKTOP_ICON_GAP_Y),
      ),
    ),
  );

  return { column, row };
}

function getDesktopGridPosition(
  cell: { column: number; row: number },
  bounds: DOMRect,
): IconPosition {
  return clampDesktopIconPosition(
    {
      x: DESKTOP_ICON_MARGIN + cell.column * (DESKTOP_ICON_WIDTH + DESKTOP_ICON_GAP_X),
      y: DESKTOP_ICON_MARGIN + cell.row * (DESKTOP_ICON_HEIGHT + DESKTOP_ICON_GAP_Y),
    },
    bounds,
  );
}

function findNearestAvailableDesktopCell(
  preferredCell: { column: number; row: number },
  occupied: Set<string>,
  bounds: DOMRect,
) {
  const { columns, rows } = getDesktopGridMetrics(bounds);
  let bestCell = preferredCell;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const key = `${column}:${row}`;
      if (occupied.has(key)) {
        continue;
      }

      const distance =
        Math.abs(column - preferredCell.column) +
        Math.abs(row - preferredCell.row);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestCell = { column, row };
      }
    }
  }

  return bestCell;
}

export function normalizeDesktopIconPositions(
  positions: IconPositionMap,
  bounds: DOMRect,
  prioritizedAppId?: AppID,
): IconPositionMap {
  const appOrder = prioritizedAppId
    ? [
        prioritizedAppId,
        ...apps.map((app) => app.id).filter((appId) => appId !== prioritizedAppId),
      ]
    : apps.map((app) => app.id);
  const occupied = new Set<string>();
  const nextPositions = {} as IconPositionMap;

  for (const appId of appOrder) {
    const clampedPosition = clampDesktopIconPosition(positions[appId], bounds);
    const preferredCell = getDesktopGridCell(clampedPosition, bounds);
    const chosenCell = findNearestAvailableDesktopCell(
      preferredCell,
      occupied,
      bounds,
    );
    occupied.add(`${chosenCell.column}:${chosenCell.row}`);
    nextPositions[appId] = getDesktopGridPosition(chosenCell, bounds);
  }

  return nextPositions;
}

function getIconGroupBounds(appIds: AppID[], positions: IconPositionMap) {
  const xs = appIds.map((appId) => positions[appId].x);
  const ys = appIds.map((appId) => positions[appId].y);

  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

export function translateDesktopIconGroup(
  positions: IconPositionMap,
  appIds: AppID[],
  deltaX: number,
  deltaY: number,
  bounds: DOMRect,
): IconPositionMap {
  const groupBounds = getIconGroupBounds(appIds, positions);
  const maxX = Math.max(0, bounds.width - DESKTOP_ICON_WIDTH);
  const maxY = Math.max(0, bounds.height - DESKTOP_ICON_HEIGHT);
  const clampedDeltaX = Math.max(
    -groupBounds.minX,
    Math.min(deltaX, maxX - groupBounds.maxX),
  );
  const clampedDeltaY = Math.max(
    -groupBounds.minY,
    Math.min(deltaY, maxY - groupBounds.maxY),
  );
  const nextPositions = { ...positions };

  for (const appId of appIds) {
    nextPositions[appId] = {
      x: positions[appId].x + clampedDeltaX,
      y: positions[appId].y + clampedDeltaY,
    };
  }

  return nextPositions;
}

export function snapDesktopIconGroup(
  positions: IconPositionMap,
  bounds: DOMRect,
  groupAppIds: AppID[],
): IconPositionMap {
  if (groupAppIds.length === 0) {
    return normalizeDesktopIconPositions(positions, bounds);
  }

  const nonGroupIds = apps
    .map((app) => app.id)
    .filter((appId) => !groupAppIds.includes(appId));
  const occupied = new Set<string>();
  const nextPositions = { ...positions };

  for (const appId of nonGroupIds) {
    const clampedPosition = clampDesktopIconPosition(positions[appId], bounds);
    const preferredCell = getDesktopGridCell(clampedPosition, bounds);
    const chosenCell = findNearestAvailableDesktopCell(
      preferredCell,
      occupied,
      bounds,
    );
    occupied.add(`${chosenCell.column}:${chosenCell.row}`);
    nextPositions[appId] = getDesktopGridPosition(chosenCell, bounds);
  }

  const groupCells = groupAppIds.map((appId) => ({
    appId,
    cell: getDesktopGridCell(
      clampDesktopIconPosition(positions[appId], bounds),
      bounds,
    ),
  }));
  const minColumn = Math.min(...groupCells.map((item) => item.cell.column));
  const minRow = Math.min(...groupCells.map((item) => item.cell.row));
  const groupOffsets = groupCells.map((item) => ({
    appId: item.appId,
    columnOffset: item.cell.column - minColumn,
    rowOffset: item.cell.row - minRow,
  }));
  const { columns, rows } = getDesktopGridMetrics(bounds);
  let bestAnchor = { column: minColumn, row: minRow };
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const fits = groupOffsets.every((offset) => {
        const targetColumn = column + offset.columnOffset;
        const targetRow = row + offset.rowOffset;
        return (
          targetColumn >= 0 &&
          targetRow >= 0 &&
          targetColumn < columns &&
          targetRow < rows &&
          !occupied.has(`${targetColumn}:${targetRow}`)
        );
      });

      if (!fits) {
        continue;
      }

      const distance =
        Math.abs(column - minColumn) + Math.abs(row - minRow);

      if (distance < bestDistance) {
        bestDistance = distance;
        bestAnchor = { column, row };
      }
    }
  }

  for (const offset of groupOffsets) {
    const targetCell = {
      column: bestAnchor.column + offset.columnOffset,
      row: bestAnchor.row + offset.rowOffset,
    };
    occupied.add(`${targetCell.column}:${targetCell.row}`);
    nextPositions[offset.appId] = getDesktopGridPosition(targetCell, bounds);
  }

  return nextPositions;
}

export function getSelectionBounds(
  selection: NonNullable<DesktopSelectionState>,
) {
  const left = Math.min(selection.startX, selection.currentX);
  const top = Math.min(selection.startY, selection.currentY);
  const width = Math.abs(selection.currentX - selection.startX);
  const height = Math.abs(selection.currentY - selection.startY);

  return { left, top, width, height };
}

export function rectanglesIntersect(
  left: { left: number; top: number; width: number; height: number },
  right: { left: number; top: number; width: number; height: number },
) {
  return (
    left.left < right.left + right.width &&
    left.left + left.width > right.left &&
    left.top < right.top + right.height &&
    left.top + left.height > right.top
  );
}

export function detectSnapMode(
  pointerX: number,
  pointerY: number,
): SnapMode | "maximize" | null {
  const edgeThreshold = 12;
  const topThreshold = 16;
  const cornerThreshold = 64;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  const nearLeft = pointerX <= edgeThreshold;
  const nearRight = pointerX >= viewportWidth - edgeThreshold;
  const nearTop = pointerY <= topThreshold;
  const nearBottom = pointerY >= viewportHeight - edgeThreshold;
  const inTopLeftCorner = pointerX <= cornerThreshold && pointerY <= cornerThreshold;
  const inTopRightCorner =
    pointerX >= viewportWidth - cornerThreshold && pointerY <= cornerThreshold;
  const inBottomLeftCorner =
    pointerX <= cornerThreshold && pointerY >= viewportHeight - cornerThreshold;
  const inBottomRightCorner =
    pointerX >= viewportWidth - cornerThreshold &&
    pointerY >= viewportHeight - cornerThreshold;

  if (inTopLeftCorner) {
    return "top-left";
  }
  if (inTopRightCorner) {
    return "top-right";
  }
  if (inBottomLeftCorner) {
    return "bottom-left";
  }
  if (inBottomRightCorner) {
    return "bottom-right";
  }
  if (nearTop) {
    return "maximize";
  }
  if (nearLeft) {
    return "left";
  }
  if (nearRight) {
    return "right";
  }
  if (nearBottom) {
    return null;
  }

  return null;
}

export function getSnapBounds(mode: SnapMode | "maximize") {
  if (mode === "maximize") {
    return {
      left: 0,
      top: 0,
      width: window.innerWidth,
      height: window.innerHeight,
    };
  }

  if (mode === "left") {
    return {
      left: 0,
      top: 0,
      width: window.innerWidth / 2,
      height: window.innerHeight,
    };
  }

  if (mode === "right") {
    return {
      left: window.innerWidth / 2,
      top: 0,
      width: window.innerWidth / 2,
      height: window.innerHeight,
    };
  }

  const isLeft = mode === "top-left" || mode === "bottom-left";
  const isTop = mode === "top-left" || mode === "top-right";

  return {
    left: isLeft ? 0 : window.innerWidth / 2,
    top: isTop ? 0 : window.innerHeight / 2,
    width: window.innerWidth / 2,
    height: window.innerHeight / 2,
  };
}
