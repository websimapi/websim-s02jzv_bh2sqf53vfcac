import { populateWorldList } from './world-list.js';
import { showWorldSettings } from './world-settings.js';

const PLAYERS_STORAGE_PREFIX = 'twitch_game_players_';

export function createNewWorld(channel) {
    let worldName = prompt("Enter a name for your new world:", "My World");
    if (!worldName) return;

    worldName = worldName.trim();

    const prefix = `${PLAYERS_STORAGE_PREFIX}${channel}_`;
    const key = prefix + worldName;
    const legacyKey = `${PLAYERS_STORAGE_PREFIX}${channel}`;

    if (localStorage.getItem(key) || (worldName.toLowerCase() === 'default' && localStorage.getItem(legacyKey))) {
        alert("A world with this name already exists.");
        return;
    }

    // We don't need to save anything yet; the game will do that on its first save interval.
    // Just refresh the list and show settings for the new (empty) world.
    console.log(`Creating new world placeholder: ${worldName}`);
    populateWorldList(channel);

    // Find the newly created (but not yet saved) world concept and open its settings
    setTimeout(() => {
        const worldItems = document.querySelectorAll('.world-item h3');
        let newWorldEl = null;
        for(const h3 of worldItems) {
            if(h3.textContent === worldName) {
                newWorldEl = h3.parentElement;
                break;
            }
        }

        if (newWorldEl) {
             // Deselect others, select this one
            document.querySelectorAll('.world-item.selected').forEach(el => el.classList.remove('selected'));
            newWorldEl.classList.add('selected');
            showWorldSettings(channel, worldName);
        } else {
            // Fallback for if the element isn't found immediately
             showWorldSettings(channel, worldName);
        }

    }, 100); // A small delay to ensure the DOM has updated
}