import * as idb from './idb-helper.js';
import { format } from './data-format.js';

const MIGRATION_KEY = 'migration_status';

async function migrateFromLocalStorage(channel, worldName) {
    console.log(`Checking for localStorage data for ${channel}/${worldName}...`);
    const playersKey = `twitch_game_players_${channel}_${worldName}`;
    const mapKey = `twitch_game_map_${channel}_${worldName}`;

    const playersDataLS = localStorage.getItem(playersKey);
    const mapDataLS = localStorage.getItem(mapKey);

    if (!playersDataLS && !mapDataLS) {
        console.log("No localStorage data found to migrate.");
        return;
    }

    console.log("LocalStorage data found. Starting migration to IndexedDB.");

    // 1. Compact Player Data
    const players = JSON.parse(playersDataLS || '{}');
    const compactedPlayers = {};
    for (const id in players) {
        compactedPlayers[id] = format.compactPlayerData(players[id]);
    }

    // 2. Load Map Data
    const map = JSON.parse(mapDataLS || '{}');

    // 3. Save to IndexedDB
    const worldKey = `${channel}/${worldName}`;
    await idb.set('worlds', worldKey, { players: compactedPlayers, map });
    console.log("Migration complete. Data saved to IndexedDB.");

    // 4. Backup and clear localStorage
    localStorage.setItem(playersKey + '_migrated_bak', playersDataLS);
    localStorage.setItem(mapKey + '_migrated_bak', mapDataLS);
    localStorage.removeItem(playersKey);
    localStorage.removeItem(mapKey);
    console.log("Old localStorage data backed up and cleared.");
}

export async function init(channel, worldName) {
    const migrationStatus = await idb.get('metadata', MIGRATION_KEY);
    if (migrationStatus !== 'completed') {
        // Find all worlds in localStorage and migrate them
        console.log("Running one-time migration check...");
        const worldsToMigrate = new Set();
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('twitch_game_players_') && !key.endsWith('_migrated_bak')) {
                const parts = key.replace('twitch_game_players_', '').split('_');
                const ch = parts[0];
                const wn = parts.slice(1).join('_');
                worldsToMigrate.add(`${ch}/${wn}`);
            }
        }

        for (const worldKey of worldsToMigrate) {
            const [ch, wn] = worldKey.split('/');
            await migrateFromLocalStorage(ch, wn);
        }

        await idb.set('metadata', MIGRATION_KEY, 'completed');
        console.log("Migration check finished.");
    }
}

export async function saveGameState(channel, worldName, players, map) {
    const worldKey = `${channel}/${worldName}`;
    const playersState = {};
    for (const [id, player] of players.entries()) {
        playersState[id] = player.getState();
    }
    const mapState = {
        grid: map.grid,
        treeRespawns: map.treeRespawns,
    };

    await idb.set('worlds', worldKey, {
        players: playersState,
        map: mapState
    });
    console.log(`[StorageManager] Saved world ${worldName} to IndexedDB.`);
}

export async function loadGameState(channel, worldName) {
    const worldKey = `${channel}/${worldName}`;
    const data = await idb.get('worlds', worldKey);
    return data || { players: {}, map: {} };
}

export async function deleteWorld(channel, worldName) {
    const worldKey = `${channel}/${worldName}`;
    await idb.del('worlds', worldKey);
    console.log(`[StorageManager] Deleted world ${worldName} from IndexedDB.`);
}

export async function renameWorld(channel, oldWorldName, newWorldName) {
    // IndexedDB world data
    const oldWorldKey = `${channel}/${oldWorldName}`;
    const newWorldKey = `${channel}/${newWorldName}`;

    const worldData = await idb.get('worlds', oldWorldKey);

    if (worldData) { // It might be a new world that hasn't been saved yet
        await idb.set('worlds', newWorldKey, worldData);
        await idb.del('worlds', oldWorldKey);
    }

    // localStorage settings
    const oldSettingsKey = `twitch_game_settings_${channel}_${oldWorldName}`;
    const newSettingsKey = `twitch_game_settings_${channel}_${newWorldName}`;
    const settingsData = localStorage.getItem(oldSettingsKey);
    if (settingsData) {
        localStorage.setItem(newSettingsKey, settingsData);
        localStorage.removeItem(oldSettingsKey);
    }

    // localStorage hosts
    const oldHostsKey = `twitch_game_hosts_${channel}_${oldWorldName}`;
    const newHostsKey = `twitch_game_hosts_${channel}_${newWorldName}`;
    const hostsData = localStorage.getItem(oldHostsKey);
    if (hostsData) {
        localStorage.setItem(newHostsKey, hostsData);
        localStorage.removeItem(oldHostsKey);
    }

    console.log(`[StorageManager] Renamed world from '${oldWorldName}' to '${newWorldName}'.`);
    return true;
}


export async function exportWorldData(channel, worldName, useVerbose) {
    const worldKey = `${channel}/${worldName}`;
    const worldState = await idb.get('worlds', worldKey);
    if (!worldState) {
        alert("Could not find world data to export.");
        return;
    }

    let finalPlayers = worldState.players;
    if (useVerbose) {
        finalPlayers = {};
        for (const id in worldState.players) {
            finalPlayers[id] = format.expandPlayerData(worldState.players[id]);
        }
    }

    const exportData = {
        channel,
        worldName,
        timestamp: new Date().toISOString(),
        data: {
            players: finalPlayers,
            map: worldState.map,
        },
        format: useVerbose ? 'verbose' : 'compact',
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `${channel}_${worldName}_${useVerbose ? 'verbose' : 'compact'}_backup.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}