import { PLAYER_STATE } from '../player-state.js';
import { AudioManager } from '../audio-manager.js';
import { updateWander, updateMoveToTarget, updateFollowPath } from '../player-movement.js';
import { beginChopping, finishChopping, startChoppingCycle, findAndMoveToTree } from './chopping.js';
import { beginHarvestingBushes, beginHarvestingLogs, finishHarvestingBushes, finishHarvestingLogs, harvestNextBush, startGatheringCycle } from './gathering.js';
import { updateFollow } from './following.js';
import { TILE_TYPE } from '../map-tile-types.js';
import { findPath } from '../pathfinding.js';
import { getPlayerHitbox, getTreeTrunkHitbox, checkCircleRectCollision } from '../game/physics.js';

function treeHasBeenChopped(player, gameMap, allPlayers) {
    console.log(`[${player.username}] Joined in chopping a tree that was just cut. Proceeding to gather.`);
    
    // The player who finished the chop is responsible for spawning resources.
    // We just need to find them and copy the pendingHarvest list.
    const treeX = player.actionTarget.x;
    const treeY = player.actionTarget.y;

    let leadChopper = null;
    for (const p of allPlayers.values()) {
        // Find the player who just cut this tree, they will have the pendingHarvest list.
        if (p.pendingHarvest.some(item => item.sourceTreeX === treeX && item.sourceTreeY === treeY)) {
            leadChopper = p;
            break;
        }
    }
    
    if (leadChopper) {
        player.pendingHarvest = [...leadChopper.pendingHarvest]; // Copy the harvest list
    } else {
        // Fallback: if we can't find the lead chopper (e.g., they disconnected),
        // we won't have bushes, but we can still try to get the logs.
        player.pendingHarvest = [];
    }

    // Move to logs first. The position is the original tree position.
    player.actionTarget = { x: treeX, y: treeY }; 
    player.state = PLAYER_STATE.IDLE;
    const startX = Math.round(player.pixelX);
    const startY = Math.round(player.pixelY);
    const path = findPath(startX, startY, treeX, treeY, gameMap);

    if(path) {
        player.path = path;
        player.state = PLAYER_STATE.MOVING_TO_LOGS;
    } else {
        console.warn(`[${player.username}] No path found to logs from cooperative chop. Trying bushes.`);
        harvestNextBush(player, gameMap, game); // game isn't available here, this could be an issue. Let's pass it.
    }
}

