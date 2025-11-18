export const MAX_ENERGY_SLOTS = 12;

export class PlayerEnergy {
    constructor(player, gameSettings) {
        this.player = player;
        this.gameSettings = gameSettings;
        this.timestamps = [];
        this.currentCellDrainRatio = 0;
        this.flashState = 0;
        this.lastEnergyLogTime = 0;
    }

    add(amount = 1) {
        for (let i = 0; i < amount; i++) {
            if (this.timestamps.length < MAX_ENERGY_SLOTS) {
                this.timestamps.push(Date.now());
            } else {
                break;
            }
        }
    }

    isPowered() {
        return this.timestamps.length > 0;
    }

    update(deltaTime) {
        if (!this.isPowered()) return false;

        const ENERGY_DURATION_MS = this.gameSettings.energy.duration_seconds * 1000;
        const now = Date.now();
        const oldestTimestamp = this.timestamps[0];

        const timeElapsed = now - oldestTimestamp;
        this.currentCellDrainRatio = Math.min(1, timeElapsed / ENERGY_DURATION_MS);

        const expirationTime = oldestTimestamp + ENERGY_DURATION_MS;
        const remainingMS = expirationTime - now;

        this.flashState = (Math.sin(now / 750) + 1) / 2;

        if (remainingMS > 0) {
            const LOG_INTERVAL = 60000;
            if (now - this.lastEnergyLogTime > LOG_INTERVAL) {
                const remainingSeconds = Math.ceil(remainingMS / 1000);
                console.log(`[Energy Drain Status] Player ${this.player.username}: Time left on current cell: ${remainingSeconds}s. Total cells: ${this.timestamps.length}`);
                this.lastEnergyLogTime = now;
            }
        }

        if (remainingMS <= 0) {
            this.timestamps.shift();
            console.log(`[Energy Drain] Player ${this.player.username} consumed one energy cell. Remaining cells: ${this.timestamps.length}`);

            if (!this.isPowered()) {
                this.currentCellDrainRatio = 0;
                this.flashState = 0;
                return false; // Energy just ran out
            }
        }
        return true; // Still has energy
    }

    getState() {
        return this.timestamps;
    }

    loadState(state) {
        if (state && Array.isArray(state)) {
            this.timestamps = state;
            this.timestamps.sort((a, b) => a - b);
        }
    }
}