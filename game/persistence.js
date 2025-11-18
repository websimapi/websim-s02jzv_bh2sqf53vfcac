import { Player } from '../player.js';

const PLAYERS_STORAGE_PREFIX = 'twitch_game_players_';
const MAP_STORAGE_PREFIX = 'twitch_game_map_';
const HOSTS_STORAGE_PREFIX = 'twitch_game_hosts_';

export function getStorageKeys(channel, worldName) {
    const playersStorageKey = worldName === 'default' 
        ? `${PLAYERS_STORAGE_PREFIX}${channel}`
        : `${PLAYERS_STORAGE_PREFIX}${channel}_${worldName}`;
    const mapStorageKey = worldName === 'default'
        ? `${MAP_STORAGE_PREFIX}${channel}`
        : `${MAP_STORAGE_PREFIX}${channel}_${worldName}`;
    const hostsStorageKey = worldName === 'default'
        ? `${HOSTS_STORAGE_PREFIX}${channel}`
        : `${HOSTS_STORAGE_PREFIX}${channel}_${worldName}`;
    return { playersStorageKey, mapStorageKey, hostsStorageKey };
}

export function savePlayers(players, playersStorageKey) {
    if (players.size === 0) return;

    const playerStates = {};
    for (const player of players.values()) {
        playerStates[player.id] = player.getState();
    }

    try {
        localStorage.setItem(playersStorageKey, JSON.stringify(playerStates));
        if (players.size > 0) {
            const samplePlayer = players.values().next().value;
            const energyCount = samplePlayer.energyTimestamps ? samplePlayer.energyTimestamps.length : 0;
            console.log(`[Persistence] Saved state. Sample Player (${samplePlayer.username}): Position (${samplePlayer.pixelX.toFixed(2)}, ${samplePlayer.pixelY.toFixed(2)}), Energy Cells: ${energyCount}`);
        }
    } catch (e) {
        console.error("Could not save player data to localStorage:", e);
    }
}

export function saveMap(gameMap, mapStorageKey) {
    const mapData = {
        grid: gameMap.grid,
        treeRespawns: gameMap.treeRespawns
    };
    try {
        localStorage.setItem(mapStorageKey, JSON.stringify(mapData));
        console.log(`[Persistence] Saved map data for world.`);
    } catch (e) {
        console.error("Could not save map data to localStorage:", e);
    }
}

export function loadMap(gameMap, mapStorageKey) {
    try {
        const data = localStorage.getItem(mapStorageKey);
        if (data) {
            const mapData = JSON.parse(data);
            gameMap.grid = mapData.grid;
            gameMap.treeRespawns = mapData.treeRespawns || [];
            console.log(`[Persistence] Loaded map data from localStorage.`);
        } else {
            gameMap.generateMap();
            console.log(`[Persistence] No map data found. Generated a new map.`);
            saveMap(gameMap, mapStorageKey);
        }
    } catch(e) {
        console.error("Could not load map data, generating new map.", e);
        gameMap.generateMap();
    }
}

export function loadHosts(hostsStorageKey) {
    try {
        const data = localStorage.getItem(hostsStorageKey);
        if (data) {
            return JSON.parse(data);
        }
    } catch (e) {
        console.error("Could not load host data from localStorage:", e);
    }
    return []; // Return empty array if not found or error
}

export function saveHosts(hosts, hostsStorageKey) {
    try {
        localStorage.setItem(hostsStorageKey, JSON.stringify(hosts));
    } catch (e) {
        console.error("Could not save host data to localStorage:", e);
    }
}

export function loadPlayers(players, playersStorageKey, gameSettings) {
    try {
        const data = localStorage.getItem(playersStorageKey);
        if (data) {
            const playerStates = JSON.parse(data);
            for (const id in playerStates) {
                const state = playerStates[id];
                if (state && state.id && state.username) {
                    const player = new Player(state.id, state.username, state.color, gameSettings);
                    player.loadState(state);
                    players.set(id, player);
                }
            }
            console.log(`[Persistence] Loaded ${players.size} player states from localStorage.`);
        }
    } catch (e) {
        console.error("Could not load player data from localStorage:", e);
    }
}