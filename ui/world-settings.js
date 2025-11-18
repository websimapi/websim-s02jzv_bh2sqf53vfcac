import * as Persistence from '../game/persistence.js';
import { loadSettings, saveSettings } from '../game-settings.js';
import * as DOM from './dom-elements.js';
import { findWorldsForChannel, populateWorldList } from './world-list.js';
import { showGame } from '../ui-manager.js';
import * as StorageManager from '../storage-manager.js';

function showDeleteConfirmation(onConfirm) {
    const overlay = document.createElement('div');
    overlay.id = 'delete-confirm-overlay';

    const popup = document.createElement('div');
    popup.id = 'delete-confirm-popup';

    popup.innerHTML = `
        <button id="delete-confirm-close-btn">&times;</button>
        <h2>Are you sure?</h2>
        <p>This will permanently delete the world and all its data. This action cannot be undone.</p>
        <div class="delete-confirm-actions">
            <button id="delete-confirm-yes-btn">Yes (Cannot be undone)</button>
            <button id="delete-confirm-cancel-btn">Cancel</button>
        </div>
    `;

    overlay.appendChild(popup);
    document.body.appendChild(overlay);

    const closePopup = () => {
        if (document.body.contains(overlay)) {
            document.body.removeChild(overlay);
        }
        document.removeEventListener('keydown', handleEsc);
    };

    const handleEsc = (e) => {
        if (e.key === 'Escape') {
            closePopup();
        }
    };

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            closePopup();
        }
    });

    document.getElementById('delete-confirm-close-btn').addEventListener('click', closePopup);
    document.getElementById('delete-confirm-cancel-btn').addEventListener('click', closePopup);
    document.getElementById('delete-confirm-yes-btn').addEventListener('click', () => {
        onConfirm();
        closePopup();
    });

    document.addEventListener('keydown', handleEsc, { once: true });
}