export function updateAction(player, deltaTime, gameMap, allPlayers, game) {
    const atMoveTarget = player.path.length === 0;

    switch (player.state) {
        case PLAYER_STATE.IDLE:
            updateWander(player, deltaTime, gameMap);
            break;

        case PLAYER_STATE.SEARCHING_FOR_TREE:
             updateWander(player, deltaTime, gameMap);
             const distFromTreeSearch = Math.sqrt(
                (player.pixelX - player.lastSearchPosition.x)**2 +
                (player.pixelY - player.lastSearchPosition.y)**2
            );
            if (distFromTreeSearch > 8) {
                findAndMoveToTree(player, gameMap);
            }
            break;

        case PLAYER_STATE.MOVING_TO_TREE:
            if (!player.actionTarget || gameMap.grid[player.actionTarget.y][player.actionTarget.x] !== TILE_TYPE.TREE) {
                console.log(`[${player.username}] Target tree at (${player.actionTarget?.x}, ${player.actionTarget?.y}) is gone. Finding a new one.`);
                startChoppingCycle(player, gameMap);
                return;
            }
            updateFollowPath(player, deltaTime, gameMap);
            
            // Check if player is now touching the tree trunk's interaction area.
            const playerHitbox = getPlayerHitbox(player);
            const treeTrunkHitbox = getTreeTrunkHitbox(player.actionTarget.x, player.actionTarget.y);
            
            // Inflate the tree's hitbox slightly for interaction check.
            // This ensures that when collision stops the player, they are inside this interaction box.
            const interactionPadding = 0.05; // A small padding in grid units
            const interactionHitbox = {
                x: treeTrunkHitbox.x - interactionPadding,
                y: treeTrunkHitbox.y - interactionPadding,
                width: treeTrunkHitbox.width + interactionPadding * 2,
                height: treeTrunkHitbox.height + interactionPadding * 2
            };

            const isTouching = checkCircleRectCollision(playerHitbox, interactionHitbox);

            if (isTouching) {
                beginChopping(player, gameMap, game);
                return; // State transitioned
            }

            // Fallback: If movement has completely stopped (due to path end or being stuck) and we're not touching, find a new tree.
            const movementStopped = player.path.length === 0 && (player.pixelX === player.prevPixelX && player.pixelY === player.prevPixelY);
            if(movementStopped) {
                console.warn(`[${player.username}] Arrived near tree but not touching. Finding new tree.`);
                startChoppingCycle(player, gameMap);
            }
            break;
        case PLAYER_STATE.MOVING_TO_LOGS:
            if (!player.actionTarget || gameMap.grid[player.actionTarget.y][player.actionTarget.x] !== TILE_TYPE.LOGS) {
                console.log(`[${player.username}] Target logs at (${player.actionTarget?.x}, ${player.actionTarget?.y}) are gone. Moving on.`);
                harvestNextBush(player, gameMap, game); // This function handles what to do next
                return;
            }
            updateFollowPath(player, deltaTime, gameMap);

            const dxLogs = player.pixelX - (player.actionTarget.x + 0.5);
            const dyLogs = player.pixelY - (player.actionTarget.y + 0.5);
            const distSqLogs = dxLogs * dxLogs + dyLogs * dyLogs;
            const interactionDistSqLogs = 1.2 * 1.2;

            if (atMoveTarget || distSqLogs < interactionDistSqLogs) {
                beginHarvestingLogs(player, gameMap, game);
            }
            break;
        case PLAYER_STATE.MOVING_TO_BUSHES:
            if (!player.actionTarget || gameMap.grid[player.actionTarget.y][player.actionTarget.x] !== TILE_TYPE.BUSHES) {
                console.log(`[${player.username}] Target bush at (${player.actionTarget?.x}, ${player.actionTarget?.y}) is gone. Moving on.`);
                harvestNextBush(player, gameMap, game); // This function handles what to do next
                return;
            }
            updateFollowPath(player, deltaTime, gameMap);

            const dxBushes = player.pixelX - (player.actionTarget.x + 0.5);
            const dyBushes = player.pixelY - (player.actionTarget.y + 0.5);
            const distSqBushes = dxBushes * dxBushes + dyBushes * dyBushes;
            const interactionDistSqBushes = 1.2 * 1.2;

            if (atMoveTarget || distSqBushes < interactionDistSqBushes) {
                beginHarvestingBushes(player, gameMap, game);
            }
            break;

        case PLAYER_STATE.WANDERING_TO_GATHER:
            updateWander(player, deltaTime, gameMap);
            const distFromSearch = Math.sqrt(
                (player.pixelX - player.lastSearchPosition.x)**2 +
                (player.pixelY - player.lastSearchPosition.y)**2
            );
            if (distFromSearch > 8) {
                startGatheringCycle(player, gameMap);
            }
            break;

        case PLAYER_STATE.FOLLOWING:
             updateFollow(player, gameMap, allPlayers, deltaTime);
             break;

        case PLAYER_STATE.CHOPPING:
            if (!player.actionTarget || gameMap.grid[player.actionTarget.y][player.actionTarget.x] !== TILE_TYPE.TREE) {
                // The tree is gone! Someone else must have finished it.
                treeHasBeenChopped(player, gameMap, allPlayers);
                return; // Stop further processing for this frame
            }
            // The main logic for timer countdown is now handled centrally in game.js
            // This block now only handles the intermittent chopping sound effect.
            if (Math.floor(player.actionTotalTime - player.actionTimer) % 2 === 0 && Math.floor(player.actionTotalTime - (player.actionTimer - deltaTime)) % 2 !== 0) {
                 const chopSound = AudioManager.getBuffer('./chop.mp3');
                 AudioManager.play(chopSound, player.pixelX, player.pixelY);
            }
            break;

        case PLAYER_STATE.HARVESTING_LOGS:
            player.actionTimer -= deltaTime;
            if (player.actionTimer <= 0) {
                finishHarvestingLogs(player, gameMap, game);
            }
            break;

        case PLAYER_STATE.HARVESTING_BUSHES:
            player.actionTimer -= deltaTime;
            if (player.actionTimer <= 0) {
                finishHarvestingBushes(player, gameMap, game);
            }
            break;
    }
}