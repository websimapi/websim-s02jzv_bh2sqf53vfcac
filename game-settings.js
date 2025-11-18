export const DEFAULT_GAME_SETTINGS = {
    energy: {
        duration_seconds: 3600, // 1 hour
        chat_cooldown_seconds: 600, // 10 minutes
    },
    woodcutting: {
        tree_chop_work: 11000, // ms
        finish_chop_xp: 3,
        harvest_logs_xp_per_log: 1,
    },
    gathering: {
        harvest_logs_duration_seconds: 6,
        harvest_logs_min_yield: 1,
        harvest_logs_max_yield: 3,
        harvest_logs_xp: 2,
        harvest_bushes_duration_seconds_base: 2,
        harvest_bushes_min_yield: 200,
        harvest_bushes_max_yield: 1000,
        harvest_bushes_xp: 1,
    },
    visuals: {
        show_target_indicator: true,
        show_hitboxes: false,
        show_pathing_lines: false,
        allow_me_command: true,
    }
};

// Deep merge utility
function deepMerge(target, source) {
    for (const key in source) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            if (!target[key]) {
                Object.assign(target, { [key]: {} });
            }
            deepMerge(target[key], source[key]);
        } else {
            Object.assign(target, { [key]: source[key] });
        }
    }
    return target;
}

export function loadSettings(channel, worldName) {
    const key = `twitch_game_settings_${channel}_${worldName}`;
    const defaults = JSON.parse(JSON.stringify(DEFAULT_GAME_SETTINGS)); // Deep copy defaults
    try {
        const storedSettings = localStorage.getItem(key);
        if (storedSettings) {
            const parsed = JSON.parse(storedSettings);
            // Merge stored settings into defaults to ensure new settings from updates are included
            return deepMerge(defaults, parsed);
        }
    } catch (e) {
        console.error("Failed to load game settings:", e);
    }
    return defaults;
}

export function saveSettings(channel, worldName, settings) {
    const key = `twitch_game_settings_${channel}_${worldName}`;
    try {
        localStorage.setItem(key, JSON.stringify(settings));
    } catch (e) {
        console.error("Failed to save game settings:", e);
    }
}