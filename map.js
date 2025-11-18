import { TILE_TYPE } from './map-tile-types.js';

export class Map {
    constructor(tileSize) {
        this.width = 256;
        this.height = 256;
        this.tileSize = tileSize;
        this.grassTile = null;
        this.treeTile = null;
        this.logsTile = null;
        this.bushesTile = null;
        this.grid = [];
        this.treeRespawns = [];
        this.viewportWidth = 0;
        this.viewportHeight = 0;
    }

    setViewport(width, height) {
        this.viewportWidth = width;
        this.viewportHeight = height;
    }

    setTileSize(size) {
        this.tileSize = size;
    }

    async loadAssets() {
        const loadTile = (src) => new Promise((resolve) => {
            const img = new Image();
            img.src = src;
            img.onload = () => resolve(img);
        });

        await Promise.all([
            loadTile('./grass_tile.png').then(img => this.grassTile = img),
            loadTile('./tree.png').then(img => this.treeTile = img),
            loadTile('./logs.png').then(img => this.logsTile = img),
            loadTile('./bushes.png').then(img => this.bushesTile = img)
        ]);
        
        // Generation is now handled after loading data.
    }
    
    generateMap() {
        console.log(`Generating map of size ${this.width}x${this.height}.`);
        this.grid = [];
        const TREE_CHANCE = 1 / 16;
        
        for (let j = 0; j < this.height; j++) {
            this.grid[j] = [];
            for (let i = 0; i < this.width; i++) {
                // 1/16 chance to spawn a tree (1)
                this.grid[j][i] = (Math.random() < TREE_CHANCE) ? TILE_TYPE.TREE : TILE_TYPE.GRASS;
            }
        }
    }

    cutTree(x, y) {
        this.grid[y][x] = TILE_TYPE.LOGS;
        this.scheduleTreeRespawn(x, y);
    }

    scheduleTreeRespawn(originalX, originalY, isRetry = false) {
        const MIN_RESPAWN_MS = 5 * 60 * 1000; // 5 minutes
        const MAX_RESPAWN_MS = 60 * 60 * 1000; // 1 hour
        const respawnTime = Date.now() + MIN_RESPAWN_MS + Math.random() * (MAX_RESPAWN_MS - MIN_RESPAWN_MS);

        this.treeRespawns.push({ originalX, originalY, respawnTime });
        if (!isRetry) {
             console.log(`Tree at (${originalX}, ${originalY}) will respawn around ${new Date(respawnTime).toLocaleTimeString()}`);
        } else {
             console.log(`Tree respawn for (${originalX}, ${originalY}) failed, retrying around ${new Date(respawnTime).toLocaleTimeString()}`);
        }
    }

    update(players) {
        const now = Date.now();
        const respawnsToProcess = this.treeRespawns.filter(r => now >= r.respawnTime);

        if (respawnsToProcess.length > 0) {
            this.treeRespawns = this.treeRespawns.filter(r => now < r.respawnTime);

            for (const respawn of respawnsToProcess) {
                let spawned = false;
                const RADIUS = 8;
                const ATTEMPTS = 20;

                for (let i = 0; i < ATTEMPTS; i++) {
                    const angle = Math.random() * 2 * Math.PI;
                    const distance = Math.random() * RADIUS;
                    const newX = Math.round(respawn.originalX + Math.cos(angle) * distance);
                    const newY = Math.round(respawn.originalY + Math.sin(angle) * distance);

                    if (newX < 0 || newX >= this.width || newY < 0 || newY >= this.height) {
                        continue;
                    }

                    const isOccupiedByTree = this.grid[newY][newX] === TILE_TYPE.TREE;
                    const isOccupiedByPlayer = Array.from(players.values()).some(p => Math.round(p.pixelX) === newX && Math.round(p.pixelY) === newY);

                    if (!isOccupiedByTree && !isOccupiedByPlayer) {
                        this.grid[newY][newX] = TILE_TYPE.TREE;
                        console.log(`Tree respawned at (${newX}, ${newY}) from original location (${respawn.originalX}, ${respawn.originalY})`);
                        spawned = true;
                        break;
                    }
                }

                if (!spawned) {
                    this.scheduleTreeRespawn(respawn.originalX, respawn.originalY, true);
                }
            }
        }
    }
    
    isColliding(gridX, gridY) {
        // Check map bounds
        if (gridX < 0 || gridX >= this.width || gridY < 0 || gridY >= this.height) {
            return true; 
        }
        
        // 1 means Tree/Obstacle. For pathfinding, the whole tile is an obstacle.
        return this.grid[gridY][gridX] === TILE_TYPE.TREE;
    }

