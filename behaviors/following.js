import { PLAYER_STATE } from '../player-state.js';
import { findPath } from '../pathfinding.js';
import { updateWander, updateFollowPath } from '../player-movement.js';
import { startChoppingCycle } from './chopping.js';
import { startGatheringCycle } from './gathering.js';
import { TILE_TYPE } from '../map-tile-types.js';

const WOODCUTTING_STATES = [PLAYER_STATE.MOVING_TO_TREE, PLAYER_STATE.CHOPPING];
const GATHERING_STATES = [PLAYER_STATE.MOVING_TO_LOGS, PLAYER_STATE.HARVESTING_LOGS, PLAYER_STATE.MOVING_TO_BUSHES, PLAYER_STATE.HARVESTING_BUSHES, PLAYER_STATE.SEARCHING_FOR_GATHERABLE, PLAYER_STATE.WANDERING_TO_GATHER];

export function updateFollow(player, gameMap, allPlayers, deltaTime) {
    const targetPlayer = allPlayers.get(player.followTargetId);

    if (!targetPlayer || !targetPlayer.isPowered()) {
        console.log(`[${player.username}] Follow target lost. Idling.`);
        player.state = PLAYER_STATE.IDLE;
        player.followTargetId = null;
        player.activeCommand = null;
        return;
    }

    const dx = targetPlayer.pixelX - player.pixelX;
    const dy = targetPlayer.pixelY - player.pixelY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // If too far, move closer
    if (distance > 8) {
        // If not already on a path, check for opportunistic gathering
        if (player.path.length === 0) {
            const nearbyGatherable = gameMap.findNearestInRadius(player.pixelX, player.pixelY, [TILE_TYPE.LOGS, TILE_TYPE.BUSHES], 5); // check in a 5-tile radius

            if (nearbyGatherable) {
                const startX = Math.round(player.pixelX);
                const startY = Math.round(player.pixelY);
                const path = findPath(startX, startY, nearbyGatherable.x, nearbyGatherable.y, gameMap);

                if (path) {
                    console.log(`[${player.username}] Following ${targetPlayer.username}, but found nearby gatherable at (${nearbyGatherable.x}, ${nearbyGatherable.y}). Pausing to gather.`);
                    player.actionTarget = nearbyGatherable;
                    player.path = path;
                    if (nearbyGatherable.type === TILE_TYPE.LOGS) {
                        player.state = PLAYER_STATE.MOVING_TO_LOGS;
                    } else {
                        player.state = PLAYER_STATE.MOVING_TO_BUSHES;
                    }
                    return; // Exit updateFollow for this frame, the main loop will handle the gathering state
                }
            }
        }
        
        // Only find a new path if not already moving
        if (player.path.length === 0) {
            const startX = Math.round(player.pixelX);
            const startY = Math.round(player.pixelY);
            // Find a valid spot near the target
            const targetX = Math.round(targetPlayer.pixelX);
            const targetY = Math.round(targetPlayer.pixelY);

            let bestSpot = null;
            let minPathLength = Infinity;

            for (let r = 1; r < 5; r++) {
                 for (let i = -r; i <= r; i++) {
                    for (let j = -(r-Math.abs(i)); j <= (r-Math.abs(i)); j++) {
                        if(i === 0 && j === 0) continue;
                        const spotX = targetX + i;
                        const spotY = targetY + j;

                        if (spotX >= 0 && spotX < gameMap.width && spotY >= 0 && spotY < gameMap.height && !gameMap.isColliding(spotX, spotY)) {
                            const path = findPath(startX, startY, spotX, spotY, gameMap);
                            if (path && path.length < minPathLength) {
                                minPathLength = path.length;
                                bestSpot = path;
                            }
                        }
                    }
                }
                if (bestSpot) break; // Found a path in this radius
            }

            if (bestSpot) {
                player.path = bestSpot;
            } else {
                 console.log(`[${player.username}] Can't find path to follow ${targetPlayer.username}. Idling for now.`);
            }
        }
        updateFollowPath(player, deltaTime, gameMap);
        return;
    }
    
    // Within range, so stop moving
    player.path = [];

    // If there are pending resources to harvest from a previous action, do that first.
    if (player.pendingHarvest.length > 0) {
        // This can happen if the follower finishes chopping and is ready to gather,
        // but this logic runs before the gathering state is initiated.
        // We will let the gathering logic from other functions take priority.
        // This check prevents re-initiating a new action while another is pending.
        return;
    }

    // Mimic target's actions
    if (WOODCUTTING_STATES.includes(targetPlayer.state)) {
        startChoppingCycle(player, gameMap);
    } else if (GATHERING_STATES.includes(targetPlayer.state)) {
        // Perform a localized search around the target player to avoid wandering off.
        const gatherables = gameMap.findAllInRadius(targetPlayer.pixelX, targetPlayer.pixelY, [TILE_TYPE.LOGS, TILE_TYPE.BUSHES], 10);
        if (gatherables.length > 0) {
            startGatheringCycle(player, gameMap, targetPlayer, 10);
        } else if (WOODCUTTING_STATES.includes(targetPlayer.state) && targetPlayer.actionTarget) {
            // Nothing to gather, but the target is still chopping. Let's help them.
             console.log(`[${player.username}] Nothing to gather near ${targetPlayer.username}, switching to help chop.`);
            startChoppingCycle(player, gameMap);
        } else {
             updateWander(player, deltaTime, gameMap);
        }
    } else {
        // Target is idle or wandering, so follower also wanders
        updateWander(player, deltaTime, gameMap);
    }
}