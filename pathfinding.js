function findPath(startX, startY, endX, endY, map) {
    const openSet = new Set();
    const closedSet = new Set();
    const cameFrom = new Map();

    const gScore = new Map();
    const fScore = new Map();

    const startNode = `${startX},${startY}`;
    const endNode = `${endX},${endY}`;

    gScore.set(startNode, 0);
    fScore.set(startNode, heuristic(startX, startY, endX, endY));
    openSet.add(startNode);

    while (openSet.size > 0) {
        let current = null;
        let lowestFScore = Infinity;

        for (const node of openSet) {
            if (fScore.get(node) < lowestFScore) {
                lowestFScore = fScore.get(node);
                current = node;
            }
        }

        if (current === endNode) {
            return reconstructPath(cameFrom, current);
        }

        openSet.delete(current);
        closedSet.add(current);

        const [currentX, currentY] = current.split(',').map(Number);

        const neighbors = getNeighbors(currentX, currentY, map, endX, endY);

        for (const neighbor of neighbors) {
            const neighborNode = `${neighbor.x},${neighbor.y}`;
            if (closedSet.has(neighborNode)) {
                continue;
            }

            const dx = neighbor.x - currentX;
            const dy = neighbor.y - currentY;
            const distance = Math.sqrt(dx*dx + dy*dy); // 1 for cardinal, sqrt(2) for diagonal
            const tentativeGScore = gScore.get(current) + distance;

            if (!openSet.has(neighborNode)) {
                openSet.add(neighborNode);
            } else if (tentativeGScore >= gScore.get(neighborNode)) {
                continue;
            }

            cameFrom.set(neighborNode, current);
            gScore.set(neighborNode, tentativeGScore);
            fScore.set(neighborNode, gScore.get(neighborNode) + heuristic(neighbor.x, neighbor.y, endX, endY));
        }
    }

    return null; // No path found
}

function heuristic(x1, y1, x2, y2) {
    return Math.abs(x1 - x2) + Math.abs(y1 - y2); // Manhattan distance
}

function getNeighbors(x, y, map, endX, endY) {
    const neighbors = [];
    const directions = [
        { dx: 0, dy: -1 }, // up
        { dx: 0, dy: 1 },  // down
        { dx: -1, dy: 0 }, // left
        { dx: 1, dy: 0 },   // right
        // Diagonals
        { dx: -1, dy: -1 }, // up-left
        { dx: 1, dy: -1 },  // up-right
        { dx: -1, dy: 1 },  // down-left
        { dx: 1, dy: 1 },   // down-right
    ];

    for (const dir of directions) {
        const newX = x + dir.dx;
        const newY = y + dir.dy;

        const isDestination = (newX === endX && newY === endY);

        if (newX >= 0 && newX < map.width && newY >= 0 && newY < map.height && (!map.isColliding(newX, newY) || isDestination)) {
            // Allow diagonal movement even if one of the adjacent cardinal tiles is blocked.
            // This allows "hugging" corners.
            if (dir.dx !== 0 && dir.dy !== 0) { // It's a diagonal move
                const isObstacleX = map.isColliding(x + dir.dx, y);
                const isObstacleY = map.isColliding(x, y + dir.dy);
                // Only block diagonal if BOTH adjacent tiles that form the corner are obstacles.
                if (!isObstacleX || !isObstacleY) {
                    neighbors.push({ x: newX, y: newY });
                }
            } else { // It's a cardinal move
                neighbors.push({ x: newX, y: newY });
            }
        }
    }
    return neighbors;
}

function reconstructPath(cameFrom, current) {
    const totalPath = [{ x: parseInt(current.split(',')[0]), y: parseInt(current.split(',')[1]) }];
    while (cameFrom.has(current)) {
        current = cameFrom.get(current);
        totalPath.unshift({ x: parseInt(current.split(',')[0]), y: parseInt(current.split(',')[1]) });
    }
    // Remove the starting node from the path as the player is already there
    if (totalPath.length > 0) {
        totalPath.shift();
    }
    return totalPath;
}

export { findPath };