import { PLAYER_STATE } from '../player-state.js';
import { TILE_TYPE } from '../map-tile-types.js';
import { AudioManager } from '../audio-manager.js';
import { findPath } from '../pathfinding.js';
import { harvestNextBush } from './gathering.js';

export function findAndMoveToTree(player, gameMap) {
    const allTrees = gameMap.findAll([TILE_TYPE.TREE]);
    if (allTrees.length === 0) {
        console.log(`[${player.username}] No trees found.`);
        player.state = PLAYER_STATE.IDLE;
        return;
    }

    // Sort trees by distance from player
    allTrees.sort((a, b) => {
        const distA = (a.x - player.pixelX)**2 + (a.y - player.pixelY)**2;
        const distB = (b.x - player.pixelX)**2 + (b.y - player.pixelY)**2;
        return distA - distB;
    });

    const MAX_TREES_TO_CHECK = 10;
    let pathFound = false;

    for (let i = 0; i < allTrees.length && i < MAX_TREES_TO_CHECK; i++) {
        const treeCoords = allTrees[i];
        const startX = Math.round(player.pixelX);
        const startY = Math.round(player.pixelY);
        const path = findPath(startX, startY, treeCoords.x, treeCoords.y, gameMap);
        
        if(path) {
           player.actionTarget = treeCoords;
           player.path = path;
           // The final destination is the tree tile itself. The physics engine will stop the player.
           player.targetX = treeCoords.x;
           player.targetY = treeCoords.y;
           player.state = PLAYER_STATE.MOVING_TO_TREE;
           console.log(`[${player.username}] Found pathable tree at (${treeCoords.x}, ${treeCoords.y}). Moving to chop.`);
           pathFound = true;
           break; // Exit the loop since we found a valid tree and path
        }
    }

    if (!pathFound) {
        console.warn(`[${player.username}] Checked ${Math.min(allTrees.length, MAX_TREES_TO_CHECK)} nearest trees, but none are reachable. Wandering to find a new spot.`);
        player.lastSearchPosition = { x: player.pixelX, y: player.pixelY };
        player.state = PLAYER_STATE.SEARCHING_FOR_TREE; // Stay in searching state to wander
    }
}

export function startChoppingCycle(player, gameMap) {
    player.state = PLAYER_STATE.SEARCHING_FOR_TREE;
    console.log(`[${player.username}] Starting chopping cycle, searching for a tree. Timestamp: ${Date.now()}`);
    findAndMoveToTree(player, gameMap);
}

export function beginChopping(player, gameMap, game) {
    // Final check to ensure the tree is still there before starting to chop.
    if (!player.actionTarget || gameMap.grid[player.actionTarget.y][player.actionTarget.x] !== TILE_TYPE.TREE) {
        console.log(`[${player.username}] Attempted to chop a tree that is already gone. Finding a new one.`);
        startChoppingCycle(player, gameMap);
        return;
    }

    const targetId = `${player.actionTarget.x},${player.actionTarget.y}`;
    const CHOP_WORK = game.settings.woodcutting.tree_chop_work;

    if (!game.activeChoppingTargets.has(targetId)) {
        game.activeChoppingTargets.set(targetId, { 
            remainingWork: CHOP_WORK,
            choppers: new Set()
        });
    }

    const chopData = game.activeChoppingTargets.get(targetId);
    chopData.choppers.add(player.id);
    
    player.state = PLAYER_STATE.CHOPPING;
    player.actionTimer = chopData.remainingWork / 1000; // in seconds
    player.actionTotalTime = CHOP_WORK / 1000;
    console.log(`[${player.username}] Began chopping tree at (${player.actionTarget.x}, ${player.actionTarget.y}) with ${player.actionTimer.toFixed(1)}s remaining. Total choppers: ${chopData.choppers.size}`);
}

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
        harvestNextBush(player, gameMap);
    }
}

export function finishChopping(player, gameMap, game, allPlayers) {
    const targetId = `${player.actionTarget.x},${player.actionTarget.y}`;
    game.activeChoppingTargets.delete(targetId);

    if (!player.actionTarget || gameMap.grid[player.actionTarget.y][player.actionTarget.x] !== TILE_TYPE.TREE) {
        console.log(`[${player.username}] Finished chopping, but the tree was already gone. Finding another.`);
        // Don't restart chopping if the command was to follow, let follow logic take over
        if (player.activeCommand !== 'follow') {
            startChoppingCycle(player, gameMap);
        }
        return;
    }

    const chopSound = AudioManager.getBuffer('./tree_fall.mp3');
    AudioManager.play(chopSound, player.actionTarget.x, player.actionTarget.y);

    const treeX = player.actionTarget.x;
    const treeY = player.actionTarget.y;

    gameMap.cutTree(treeX, treeY);
    player.actionTarget = { x: treeX, y: treeY };

    console.log(`[${player.username}] Finished chopping tree. Timestamp: ${Date.now()}`);
    player.addExperience('woodcutting', game.settings.woodcutting.finish_chop_xp);

    player.pendingHarvest = [];
    let spawnedBushes = 0;
    const directions = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
    for (const [dx, dy] of directions) {
        const bushX = treeX + dx;
        const bushY = treeY + dy;
        if (bushX >= 0 && bushX < gameMap.width && bushY >= 0 && bushY < gameMap.height && 
            gameMap.grid[bushY][bushX] === TILE_TYPE.GRASS && Math.random() < 1/8) {
            gameMap.grid[bushY][bushX] = TILE_TYPE.BUSHES;
            player.pendingHarvest.push({ x: bushX, y: bushY, type: TILE_TYPE.BUSHES, sourceTreeX: treeX, sourceTreeY: treeY });
            spawnedBushes++;
        }
    }
    if (spawnedBushes === 0) {
        const validSpots = directions.filter(([dx, dy]) => {
            const bushX = treeX + dx;
            const bushY = treeY + dy;
            return bushX >= 0 && bushX < gameMap.width && bushY >= 0 && bushY < gameMap.height && gameMap.grid[bushY][bushX] === TILE_TYPE.GRASS;
        });
        if (validSpots.length > 0) {
            const [dx, dy] = validSpots[Math.floor(Math.random() * validSpots.length)];
            const bushX = treeX + dx;
            const bushY = treeY + dy;
            gameMap.grid[bushY][bushX] = TILE_TYPE.BUSHES;
            player.pendingHarvest.push({ x: bushX, y: bushY, type: TILE_TYPE.BUSHES, sourceTreeX: treeX, sourceTreeY: treeY });
        }
    }

    if (player.activeCommand === 'follow') {
        // For followers, we must ensure they collect resources before doing anything else.
        // The logic below for moving to logs and bushes will handle this.
        // After all resources are gathered, their state will be set back to FOLLOWING.
    } else {
        // Non-followers will also proceed to gather resources.
        // If no active command, they will look for another tree after gathering.
    }

    player.state = PLAYER_STATE.IDLE; // Reset state before pathfinding
    const startX = Math.round(player.pixelX);
    const startY = Math.round(player.pixelY);
    const path = findPath(startX, startY, player.actionTarget.x, player.actionTarget.y, gameMap);

    if(path) {
        player.path = path;
        player.state = PLAYER_STATE.MOVING_TO_LOGS;
    } else {
        console.warn(`[${player.username}] No path found to logs at (${player.actionTarget.x}, ${player.actionTarget.y}).`);
        // The logs from the tree are unreachable. Harvest pending bushes instead.
        harvestNextBush(player, gameMap);
    }
}