    isPixelColliding(pixelX, pixelY) {
        // This function is obsolete and will be replaced by the new physics engine.
        // Keeping it for now to avoid breaking other parts, but it should not be used for movement.
        const gridX = Math.floor(pixelX);
        const gridY = Math.floor(pixelY);
        const tileYOffset = pixelY - gridY;
    
        if (gridX < 0 || gridX >= this.width || gridY < 0 || gridY >= this.height) {
            return true;
        }
    
        const tileType = this.grid[gridY][gridX];
    
        if (tileType === TILE_TYPE.TREE) {
            // Legacy collision: bottom 40%
            return tileYOffset > 0.6;
        }
    
        return false;
    }

    findAll(tileTypes) {
        if (!Array.isArray(tileTypes)) tileTypes = [tileTypes];
        const locations = [];
        for (let j = 0; j < this.height; j++) {
            for (let i = 0; i < this.width; i++) {
                const tileType = this.grid[j][i];
                if (tileTypes.includes(tileType)) {
                    locations.push({ x: i, y: j, type: tileType });
                }
            }
        }
        return locations;
    }

    findAllInRadius(x, y, tileTypes, radius) {
        if (!Array.isArray(tileTypes)) tileTypes = [tileTypes];
        const locations = [];

        const startX = Math.max(0, Math.floor(x - radius));
        const endX = Math.min(this.width - 1, Math.ceil(x + radius));
        const startY = Math.max(0, Math.floor(y - radius));
        const endY = Math.min(this.height - 1, Math.ceil(y + radius));
        const radiusSq = radius * radius;

        for (let j = startY; j <= endY; j++) {
            for (let i = startX; i <= endX; i++) {
                const tileType = this.grid[j][i];
                if (tileTypes.includes(tileType)) {
                    const dx = i - x;
                    const dy = j - y;
                    if (dx * dx + dy * dy <= radiusSq) {
                        locations.push({ x: i, y: j, type: tileType });
                    }
                }
            }
        }
        return locations;
    }

    findNearest(x, y, tileType) {
        let nearest = null;
        let minDistance = Infinity;

        for (let j = 0; j < this.height; j++) {
            for (let i = 0; i < this.width; i++) {
                if (this.grid[j][i] === tileType) {
                    const dx = i - x;
                    const dy = j - y;
                    const distance = dx * dx + dy * dy; // Use squared distance for efficiency
                    if (distance < minDistance) {
                        minDistance = distance;
                        nearest = { x: i, y: j };
                    }
                }
            }
        }
        return nearest;
    }

    findNearestInRadius(x, y, tileTypes, radius) {
        let nearest = null;
        let minDistance = Infinity;

        const startX = Math.max(0, Math.floor(x - radius));
        const endX = Math.min(this.width - 1, Math.ceil(x + radius));
        const startY = Math.max(0, Math.floor(y - radius));
        const endY = Math.min(this.height - 1, Math.ceil(y + radius));

        for (let j = startY; j <= endY; j++) {
            for (let i = startX; i <= endX; i++) {
                const tileType = this.grid[j][i];
                if (tileTypes.includes(tileType)) {
                    const dx = i - x;
                    const dy = j - y;
                    const distance = dx * dx + dy * dy;
                    if (distance < minDistance) {
                        minDistance = distance;
                        nearest = { x: i, y: j, type: tileType };
                    }
                }
            }
        }
        return nearest;
    }

    getTallObjects(drawStartX, drawEndX, drawStartY, drawEndY) {
        const tallObjects = [];
        for (let j = drawStartY; j < drawEndY; j++) {
            for (let i = drawStartX; i < drawEndX; i++) {
                if (j < 0 || j >= this.height || i < 0 || i >= this.width) continue;
                const tileType = this.grid[j] ? this.grid[j][i] : TILE_TYPE.GRASS;
                if (tileType === TILE_TYPE.TREE) {
                    tallObjects.push({
                        type: 'tree',
                        x: i,
                        y: j,
                        image: this.treeTile,
                    });
                }
            }
        }
        return tallObjects;
    }

