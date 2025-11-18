import * as Persistence from './game/persistence.js';
import * as DOM from './ui/dom-elements.js';
import { populateWorldList } from './ui/world-list.js';
import { handleWorldImport } from './ui/world-import-export.js';
import { createNewWorld } from './ui/world-management.js';

const STORAGE_KEY = 'twitch_channel_name';

let startGameCallback;

export function showGame(channel, worldName, hosts, settings) {
    DOM.worldSelectContainer.classList.add('hidden');
    DOM.gameContainer.classList.remove('hidden');
    if (startGameCallback) {
        startGameCallback(channel, worldName, hosts, settings);
    }
}

function showWorldSelect(channel) {
    DOM.connectContainer.classList.add('hidden');
    DOM.worldSelectContainer.classList.remove('hidden');
    DOM.worldSelectTitle.textContent = `Worlds for #${channel}`;
    populateWorldList(channel);
}

export function initUIManager(onStartGame) {
    startGameCallback = onStartGame;

    DOM.connectBtn.addEventListener('click', () => {
        const channel = DOM.channelInput.value.trim().toLowerCase();
        if (channel) {
            localStorage.setItem(STORAGE_KEY, channel);
            showWorldSelect(channel);
        }
    });

    DOM.createWorldBtn.addEventListener('click', () => {
        const channel = localStorage.getItem(STORAGE_KEY);
        if (channel) {
            createNewWorld(channel);
        }
    });

    DOM.importWorldBtn.addEventListener('click', () => {
        handleWorldImport();
    });

    DOM.channelInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            DOM.connectBtn.click();
        }
    });

    // Load channel from localStorage on startup
    const savedChannel = localStorage.getItem(STORAGE_KEY);
    if (savedChannel) {
        DOM.channelInput.value = savedChannel;
    }
}