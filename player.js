import { PLAYER_STATE } from './player-state.js';
import { updateAction } from './behaviors/player-behavior-updater.js';
import { startChoppingCycle } from './behaviors/chopping.js';
import { startGatheringCycle } from './behaviors/gathering.js';
import { renderPlayer } from './player-renderer.js';
import { TILE_TYPE } from './map-tile-types.js';
import { findPath } from './pathfinding.js';
import { beginChopping, beginHarvestingBushes, beginHarvestingLogs } from './behaviors/index.js';
import { PlayerEnergy } from './player-energy.js';
import { PlayerInventory } from './player-inventory.js';
import { PlayerSkills } from './player-skills.js';
import { applySeparation } from './player-movement.js';

export const ENERGY_DURATION_MS = 3600 * 1000; // This will now be controlled by settings

function findNearestEmptySpot(gridX, gridY, gameMap) {
    // This entire function is part of the problematic "stuck" system and is being removed.
    // A robust collision system makes this obsolete.
    if (!gameMap.isColliding(gridX, gridY)) {
        return { x: gridX, y: gridY };
    }

    let radius = 1;
    // Limit search radius to prevent infinite loops on a completely full map
    while (radius < Math.max(gameMap.width, gameMap.height) / 2) { 
        for (let i = -radius; i <= radius; i++) {
            for (let j = -radius; j <= radius; j++) {
                // Only check the perimeter of the search square
                if (Math.abs(i) !== radius && Math.abs(j) !== radius) {
                    continue;
                }

                const newX = gridX + i;
                const newY = gridY + j;

                if (newX >= 0 && newX < gameMap.width && newY >= 0 && newY < gameMap.height) {
                    if (!gameMap.isColliding(newX, newY)) {
                        return { x: newX, y: newY };
                    }
                }
            }
        }
        radius++;
    }

    console.error(`Could not find any empty spot near (${gridX}, ${gridY})`);
    return { x: 0, y: 0 }; // Fallback to origin
}

export class Player {
    constructor(id, username, color, gameSettings) {
        this.id = id;
        this.username = username;
        this.color = color;
        this.gameSettings = gameSettings;
        this.energy = new PlayerEnergy(this, this.gameSettings);

        // Position in grid coordinates
        this.x = 0;
        this.y = 0;

        // For smooth movement
        this.pixelX = 0;
        this.pixelY = 0;
        this.targetX = 0;
        this.targetY = 0;
        this.path = []; // Path for A* movement
        this.prevPixelX = 0; // For stuck detection
        this.prevPixelY = 0; // For stuck detection

        // For collision avoidance
        const angle = Math.random() * 2 * Math.PI;
        const radius = Math.random() * 0.25; // Random radius up to 25% of a tile
        this.offsetX = Math.cos(angle) * radius;
        this.offsetY = Math.sin(angle) * radius;
        
        this.isPositioned = false; // Flag to track initialization

        this.speed = 1; // tiles per second
        this.moveCooldown = 2 + Math.random() * 5; // time to wait before picking new target
        
        // Chopping state
        this.state = PLAYER_STATE.IDLE;
        this.actionTarget = null; // {x, y} of the tree, logs, etc.
        this.actionTimer = 0;
        this.actionTotalTime = 0;
        this.inventory = new PlayerInventory();
        this.pendingHarvest = []; // {x, y, type} for bushes
        this.activeCommand = null;
        this.followTargetId = null;
        this.lastSearchPosition = null; // For gathering wander logic
        this.skills = new PlayerSkills(this);
    }

    addExperience(skill, amount) {
        this.skills.addExperience(skill, amount);
    }

    setInitialPosition(gameMap) {
        if (this.isPositioned) return;
        
        const mapWidth = gameMap.width;
        const mapHeight = gameMap.height;

        let attempts = 0;
        let foundSpot = false;
        let newX, newY;

        while (attempts < 100 && !foundSpot) {
            newX = Math.floor(Math.random() * mapWidth);
            newY = Math.floor(Math.random() * mapHeight);
            
            if (!gameMap.isColliding(newX, newY)) {
                foundSpot = true;
                this.x = newX;
                this.y = newY;
                this.pixelX = newX;
                this.pixelY = newY;
                this.targetX = newX;
                this.targetY = newY;
                this.isPositioned = true;
                break;
            }
            attempts++;
        }
        
        if (!foundSpot) {
            console.warn(`Could not find a safe initial spawn point for ${this.username}. Placing at (0, 0).`);
            // Fallback: If map is full of trees, still mark as positioned
            this.isPositioned = true;
        }
    }

