import { PLAYER_STATE } from '../player-state.js';
import { AudioManager } from '../audio-manager.js';
import { getPlayerHitbox, getTreeTrunkHitbox } from '../game/physics.js';
import { TILE_TYPE } from '../map-tile-types.js';

function getVisibleTileRange(camera, canvas, map) {
    const ts = map.tileSize;
    const startTileX = Math.floor(camera.x / ts);
    const endTileX = Math.ceil((camera.x + canvas.width) / ts);
    const startTileY = Math.floor(camera.y / ts);
    const endTileY = Math.ceil((camera.y + canvas.height) / ts);

    const drawStartX = Math.max(0, startTileX);
    const drawEndX = Math.min(map.width, endTileX);
    const drawStartY = Math.max(0, startTileY);
    const drawEndY = Math.min(map.height, endTileY);

    return { drawStartX, drawEndX, drawStartY, drawEndY };
}

function renderTargetHighlights(ctx, players, camera, tileSize, settings) {
    if (!(settings.visuals && settings.visuals.show_target_indicator)) return;

    ctx.save();
    ctx.lineWidth = 2;
    ctx.shadowBlur = 8;
    
    const alpha = (Math.sin(performance.now() / 250) + 1) / 2 * 0.6 + 0.4; // Pulsates between 0.4 and 1.0
    
    const woodcuttingStates = [PLAYER_STATE.MOVING_TO_TREE, PLAYER_STATE.CHOPPING];
    const gatheringStates = [
        PLAYER_STATE.MOVING_TO_LOGS,
        PLAYER_STATE.HARVESTING_LOGS,
        PLAYER_STATE.MOVING_TO_BUSHES,
        PLAYER_STATE.HARVESTING_BUSHES
    ];

    for (const player of players.values()) {
        let indicatorColor = null;

        if (woodcuttingStates.includes(player.state)) {
            ctx.shadowColor = 'rgba(255, 255, 100, 0.8)';
            indicatorColor = `rgba(255, 255, 100, ${alpha})`;
        } else if (gatheringStates.includes(player.state)) {
            ctx.shadowColor = 'rgba(100, 220, 255, 0.8)';
            indicatorColor = `rgba(100, 220, 255, ${alpha})`;
        }
        
        if (indicatorColor && player.actionTarget) {
            const targetX = player.actionTarget.x;
            const targetY = player.actionTarget.y;

            const screenX = Math.round(targetX * tileSize - camera.x);
            const screenY = Math.round(targetY * tileSize - camera.y);
            
            // Check if the tile is on screen before drawing
            if (screenX + tileSize > 0 && screenX < ctx.canvas.width &&
                screenY + tileSize > 0 && screenY < ctx.canvas.height) {

                ctx.strokeStyle = indicatorColor;
                ctx.strokeRect(screenX + 1, screenY + 1, tileSize - 2, tileSize - 2);
            }
        }
    }
    ctx.restore();
}

function renderYSorted(ctx, players, map, drawStartX, drawEndX, drawStartY, drawEndY, tileSize, camera) {
    const renderList = [];

    // 1. Add players to render list
    for (const player of players.values()) {
        if (player.isPowered()) {
            renderList.push({
                type: 'player',
                y: player.pixelY,
                entity: player,
            });
        }
    }
    
    // 2. Add tall map objects (trees) to render list
    const tallObjects = map.getTallObjects(drawStartX, drawEndX, drawStartY, drawEndY);
    for (const obj of tallObjects) {
        renderList.push({
            type: obj.type,
            y: obj.y + 0.5, // Sort key for trees to be mid-tile
            entity: obj,
        });
    }
    
    // 3. Sort the list by y-coordinate
    renderList.sort((a, b) => a.y - b.y);

    // 4. Render from the sorted list
    for (const item of renderList) {
        if (item.type === 'player') {
            item.entity.render(ctx, tileSize, camera.x, camera.y);
        } else if (item.type === 'tree') {
            const { x, y, image } = item.entity;
             if (image && image.complete) {
                ctx.drawImage(
                    image,
                    Math.round(x * tileSize - camera.x),
                    Math.round(y * tileSize - camera.y),
                    tileSize,
                    tileSize
                );
            }
        }
    }
}