export function showWorldSettings(channel, worldName) {
    let currentWorldName = worldName;
    const settings = loadSettings(channel, currentWorldName);

    DOM.worldSettingsContainer.classList.remove('hidden');
    DOM.worldSettingsContainer.innerHTML = `
        <div class="settings-grid">
            <div class="settings-column">
                <div class="settings-section">
                    <label for="world-name-input">World Name</label>
                    <input type="text" id="world-name-input" class="world-name-input" value="${currentWorldName}">
                </div>
                <div class="settings-section admin-management">
                    <label>Manage Admins</label>
                    <p class="setting-desc">Admins can use special commands in-game.</p>
                    <div class="admin-input-group">
                        <input type="text" id="admin-input" placeholder="Enter username...">
                        <button id="add-admin-btn">Add Admin</button>
                    </div>
                    <ul id="admin-list"></ul>
                </div>
                 <div class="settings-section">
                    <label>Storage System</label>
                    <p class="setting-desc">The game now uses IndexedDB for better performance and capacity.</p>
                    <div id="storage-info">Loading...</div>
                </div>
                <div class="settings-section">
                    <label>Visuals</label>
                    <div class="setting-item">
                        <input type="checkbox" id="show_target_indicator" data-path="visuals.show_target_indicator" ${settings.visuals && settings.visuals.show_target_indicator ? 'checked' : ''}>
                        <label for="show_target_indicator">Show Target Tile Indicator</label>
                    </div>
                    <div class="setting-item">
                        <input type="checkbox" id="show_hitboxes" data-path="visuals.show_hitboxes" ${settings.visuals && settings.visuals.show_hitboxes ? 'checked' : ''}>
                        <label for="show_hitboxes">Show Hitbox Outlines</label>
                    </div>
                    <div class="setting-item">
                        <input type="checkbox" id="show_pathing_lines" data-path="visuals.show_pathing_lines" ${settings.visuals && settings.visuals.show_pathing_lines ? 'checked' : ''}>
                        <label for="show_pathing_lines">Show Pathing Lines</label>
                    </div>
                    <div class="setting-item">
                        <input type="checkbox" id="allow_me_command" data-path="visuals.allow_me_command" ${settings.visuals && settings.visuals.allow_me_command ? 'checked' : ''}>
                        <label for="allow_me_command">Allow !me Command</label>
                    </div>
                </div>
            </div>
            <div class="settings-column">
                <div class="settings-section">
                    <label>Game Rates & XP</label>
                    <div class="rate-grid">
                        <!-- Energy -->
                        <div class="rate-item"><label for="energy_duration_seconds">Energy Duration (s)</label><input type="number" id="energy_duration_seconds" data-path="energy.duration_seconds" value="${settings.energy.duration_seconds}"></div>
                        <div class="rate-item"><label for="energy_chat_cooldown_seconds">Chat Cooldown (s)</label><input type="number" id="energy_chat_cooldown_seconds" data-path="energy.chat_cooldown_seconds" value="${settings.energy.chat_cooldown_seconds}"></div>
                        <!-- Woodcutting -->
                        <div class="rate-item"><label for="tree_chop_work">Tree Chop Work (ms)</label><input type="number" id="tree_chop_work" data-path="woodcutting.tree_chop_work" value="${settings.woodcutting.tree_chop_work}"></div>
                        <div class="rate-item"><label for="finish_chop_xp">Chop Finish XP</label><input type="number" id="finish_chop_xp" data-path="woodcutting.finish_chop_xp" value="${settings.woodcutting.finish_chop_xp}"></div>
                        <div class="rate-item"><label for="harvest_logs_xp_per_log">Log Harvest WC XP</label><input type="number" id="harvest_logs_xp_per_log" data-path="woodcutting.harvest_logs_xp_per_log" value="${settings.woodcutting.harvest_logs_xp_per_log}"></div>
                        <!-- Gathering -->
                        <div class="rate-item"><label for="harvest_logs_duration_seconds">Log Harvest Time (s)</label><input type="number" id="harvest_logs_duration_seconds" data-path="gathering.harvest_logs_duration_seconds" value="${settings.gathering.harvest_logs_duration_seconds}"></div>
                        <div class="rate-item"><label for="harvest_logs_min_yield">Logs Min Yield</label><input type="number" id="harvest_logs_min_yield" data-path="gathering.harvest_logs_min_yield" value="${settings.gathering.harvest_logs_min_yield}"></div>
                        <div class="rate-item"><label for="harvest_logs_max_yield">Logs Max Yield</label><input type="number" id="harvest_logs_max_yield" data-path="gathering.harvest_logs_max_yield" value="${settings.gathering.harvest_logs_max_yield}"></div>
                        <div class="rate-item"><label for="harvest_logs_xp">Log Harvest Gath XP</label><input type="number" id="harvest_logs_xp" data-path="gathering.harvest_logs_xp" value="${settings.gathering.harvest_logs_xp}"></div>
                        <div class="rate-item"><label for="harvest_bushes_duration_seconds_base">Bush Harvest Time (s)</label><input type="number" id="harvest_bushes_duration_seconds_base" data-path="gathering.harvest_bushes_duration_seconds_base" value="${settings.gathering.harvest_bushes_duration_seconds_base}"></div>
                        <div class="rate-item"><label for="harvest_bushes_min_yield">Bush Min Yield</label><input type="number" id="harvest_bushes_min_yield" data-path="gathering.harvest_bushes_min_yield" value="${settings.gathering.harvest_bushes_min_yield}"></div>
                        <div class="rate-item"><label for="harvest_bushes_max_yield">Bush Max Yield</label><input type="number" id="harvest_bushes_max_yield" data-path="gathering.harvest_bushes_max_yield" value="${settings.gathering.harvest_bushes_max_yield}"></div>
                        <div class="rate-item"><label for="harvest_bushes_xp">Bush Harvest XP</label><input type="number" id="harvest_bushes_xp" data-path="gathering.harvest_bushes_xp" value="${settings.gathering.harvest_bushes_xp}"></div>
                    </div>
                </div>
            </div>
        </div>

        <button id="play-btn">Play</button>

        <div class="settings-section delete-section">
            <label for="delete-world-input">Delete World</label>
            <p style="font-size: 14px; color: #aaa; margin: 0;">This action cannot be undone. To confirm, type the world name below.</p>
            <div class="delete-input-group">
                <input type="text" id="delete-world-input" placeholder="Type world name to confirm...">
                <button id="delete-world-btn" disabled>Delete</button>
            </div>
        </div>
    `;

    const worldNameInputEl = document.getElementById('world-name-input');

    async function updateStorageInfo() {
        const storageInfoEl = document.getElementById('storage-info');
        if (navigator.storage && navigator.storage.estimate) {
            const estimate = await navigator.storage.estimate();
            const usage = (estimate.usage / 1024 / 1024).toFixed(2);
            const quota = (estimate.quota / 1024 / 1024).toFixed(2);
            storageInfoEl.innerHTML = `
                <p style="margin: 0; font-size: 14px;">
                    Using <strong>IndexedDB</strong>: ${usage} MB / ${quota} MB
                </p>`;
        } else {
            storageInfoEl.textContent = 'Storage estimation is not available in this browser.';
        }
    }
    updateStorageInfo();

    async function handleRename() {
        const newWorldName = worldNameInputEl.value.trim();
        if (newWorldName && newWorldName !== currentWorldName) {
            if (newWorldName.toLowerCase() === 'default') {
                alert("You cannot name a world 'default'. Please choose a different name.");
                worldNameInputEl.value = currentWorldName; // Revert
                return false;
            }

            const existingWorlds = await findWorldsForChannel(channel);
            if (existingWorlds.includes(newWorldName)) {
                alert(`A world named "${newWorldName}" already exists. Please choose a different name.`);
                worldNameInputEl.value = currentWorldName; // Revert
                return false;
            }

            const success = await StorageManager.renameWorld(channel, currentWorldName, newWorldName);
            if (success) {
                console.log(`World renamed from ${currentWorldName} to ${newWorldName}`);
                // Update internal state
                const oldWorldName = currentWorldName;
                currentWorldName = newWorldName;

                // Update the world list display
                await populateWorldList(channel);

                // Re-select the newly named world
                setTimeout(() => {
                    const worldItems = document.querySelectorAll('.world-item h3');
                    for (const h3 of worldItems) {
                        if (h3.textContent === currentWorldName) {
                            const parent = h3.parentElement;
                            document.querySelectorAll('.world-item.selected').forEach(el => el.classList.remove('selected'));
                            parent.classList.add('selected');
                            break;
                        }
                    }
                }, 100);
                
                return true;
            } else {
                alert("An error occurred while renaming the world.");
                worldNameInputEl.value = currentWorldName; // Revert on failure
                return false;
            }
        }
        return false;
    }

    worldNameInputEl.addEventListener('blur', async () => {
        await handleRename();
    });

    worldNameInputEl.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter') {
            worldNameInputEl.blur(); // Trigger blur to save
        }
    });

    // Admin/Host logic remains the same, but it will need to be migrated too.
    // Let's assume for now it's still in localStorage until fully migrated.
    const hostsStorageKey = `twitch_game_hosts_${channel}_${currentWorldName}`;
    let hosts = JSON.parse(localStorage.getItem(hostsStorageKey) || '[]');

    const adminListEl = document.getElementById('admin-list');
    const adminInputEl = document.getElementById('admin-input');
    const addAdminBtn = document.getElementById('add-admin-btn');
    const playBtn = document.getElementById('play-btn');

    function renderAdmins() {
        adminListEl.innerHTML = '';
        hosts.forEach(host => {
            const li = document.createElement('li');
            li.className = 'admin-item';
            li.textContent = host;
            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-admin-btn';
            removeBtn.innerHTML = '&times;';
            removeBtn.onclick = () => {
                hosts = hosts.filter(h => h !== host);
                localStorage.setItem(hostsStorageKey, JSON.stringify(hosts));
                renderAdmins();
            };
            li.appendChild(removeBtn);
            adminListEl.appendChild(li);
        });
    }

    addAdminBtn.addEventListener('click', () => {
        const newAdmin = adminInputEl.value.trim().toLowerCase();
        if (newAdmin && !hosts.includes(newAdmin)) {
            hosts.push(newAdmin);
            localStorage.setItem(hostsStorageKey, JSON.stringify(hosts));
            renderAdmins();
            adminInputEl.value = '';
        }
    });

    adminInputEl.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addAdminBtn.click();
        }
    });

    playBtn.addEventListener('click', async () => {
        await handleRename(); // Save name change on play, if any
        const currentSettings = loadSettings(channel, currentWorldName);
        showGame(channel, currentWorldName, hosts, currentSettings);
    });

    // --- Settings Rate Logic ---
    DOM.worldSettingsContainer.querySelectorAll('.rate-grid input[type="number"]').forEach(input => {
        input.addEventListener('change', () => {
            const path = input.dataset.path.split('.');
            let current = settings;
            for (let i = 0; i < path.length - 1; i++) {
                current = current[path[i]];
            }
            current[path[path.length - 1]] = Number(input.value);
            saveSettings(channel, currentWorldName, settings);
        });
    });

    DOM.worldSettingsContainer.querySelectorAll('input[type="checkbox"]').forEach(input => {
        input.addEventListener('change', () => {
            const path = input.dataset.path.split('.');
            let current = settings;
            for (let i = 0; i < path.length - 1; i++) {
                if (!current[path[i]]) {
                    current[path[i]] = {};
                }
                current = current[path[i]];
            }
            current[path[path.length - 1]] = input.checked;
            saveSettings(channel, currentWorldName, settings);
        });
    });

    // --- Delete World Logic ---
    const deleteWorldInput = document.getElementById('delete-world-input');
    const deleteWorldBtn = document.getElementById('delete-world-btn');

    deleteWorldInput.addEventListener('input', () => {
        if (deleteWorldInput.value === currentWorldName) {
            deleteWorldBtn.disabled = false;
        } else {
            deleteWorldBtn.disabled = true;
        }
    });

    deleteWorldBtn.addEventListener('click', () => {
        if (deleteWorldBtn.disabled) return;

        showDeleteConfirmation(async () => {
            console.log(`Deleting world: ${currentWorldName}`);
            // This also needs to be updated for IDB.
            await StorageManager.deleteWorld(channel, currentWorldName);

            // Also remove settings and hosts from localStorage
            localStorage.removeItem(`twitch_game_settings_${channel}_${currentWorldName}`);
            localStorage.removeItem(`twitch_game_hosts_${channel}_${currentWorldName}`);

            DOM.worldSettingsContainer.classList.add('hidden');
            populateWorldList(channel);
            alert(`World \\\"${currentWorldName}\\\" has been deleted.`);
        });
    });

    renderAdmins();
}