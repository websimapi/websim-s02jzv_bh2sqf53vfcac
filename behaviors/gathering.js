import { PLAYER_STATE } from '../player-state.js';
import { TILE_TYPE } from '../map-tile-types.js';
import { findPath } from '../pathfinding.js';
import { startChoppingCycle } from './chopping.js';

export function startGatheringCycle(player, gameMap, searchCenter = null, searchRadius = null) {
    player.state = PLAYER_STATE.SEARCHING_FOR_GATHERABLE;
    console.log(`[${player.username}] Starting gathering cycle, searching for resources.`);

    const gatherableTypes = [TILE_TYPE.LOGS, TILE_TYPE.BUSHES];
    
    let allGatherables;
    if (searchCenter && searchRadius) {
        console.log(`[${player.username}] Performing a localized gather search around (${searchCenter.pixelX.toFixed(1)}, ${searchCenter.pixelY.toFixed(1)}) with radius ${searchRadius}.`);
        allGatherables = gameMap.findAllInRadius(searchCenter.pixelX, searchCenter.pixelY, gatherableTypes, searchRadius);
    } else {
        allGatherables = gameMap.findAll(gatherableTypes);
    }

    if (allGatherables.length === 0) {
        console.log(`[${player.username}] No gatherables found in search area. Wandering...`);
        player.state = PLAYER_STATE.WANDERING_TO_GATHER;
        player.lastSearchPosition = { x: player.pixelX, y: player.pixelY };
        return;
    }

    allGatherables.sort((a, b) => {
        const distA = (a.x - player.pixelX)**2 + (a.y - player.pixelY)**2;
        const distB = (b.x - player.pixelX)**2 + (b.y - player.pixelY)**2;
        return distA - distB;
    });

    const MAX_GATHERABLES_TO_CHECK = 10;
    let pathFound = false;

    for (let i = 0; i < allGatherables.length && i < MAX_GATHERABLES_TO_CHECK; i++) {
        const target = allGatherables[i];

        const startX = Math.round(player.pixelX);
        const startY = Math.round(player.pixelY);
        const endX = target.x;
        const endY = target.y;

        const path = findPath(startX, startY, endX, endY, gameMap);

        if (path) {
            player.actionTarget = target;
            player.path = path;
            if (target.type === TILE_TYPE.LOGS) {
                player.state = PLAYER_STATE.MOVING_TO_LOGS;
            } else if (target.type === TILE_TYPE.BUSHES) {
                player.state = PLAYER_STATE.MOVING_TO_BUSHES;
            }
            console.log(`[${player.username}] Found pathable gatherable at (${target.x}, ${target.y}). Moving to harvest.`);
            pathFound = true;
            break;
        }
    }

    if (!pathFound) {
        console.log(`[${player.username}] No reachable gatherables found. Wandering...`);
        player.state = PLAYER_STATE.WANDERING_TO_GATHER;
        player.lastSearchPosition = { x: player.pixelX, y: player.pixelY };
    }
}

export function beginHarvestingLogs(player, gameMap, game) {
    if (!player.actionTarget || gameMap.grid[player.actionTarget.y][player.actionTarget.x] !== TILE_TYPE.LOGS) {
        console.log(`[${player.username}] Attempted to harvest logs that are already gone. Moving on.`);
        harvestNextBush(player, gameMap);
        return;
    }
    player.state = PLAYER_STATE.HARVESTING_LOGS;
    const duration = game.settings.gathering.harvest_logs_duration_seconds;
    player.actionTimer = duration;
    player.actionTotalTime = duration;
    console.log(`[${player.username}] Began harvesting logs. Timestamp: ${Date.now()}`);
}