    addEnergy(amount = 1) {
        this.energy.add(amount);
    }

    isPowered() {
        return this.energy.isPowered();
    }

    getState() {
        return {
            id: this.id,
            username: this.username,
            color: this.color,
            energyTimestamps: this.energy.getState(),
            pixelX: this.pixelX,
            pixelY: this.pixelY,
            path: this.path,
            inventory: this.inventory.getState(),
            state: this.state,
            actionTarget: this.actionTarget, // Save the action target
            actionTimer: this.actionTimer,
            actionTotalTime: this.actionTotalTime,
            pendingHarvest: this.pendingHarvest,
            activeCommand: this.activeCommand,
            followTargetId: this.followTargetId,
            lastSearchPosition: this.lastSearchPosition,
            skills: this.skills.getState(),
            offsetX: this.offsetX,
            offsetY: this.offsetY,
        };
    }

    loadState(state) {
        if (state.pixelX !== undefined && state.pixelY !== undefined) {
            this.pixelX = state.pixelX;
            this.pixelY = state.pixelY;
            // Set target position to the loaded smooth position so movement continues from there
            this.targetX = state.pixelX;
            this.targetY = state.pixelY;
            
            this.x = Math.round(state.pixelX);
            this.y = Math.round(state.pixelY);
            this.isPositioned = true; // Loaded state implies positioned
        }
        
        this.path = state.path || [];

        // Load visual offset
        if (state.offsetX !== undefined && state.offsetY !== undefined) {
            this.offsetX = state.offsetX;
            this.offsetY = state.offsetY;
        } else {
            // Generate for older save files
            const angle = Math.random() * 2 * Math.PI;
            const radius = Math.random() * 0.25;
            this.offsetX = Math.cos(angle) * radius;
            this.offsetY = Math.sin(angle) * radius;
        }

        // Load energyTimestamps
        if (state.energyTimestamps && Array.isArray(state.energyTimestamps)) {
            this.energy.loadState(state.energyTimestamps);
        } else if (state.energy !== undefined && state.energy > 0) {
            // Handle conversion from legacy 'energy' count to timestamps.
            const timestamps = [];
            for (let i = 0; i < state.energy; i++) {
                // Assume legacy energy starts draining immediately upon load
                timestamps.push(Date.now());
            }
            this.energy.loadState(timestamps);
        }
        
        this.username = state.username || this.username;
        this.color = state.color || this.color;
        if(state.inventory) this.inventory.loadState(state.inventory);
        this.pendingHarvest = state.pendingHarvest || [];
        if(state.skills) this.skills.loadState(state.skills);
        this.activeCommand = state.activeCommand || null;
        this.followTargetId = state.followTargetId || null;
        this.lastSearchPosition = state.lastSearchPosition || null;

        this.actionTarget = state.actionTarget || null; // Restore the action target
        this.state = state.state || PLAYER_STATE.IDLE;
        this.actionTimer = state.actionTimer || 0;
        this.actionTotalTime = state.actionTotalTime || 0;
        
        // If restoring a chopping state, ensure the action target is valid.
        if (this.state === PLAYER_STATE.CHOPPING && !this.actionTarget) {
            console.warn(`[${this.username}] Restored to CHOPPING state without a valid actionTarget. Resetting to IDLE.`);
            this.state = PLAYER_STATE.IDLE;
        }

        if (this.state === PLAYER_STATE.FOLLOWING && !this.followTargetId) {
            console.warn(`[${this.username}] Restored to FOLLOWING state without a valid followTargetId. Resetting to IDLE.`);
            this.state = PLAYER_STATE.IDLE;
        }
    }

