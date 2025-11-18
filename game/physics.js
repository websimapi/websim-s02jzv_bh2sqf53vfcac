import { TILE_TYPE } from '../map-tile-types.js';

// --- Hitbox Definitions (in tile units) ---

// Player hitbox: A circle.
const PLAYER_HITBOX_RADIUS = 1 / 2.5; // ~0.4 tile units, from player-renderer.js

// Tree trunk hitbox: As specified, bottom 50% height, centered 25% width.
const TREE_TRUNK_HITBOX_WIDTH = 0.25;
const TREE_TRUNK_HITBOX_HEIGHT = 0.5;
const TREE_TRUNK_OFFSET_X = (1 - TREE_TRUNK_HITBOX_WIDTH) / 2; // ~0.375

export function getPlayerHitbox(player) {
    return {
        // circle
        x: player.pixelX + player.offsetX,
        y: player.pixelY + player.offsetY,
        radius: PLAYER_HITBOX_RADIUS
    };
}

export function getTreeTrunkHitbox(tileX, tileY) {
    return {
        x: tileX + TREE_TRUNK_OFFSET_X,
        y: tileY + (1 - TREE_TRUNK_HITBOX_HEIGHT), // Bottom half of the tile
        width: TREE_TRUNK_HITBOX_WIDTH,
        height: TREE_TRUNK_HITBOX_HEIGHT
    };
}


// --- Collision Detection ---

/**
 * Basic AABB collision check.
 * @param {object} rect1 - { x, y, width, height }
 * @param {object} rect2 - { x, y, width, height }
 * @returns {boolean} - True if the rectangles overlap.
 */
function checkAABBCollision(rect1, rect2) {
    return (
        rect1.x < rect2.x + rect2.width &&
        rect1.x + rect1.width > rect2.x &&
        rect1.y < rect2.y + rect2.height &&
        rect1.y + rect1.height > rect2.y
    );
}

export function checkCircleRectCollision(circle, rect) {
    // Find the closest point on the rect to the circle's center
    const closestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.width));
    const closestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.height));

    // Calculate the distance between the circle's center and this closest point
    const dx = circle.x - closestX;
    const dy = circle.y - closestY;
    const distanceSquared = (dx * dx) + (dy * dy);

    // If the distance is less than the circle's radius squared, they are colliding
    return distanceSquared < (circle.radius * circle.radius);
}

/**
 * Checks a given rectangular hitbox against all solid objects in the world.
 * @param {object} rect - The hitbox to check { x, y, width, height }.
 * @param {GameMap} gameMap - The game map instance.
 * @returns {boolean} - True if a collision is detected.
 */
export function checkWorldCollision(hitbox, gameMap) {
    const isCircle = hitbox.radius !== undefined;

    // Check collision with map boundaries
    if (isCircle) {
        if (hitbox.x - hitbox.radius < 0 || hitbox.x + hitbox.radius > gameMap.width ||
            hitbox.y - hitbox.radius < 0 || hitbox.y + hitbox.radius > gameMap.height) {
            return true;
        }
    } else { // is rect
        if (hitbox.x < 0 || hitbox.x + hitbox.width > gameMap.width ||
            hitbox.y < 0 || hitbox.y + hitbox.height > gameMap.height) {
            return true;
        }
    }

    // Determine the grid range to check for potential colliders
    const rectForRangeCheck = isCircle ? {
        x: hitbox.x - hitbox.radius,
        y: hitbox.y - hitbox.radius,
        width: hitbox.radius * 2,
        height: hitbox.radius * 2,
    } : hitbox;


    const startX = Math.floor(rectForRangeCheck.x);
    const endX = Math.ceil(rectForRangeCheck.x + rectForRangeCheck.width);
    const startY = Math.floor(rectForRangeCheck.y);
    const endY = Math.ceil(rectForRangeCheck.y + rectForRangeCheck.height);

    // Check against trees in the vicinity
    for (let j = startY; j < endY; j++) {
        for (let i = startX; i < endX; i++) {
            if (i < 0 || i >= gameMap.width || j < 0 || j >= gameMap.height) {
                continue;
            }

            if (gameMap.grid[j][i] === TILE_TYPE.TREE) {
                const treeHitbox = getTreeTrunkHitbox(i, j);
                if (isCircle) {
                    if (checkCircleRectCollision(hitbox, treeHitbox)) {
                        return true;
                    }
                } else {
                    if (checkAABBCollision(hitbox, treeHitbox)) {
                        return true; // Collision detected
                    }
                }
            }
        }
    }

    return false; // No collision
}