export function finishHarvestingLogs(player, gameMap, game) {
    if (!player.actionTarget || gameMap.grid[player.actionTarget.y][player.actionTarget.x] !== TILE_TYPE.LOGS) {
        console.log(`[${player.username}] Finished harvesting, but logs were already gone. Moving on.`);
        harvestNextBush(player, gameMap, game);
        return;
    }
    const min = game.settings.gathering.harvest_logs_min_yield;
    const max = game.settings.gathering.harvest_logs_max_yield;
    const numLogs = Math.floor(Math.random() * (max - min + 1)) + min;
    for (let i = 0; i < numLogs; i++) {
        player.inventory.addLog(Date.now());
    }
    console.log(`[${player.username}] Harvested ${numLogs} logs. Total: ${player.inventory.getLogCount()}. Timestamp: ${Date.now()}`);
    player.addExperience('woodcutting', numLogs * game.settings.woodcutting.harvest_logs_xp_per_log);
    player.addExperience('gathering', game.settings.gathering.harvest_logs_xp);
    gameMap.grid[player.actionTarget.y][player.actionTarget.x] = TILE_TYPE.GRASS;

    // After harvesting logs, always check for bushes before deciding the next major action.
    harvestNextBush(player, gameMap, game);
}

export function harvestNextBush(player, gameMap, game) {
    if(player.pendingHarvest.length > 0) {
        player.actionTarget = player.pendingHarvest.shift();

        const startX = Math.round(player.pixelX);
        const startY = Math.round(player.pixelY);
        const path = findPath(startX, startY, player.actionTarget.x, player.actionTarget.y, gameMap);

        if (path) {
            player.path = path;
            player.state = PLAYER_STATE.MOVING_TO_BUSHES;
        } else {
            console.warn(`[${player.username}] No path found to bush at (${player.actionTarget.x}, ${player.actionTarget.y}). Skipping.`);
            harvestNextBush(player, gameMap, game); // Try next bush
        }
    } else {
        // No more bushes from the tree chop. Now, decide what to do next.
        if (player.activeCommand === 'follow') {
            player.state = PLAYER_STATE.FOLLOWING;
        } else if (player.activeCommand === 'gather' || player.state === PLAYER_STATE.WANDERING_TO_GATHER) {
            startGatheringCycle(player, gameMap);
        } else {
            // Default behavior (e.g., after !chop command is complete) is to find another tree.
            startChoppingCycle(player, gameMap);
        }
    }
}

export function beginHarvestingBushes(player, gameMap, game) {
    if (!player.actionTarget || gameMap.grid[player.actionTarget.y][player.actionTarget.x] !== TILE_TYPE.BUSHES) {
        console.log(`[${player.username}] Attempted to harvest a bush that is already gone. Moving on.`);
        harvestNextBush(player, gameMap, game);
        return;
    }
    player.state = PLAYER_STATE.HARVESTING_BUSHES;
    const duration = game.settings.gathering.harvest_bushes_duration_seconds_base + Math.random();
    player.actionTimer = duration;
    player.actionTotalTime = duration;
    console.log(`[${player.username}] Began harvesting bushes. Timestamp: ${Date.now()}`);
}

export function finishHarvestingBushes(player, gameMap, game) {
    if (!player.actionTarget || gameMap.grid[player.actionTarget.y][player.actionTarget.x] !== TILE_TYPE.BUSHES) {
        console.log(`[${player.username}] Finished harvesting, but the bush was already gone. Moving on.`);
        harvestNextBush(player, gameMap, game);
        return;
    }
    const min = game.settings.gathering.harvest_bushes_min_yield;
    const max = game.settings.gathering.harvest_bushes_max_yield;
    const numLeaves = Math.floor(Math.random() * (max - min + 1)) + min;
    player.inventory.addLeaves(numLeaves, Date.now());
    const totalLeaves = player.inventory.getTotalLeaves();
    console.log(`[${player.username}] Harvested ${numLeaves} leaves. Total: ${totalLeaves}. Timestamp: ${Date.now()}`);
    player.addExperience('gathering', game.settings.gathering.harvest_bushes_xp);
    gameMap.grid[player.actionTarget.y][player.actionTarget.x] = TILE_TYPE.GRASS;

    if (player.activeCommand === 'gather') {
        startGatheringCycle(player, gameMap);
    } else {
        // For both 'follow' and default commands, continue harvesting pending bushes.
        harvestNextBush(player, gameMap, game);
    }
}