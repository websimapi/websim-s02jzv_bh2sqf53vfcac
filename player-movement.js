export function updateWander(player, deltaTime, gameMap) {
    player.moveCooldown -= deltaTime;
    if (player.moveCooldown <= 0) {
        pickNewTarget(player, gameMap);
        player.moveCooldown = 2 + Math.random() * 5; // reset cooldown
    }
    updateMoveToTarget(player, deltaTime, gameMap);
}

export function updateFollowPath(player, deltaTime, gameMap) {
    if (player.path.length === 0) {
        // Snap to grid if movement is complete to avoid slight offsets
        const finalTarget = player.actionTarget || { x: player.targetX, y: player.targetY };
        const dx = finalTarget.x - player.pixelX;
        const dy = finalTarget.y - player.pixelY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 0.01 && dist < 1) { // Only snap if close to final destination
             const moveAmount = player.speed * deltaTime;
             const nextPixelX = player.pixelX + (dx / dist) * moveAmount;
             const nextPixelY = player.pixelY + (dy / dist) * moveAmount;
             player.pixelX = nextPixelX;
             player.pixelY = nextPixelY;
        } else if (dist <= 0.01) {
            player.pixelX = Math.round(player.pixelX);
            player.pixelY = Math.round(player.pixelY);
        }
        return;
    }

    // Set the current target to the next waypoint in the path
    const nextWaypoint = player.path[0];
    player.targetX = nextWaypoint.x + 0.5;
    player.targetY = nextWaypoint.y + 0.5;

    // Move towards the waypoint
    updateMoveToTarget(player, deltaTime, gameMap);

    // Check if we've reached the waypoint
    const dx = player.targetX - player.pixelX;
    const dy = player.targetY - player.pixelY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 0.05) {
        // Snap to grid point before moving to next waypoint
        player.pixelX = player.targetX;
        player.pixelY = player.targetY;
        // Reached the waypoint, remove it from the path
        player.path.shift();
    }
}

import { getPlayerHitbox, checkWorldCollision } from './game/physics.js';

export function updateMoveToTarget(player, deltaTime, gameMap) {
    const dx = player.targetX - player.pixelX;
    const dy = player.targetY - player.pixelY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 0.01) {
        const moveAmount = Math.min(player.speed * deltaTime, dist);
        
        const moveX = (dx / dist) * moveAmount;
        const moveY = (dy / dist) * moveAmount;

        let proposedX = player.pixelX + moveX;
        let proposedY = player.pixelY + moveY;

        // Store current position to detect if movement is blocked
        player.prevPixelX = player.pixelX;
        player.prevPixelY = player.pixelY;
        
        const originalHitbox = getPlayerHitbox(player);

        // Check X-axis movement
        let hitboxX = { ...originalHitbox, x: proposedX + player.offsetX };
        if (!checkWorldCollision(hitboxX, gameMap)) {
            player.pixelX = proposedX;
        }

        // Check Y-axis movement
        // We need to re-evaluate the hitbox's Y based on the (potentially updated) player X
        const currentHitbox = getPlayerHitbox(player);
        let hitboxY = { ...currentHitbox, y: proposedY + player.offsetY };
        if (!checkWorldCollision(hitboxY, gameMap)) {
            player.pixelY = proposedY;
        }
    } else {
        player.pixelX = player.targetX;
        player.pixelY = player.targetY;
    }
}

export function applySeparation(player, allPlayers, gameMap) {
    const separationRadius = (1 / 2.5) * 2; // Player diameter in grid units
    const separationForce = 0.005; // A small push force to avoid being too jerky
    let totalPushX = 0;
    let totalPushY = 0;
    let neighbors = 0;

    for (const otherPlayer of allPlayers.values()) {
        if (otherPlayer.id === player.id) continue;

        const dx = player.pixelX - otherPlayer.pixelX;
        const dy = player.pixelY - otherPlayer.pixelY;
        const distanceSq = dx * dx + dy * dy;

        // Only consider players that are actually overlapping or very close
        if (distanceSq > 0 && distanceSq < separationRadius * separationRadius) {
            const distance = Math.sqrt(distanceSq);
            // The closer the players, the stronger the push
            const pushFactor = (separationRadius - distance) / separationRadius;
            totalPushX += (dx / distance) * pushFactor;
            totalPushY += (dy / distance) * pushFactor;
            neighbors++;
        }
    }

    if (neighbors > 0) {
        // Average the push vector and apply the force
        const avgPushX = (totalPushX / neighbors) * separationForce;
        const avgPushY = (totalPushY / neighbors) * separationForce;

        const newPixelX = player.pixelX + avgPushX;
        const newPixelY = player.pixelY + avgPushY;

        // Check against map collision before applying the separation push
        if (!gameMap.isPixelColliding(newPixelX, newPixelY)) {
            player.pixelX = newPixelX;
            player.pixelY = newPixelY;
        } else {
            // If pushing into a wall, try pushing only along one valid axis
            if (!gameMap.isPixelColliding(newPixelX, player.pixelY)) {
                player.pixelX = newPixelX;
            } else if (!gameMap.isPixelColliding(player.pixelX, newPixelY)) {
                player.pixelY = newPixelY;
            }
        }
    }
}

export function pickNewTarget(player, gameMap) {
    let attempts = 0;
    let validTarget = false;
    
    const mapWidth = gameMap.width;
    const mapHeight = gameMap.height;

    while (attempts < 8 && !validTarget) {
        let currentGridX = Math.round(player.pixelX); 
        let currentGridY = Math.round(player.pixelY);

        let newX = currentGridX;
        let newY = currentGridY;

        const dir = Math.floor(Math.random() * 4);

        switch (dir) {
            case 0: newY--; break; // Up
            case 1: newY++; break; // Down
            case 2: newX--; break; // Left
            case 3: newX++; break; // Right
        }

        if (newX < 0 || newX >= mapWidth || newY < 0 || newY >= mapHeight) {
            attempts++;
            continue;
        }
        
        if (!gameMap.isColliding(newX, newY)) {
            validTarget = true;
            player.targetX = newX + 0.5;
            player.targetY = newY + 0.5;
        }
        attempts++;
    }
    
    if (!validTarget) {
        player.targetX = player.pixelX;
        player.targetY = player.pixelY;
    }
}

