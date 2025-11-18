import { findWorldsForChannel, populateWorldList } from './world-list.js';
import * as StorageManager from '../storage-manager.js';
import * as idb from '../idb-helper.js';
import { format } from '../data-format.js';

const PLAYERS_STORAGE_PREFIX = 'twitch_game_players_';
const MAP_STORAGE_PREFIX = 'twitch_game_map_';
const STORAGE_KEY = 'twitch_channel_name';

function findAvailableWorldName(baseName, existingWorlds) {
    if (!existingWorlds.includes(baseName)) {
        return baseName;
    }
    let i = 1;
    while (true) {
        const newName = `${baseName} (${i})`;
        if (!existingWorlds.includes(newName)) {
            return newName;
        }
        i++;
    }
}

/*
function saveImportedWorld(channel, worldName, data) {
    const playerDataKey = `${PLAYERS_STORAGE_PREFIX}${channel}_${worldName}`;
    const mapDataKey = `${MAP_STORAGE_PREFIX}${channel}_${worldName}`;

    try {
        localStorage.setItem(playerDataKey, JSON.stringify(data.players || {}));
        localStorage.setItem(mapDataKey, JSON.stringify(data.map || {}));
        console.log(`Successfully imported and saved world \"${worldName}\" for channel \"${channel}\".`);
        alert(`Successfully imported world: ${worldName}`);
    } catch (e) {
        alert('An error occurred while saving the imported world data. The browser storage might be full.');
        console.error('Error saving imported world:', e);
    }
}
*/

async function saveImportedWorld(channel, worldName, data, dataFormat) {
    let playersToSave = data.players || {};

    // If format is verbose (or old format without a format key), compact it.
    if (dataFormat !== 'compact') {
        console.log("Imported world is in verbose or legacy format, compacting player data...");
        const compactedPlayers = {};
        for (const id in playersToSave) {
            compactedPlayers[id] = format.compactPlayerData(playersToSave[id]);
        }
        playersToSave = compactedPlayers;
    }

    const worldKey = `${channel}/${worldName}`;
    const worldState = {
        players: playersToSave,
        map: data.map || {}
    };

    try {
        await idb.set('worlds', worldKey, worldState);
        console.log(`Successfully imported and saved world "${worldName}" for channel "${channel}".`);
        alert(`Successfully imported world: ${worldName}`);
    } catch (e) {
        alert('An error occurred while saving the imported world data to IndexedDB.');
        console.error('Error saving imported world:', e);
    }
}

async function processImportedWorld(worldData) {
    if (!worldData.worldName || !worldData.data || !worldData.data.players || !worldData.data.map) {
        alert('Invalid world file format.');
        return;
    }

    const channel = localStorage.getItem(STORAGE_KEY);
    let importedWorldName = worldData.worldName;

    if (importedWorldName.toLowerCase() === 'default') {
        const newName = prompt("Importing a world named 'default' is not allowed as it cannot be overwritten. Please provide a new name for this world.", "default_imported");
        if (newName && newName.trim() !== '') {
            importedWorldName = newName.trim();
        } else {
            alert('Import cancelled: A valid name is required.');
            return; // User cancelled or entered empty name
        }
    }

    const existingWorlds = await findWorldsForChannel(channel);

    if (existingWorlds.includes(importedWorldName)) {
        const choice = prompt(`A world named "${importedWorldName}" already exists.\n\nType 'overwrite' to replace it.\nType 'copy' to save it as a new world.\n\nAnything else will cancel.`, 'copy');

        if (choice && choice.toLowerCase() === 'overwrite') {
            // Name remains the same, will overwrite existing data.
        } else if (choice && choice.toLowerCase() === 'copy') {
            importedWorldName = findAvailableWorldName(importedWorldName, existingWorlds);
            alert(`The world will be imported as "${importedWorldName}".`);
        } else {
            alert('Import cancelled.');
            return; // User cancelled or entered invalid input
        }
    }

    await saveImportedWorld(channel, importedWorldName, worldData.data, worldData.format);
    await populateWorldList(channel);
}

export function handleWorldImport() {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json';
    fileInput.style.display = 'none';

    fileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const worldData = JSON.parse(e.target.result);
                processImportedWorld(worldData);
            } catch (error) {
                alert('Error: Could not parse the JSON file. Please ensure it is a valid world export file.');
                console.error('JSON parsing error:', error);
            }
        };
        reader.readAsText(file);
    });

    document.body.appendChild(fileInput);
    fileInput.click();
    document.body.removeChild(fileInput);
}

export function exportWorldData(channel, worldName) {
    const useVerbose = confirm("Export in verbose (human-readable) format? Cancel for compact format.");
    StorageManager.exportWorldData(channel, worldName, useVerbose);
}