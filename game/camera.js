export class Camera {
    constructor(canvas, map, players) {
        this.canvas = canvas;
        this.map = map;
        this.players = players;

        this.x = 0;
        this.y = 0;

        this.focusedPlayerId = null;
        this.focusTimer = 0;
        this.FOCUS_DURATION = 60; // seconds
    }

    setFocus(playerId) {
        this.focusedPlayerId = playerId;
        this.focusTimer = this.FOCUS_DURATION;
        const player = this.players.get(playerId);
        if (player) {
            console.log(`Camera focusing on: ${player.username} for ${this.FOCUS_DURATION} seconds.`);
        }
    }

    update(deltaTime) {
        this.focusTimer -= deltaTime;
        if (this.focusTimer <= 0) {
            this.chooseNewFocus();
            this.focusTimer = this.FOCUS_DURATION;
        }

        const focusedPlayer = this.focusedPlayerId ? this.players.get(this.focusedPlayerId) : null;
        const tileSize = this.map.tileSize;
        const mapPixelWidth = this.map.width * tileSize;
        const mapPixelHeight = this.map.height * tileSize;

        if (focusedPlayer) {
            const playerCenterX = focusedPlayer.pixelX * tileSize + tileSize / 2;
            const playerCenterY = focusedPlayer.pixelY * tileSize + tileSize / 2;

            this.x = playerCenterX - this.canvas.width / 2;
            this.y = playerCenterY - this.canvas.height / 2;

            if (mapPixelWidth > this.canvas.width) {
                const maxCameraX = mapPixelWidth - this.canvas.width;
                this.x = Math.max(0, Math.min(this.x, maxCameraX));
            } else {
                this.x = -(this.canvas.width - mapPixelWidth) / 2;
            }

            if (mapPixelHeight > this.canvas.height) {
                const maxCameraY = mapPixelHeight - this.canvas.height;
                this.y = Math.max(0, Math.min(this.y, maxCameraY));
            } else {
                this.y = -(this.canvas.height - mapPixelHeight) / 2;
            }

        } else {
            if (this.canvas.width > mapPixelWidth) {
                 this.x = -(this.canvas.width - mapPixelWidth) / 2;
            }
            if (this.canvas.height > mapPixelHeight) {
                this.y = -(this.canvas.height - mapPixelHeight) / 2;
            }
        }
    }

    chooseNewFocus() {
        const activePlayers = Array.from(this.players.values()).filter(p => p.isPowered());

        if (activePlayers.length === 0) {
            this.focusedPlayerId = null;
            this.focusTimer = this.FOCUS_DURATION;
            console.log("No active players to focus on.");
            return;
        }

        const randomIndex = Math.floor(Math.random() * activePlayers.length);
        const player = activePlayers[randomIndex];

        this.focusedPlayerId = player.id;
        console.log(`Camera focusing on: ${player.username} for ${this.FOCUS_DURATION} seconds.`);
    }

    switchToNextPlayerFocus() {
        const activePlayers = Array.from(this.players.values()).filter(p => p.isPowered());

        if (activePlayers.length < 2) {
            console.log("Not enough active players to switch focus.");
            return;
        }

        activePlayers.sort((a, b) => a.username.localeCompare(b.username));

        let currentIndex = -1;
        if (this.focusedPlayerId) {
            currentIndex = activePlayers.findIndex(p => p.id === this.focusedPlayerId);
        }

        const nextIndex = (currentIndex + 1) % activePlayers.length;
        const nextPlayer = activePlayers[nextIndex];

        if (nextPlayer) {
            this.focusedPlayerId = nextPlayer.id;
            this.focusTimer = this.FOCUS_DURATION;
            console.log(`Camera focus switched to: ${nextPlayer.username}`);
        }
    }
}