function renderHitboxes(ctx, players, map, camera, settings) {
    if (!settings.visuals || !settings.visuals.show_hitboxes) return;

    ctx.save();
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)'; // Red outlines
    ctx.lineWidth = 1;

    const tileSize = map.tileSize;

    // Draw player hitboxes
    for (const player of players.values()) {
        if (!player.isPowered()) continue;

        const hitbox = getPlayerHitbox(player);
        const screenX = hitbox.x * tileSize - camera.x;
        const screenY = hitbox.y * tileSize - camera.y;
        const screenRadius = hitbox.radius * tileSize;

        ctx.beginPath();
        ctx.arc(screenX, screenY, screenRadius, 0, Math.PI * 2);
        ctx.stroke();
    }

    // Draw tree trunk hitboxes for visible trees
    const { drawStartX, drawEndX, drawStartY, drawEndY } = getVisibleTileRange(camera, ctx.canvas, map);
    for (let j = drawStartY; j < drawEndY; j++) {
        for (let i = drawStartX; i < drawEndX; i++) {
            if (map.grid[j] && map.grid[j][i] === TILE_TYPE.TREE) {
                const hitbox = getTreeTrunkHitbox(i, j);
                const screenX = hitbox.x * tileSize - camera.x;
                const screenY = hitbox.y * tileSize - camera.y;
                const screenWidth = hitbox.width * tileSize;
                const screenHeight = hitbox.height * tileSize;
                
                ctx.strokeRect(screenX, screenY, screenWidth, screenHeight);
            }
        }
    }

    ctx.restore();
}

function renderPathingLines(ctx, players, camera, map, settings) {
    if (!settings.visuals || !settings.visuals.show_pathing_lines) return;

    ctx.save();
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]); // Dashed lines for paths

    const tileSize = map.tileSize;
    
    const isMovingState = (state) => {
        return state.startsWith('moving_to') || state === PLAYER_STATE.FOLLOWING;
    };

    for (const player of players.values()) {
        if (!player.isPowered() || !player.path || player.path.length === 0 || !isMovingState(player.state)) continue;

        const pathColor = player.color || '#FFFFFF';
        ctx.strokeStyle = pathColor;
        ctx.globalAlpha = 0.8;

        ctx.beginPath();

        // Line from player's current center to the first waypoint
        const playerScreenX = ((player.pixelX + player.offsetX) * tileSize) - camera.x;
        const playerScreenY = ((player.pixelY + player.offsetY) * tileSize) - camera.y;
        ctx.moveTo(playerScreenX, playerScreenY);

        // Lines connecting waypoints
        for (const waypoint of player.path) {
            // Target the center of the tile
            const waypointScreenX = (waypoint.x + 0.5) * tileSize - camera.x;
            const waypointScreenY = (waypoint.y + 0.5) * tileSize - camera.y;
            ctx.lineTo(waypointScreenX, waypointScreenY);
        }

        ctx.stroke();
    }

    ctx.restore();
}

export function renderGame(game) {
    const { ctx, canvas, camera, map, players, settings } = game;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const tileSize = map.tileSize;
    
    // Update AudioManager with the listener's position (center of the screen in world coordinates)
    const listenerX = camera.x + canvas.width / 2;
    const listenerY = camera.y + canvas.height / 2;
    AudioManager.setListenerPosition(listenerX, listenerY, tileSize);
    
    const { drawStartX, drawEndX, drawStartY, drawEndY } = getVisibleTileRange(camera, canvas, map);
    map.renderBase(ctx, camera.x, camera.y, drawStartX, drawEndX, drawStartY, drawEndY);

    renderTargetHighlights(ctx, players, camera, tileSize, settings);

    renderYSorted(ctx, players, map, drawStartX, drawEndX, drawStartY, drawEndY, tileSize, camera);

    renderHitboxes(ctx, players, map, camera, settings);
    renderPathingLines(ctx, players, camera, map, settings);
}