    // New method to validate state after map is loaded
    validateState(gameMap, game) {
        // Validate player position first
        const currentGridX = Math.round(this.pixelX);
        const currentGridY = Math.round(this.pixelY);

        if (
            currentGridX < 0 || currentGridX >= gameMap.width ||
            currentGridY < 0 || currentGridY >= gameMap.height ||
            gameMap.isColliding(currentGridX, currentGridY)
        ) {
            console.warn(`[${this.username}] Invalid or occupied position on load (${this.pixelX.toFixed(2)}, ${this.pixelY.toFixed(2)}). Finding nearest empty spot.`);
            
            // The "stuck" logic is being removed. If a player loads inside an object,
            // the new separation and collision logic should push them out gently.
            // We will just log it for now. A better solution might be needed if this happens often.
            this.state = PLAYER_STATE.IDLE;
            this.actionTarget = null;
            this.path = [];
            return; // Exit validation early as state has been reset
        }

        const stateToTileType = {
            [PLAYER_STATE.MOVING_TO_TREE]: TILE_TYPE.TREE,
            [PLAYER_STATE.CHOPPING]: TILE_TYPE.TREE,
            [PLAYER_STATE.MOVING_TO_LOGS]: TILE_TYPE.LOGS,
            [PLAYER_STATE.HARVESTING_LOGS]: TILE_TYPE.LOGS,
            [PLAYER_STATE.MOVING_TO_BUSHES]: TILE_TYPE.BUSHES,
            [PLAYER_STATE.HARVESTING_BUSHES]: TILE_TYPE.BUSHES,
        };

        const requiredTileType = stateToTileType[this.state];
        
        if (requiredTileType !== undefined) {
            const target = this.actionTarget;
            const isTargetInvalid = !target || 
                                    target.y === undefined || target.x === undefined || // Check for valid object
                                    !gameMap.grid[target.y] || 
                                    gameMap.grid[target.y][target.x] !== requiredTileType;

            if (isTargetInvalid) {
                console.warn(`[${this.username}] Invalid target for state ${this.state}. Target tile at (${target?.x}, ${target?.y}) is missing or incorrect. Resetting to IDLE.`);
                this.state = PLAYER_STATE.IDLE;
                this.actionTarget = null;
                this.path = []; // Clear the path as well
            } else {
                if (this.state === PLAYER_STATE.CHOPPING) {
                    console.log(`[${this.username}] Re-initializing chopping state on load.`);
                    beginChopping(this, gameMap, game);
                } else if (this.state === PLAYER_STATE.HARVESTING_LOGS) {
                    console.log(`[${this.username}] Re-initializing harvesting logs state on load.`);
                    beginHarvestingLogs(this, gameMap, game);
                } else if (this.state === PLAYER_STATE.HARVESTING_BUSHES) {
                    console.log(`[${this.username}] Re-initializing harvesting bushes state on load.`);
                    beginHarvestingBushes(this, gameMap, game);
                }

                // Re-calculate paths for movement states
                if (this.state.startsWith('moving_to')) {
                    console.log(`[${this.username}] Re-calculating path for state ${this.state}.`);
                    const startX = Math.round(this.pixelX);
                    const startY = Math.round(this.pixelY);
                    const path = findPath(startX, startY, this.actionTarget.x, this.actionTarget.y, gameMap);
                    if (path) {
                        this.path = path;
                    } else {
                        console.warn(`[${this.username}] Path to valid target for ${this.state} is blocked. Resetting.`);
                        this.state = PLAYER_STATE.IDLE;
                        this.actionTarget = null;
                        this.path = [];
                    }
                }
            }
        }
    }

    update(deltaTime, gameMap, allPlayers, game) {
        // Apply separation from other players to prevent overlap
        applySeparation(this, allPlayers, gameMap);
        
        if (this.isPowered()) {
            const hadPower = this.energy.update(deltaTime);
            
            // If energy just ran out
            if (!hadPower) {
                this.state = PLAYER_STATE.IDLE; // Stop chopping if power runs out
                return; 
            }

            // If player is idle but has an active command, restart the task.
            if (this.state === PLAYER_STATE.IDLE && this.activeCommand) {
                if (this.activeCommand === 'chop') {
                    startChoppingCycle(this, gameMap);
                } else if (this.activeCommand === 'gather') {
                    startGatheringCycle(this, gameMap);
                } else if (this.activeCommand === 'follow') {
                    this.state = PLAYER_STATE.FOLLOWING;
                }
            }

            // State Machine for actions
            updateAction(this, deltaTime, gameMap, allPlayers, game);

        }
    }

    startChoppingCycle(gameMap) {
        startChoppingCycle(this, gameMap);
    }

    startGatheringCycle(gameMap) {
        startGatheringCycle(this, gameMap);
    }

    render(ctx, tileSize, cameraX, cameraY) {
        renderPlayer(ctx, this, tileSize, cameraX, cameraY);
    }
}