    renderBase(ctx, cameraX, cameraY, drawStartX, drawEndX, drawStartY, drawEndY) {
        if (!this.grassTile || !this.grassTile.complete) return;

        ctx.save();
        
        const ts = this.tileSize;

        // Apply translation to keep drawing coordinates as integers, preventing seams.
        ctx.translate(Math.round(-cameraX), Math.round(-cameraY));

        // Iterate and draw ground-level tiles
        for (let j = drawStartY; j < drawEndY; j++) {
            for (let i = drawStartX; i < drawEndX; i++) {
                if (j < 0 || j >= this.height || i < 0 || i >= this.width) continue;
                // Draw base grass tile
                ctx.drawImage(this.grassTile, i * ts, j * ts, ts, ts);

                // Draw ground objects
                const tileType = this.grid[j] ? this.grid[j][i] : TILE_TYPE.GRASS;
                let objectImage = null;

                switch (tileType) {
                    case TILE_TYPE.LOGS: objectImage = this.logsTile; break;
                    case TILE_TYPE.BUSHES: objectImage = this.bushesTile; break;
                }

                if (objectImage && objectImage.complete) {
                    ctx.drawImage(objectImage, i * ts, j * ts, ts, ts);
                }
            }
        }
        
        // Draw grid lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'; // Subtle grid lines
        ctx.lineWidth = 1;

        // Draw visible vertical lines
        for (let i = drawStartX; i <= drawEndX; i++) {
            if (i > this.width) continue; 
            const x = i * ts;
            ctx.beginPath();
            ctx.moveTo(x, drawStartY * ts);
            ctx.lineTo(x, drawEndY * ts);
            ctx.stroke();
        }

        // Draw visible horizontal lines
        for (let j = drawStartY; j <= drawEndY; j++) {
            if (j > this.height) continue;
            const y = j * ts;
            ctx.beginPath();
            ctx.moveTo(drawStartX * ts, y);
            ctx.lineTo(drawEndX * ts, y);
            ctx.stroke();
        }

        ctx.restore();
    }

    render(ctx, cameraX, cameraY) {
        if (!this.grassTile || !this.grassTile.complete) return;

        ctx.save();
        
        // Calculate the drawing offset based on camera position
        // This translation effectively shifts the world according to the camera view
        ctx.translate(-cameraX, -cameraY);

        const ts = this.tileSize;
        
        // Calculate visible tile range in grid coordinates
        // cameraX/Y can be negative if the map is centered and smaller than viewport
        const startTileX = Math.floor(cameraX / ts);
        const endTileX = Math.ceil((cameraX + this.viewportWidth) / ts);
        const startTileY = Math.floor(cameraY / ts);
        const endTileY = Math.ceil((cameraY + this.viewportHeight) / ts);

        // Clamp tile indices to map boundaries (0 to width/height)
        const drawStartX = Math.max(0, startTileX);
        const drawEndX = Math.min(this.width, endTileX);
        const drawStartY = Math.max(0, startTileY);
        const drawEndY = Math.min(this.height, endTileY);

        // Iterate and draw grass tiles only for visible grid spots
        for (let i = drawStartX; i < drawEndX; i++) {
            for (let j = drawStartY; j < drawEndY; j++) {
                ctx.drawImage(
                    this.grassTile,
                    i * ts,
                    j * ts,
                    ts,
                    ts
                );
                
                // Check and draw obstacle/object
                const tileType = this.grid[j] ? this.grid[j][i] : TILE_TYPE.GRASS;
                let objectImage = null;

                switch(tileType) {
                    case TILE_TYPE.TREE: objectImage = this.treeTile; break;
                    case TILE_TYPE.LOGS: objectImage = this.logsTile; break;
                    case TILE_TYPE.BUSHES: objectImage = this.bushesTile; break;
                }
                
                if (objectImage && objectImage.complete) {
                     ctx.drawImage(
                        objectImage,
                        i * ts,
                        j * ts,
                        ts,
                        ts
                    );
                }
            }
        }

        // Draw grid lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'; // Subtle grid lines
        ctx.lineWidth = 1;

        // Draw visible vertical lines
        for (let i = drawStartX; i <= drawEndX; i++) {
            if (i > this.width) continue; 
            const x = i * ts;
            ctx.beginPath();
            ctx.moveTo(x, drawStartY * ts);
            ctx.lineTo(x, drawEndY * ts);
            ctx.stroke();
        }

        // Draw visible horizontal lines
        for (let j = drawStartY; j <= drawEndY; j++) {
            if (j > this.height) continue;
            const y = j * ts;
            ctx.beginPath();
            ctx.moveTo(drawStartX * ts, y);
            ctx.lineTo(drawEndX * ts, y);
            ctx.stroke();
        }
        
        ctx.restore();
    }
}