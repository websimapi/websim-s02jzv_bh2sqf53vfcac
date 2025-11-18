// --- Compaction / Expansion ---

function deltaEncode(arr) {
    if (!arr || arr.length === 0) return { s: 0, d: [] };
    const timestamps = arr.map(item => item.timestamp).sort((a, b) => a - b);
    const startTimestamp = timestamps[0];
    const deltas = [];
    for (let i = 1; i < timestamps.length; i++) {
        deltas.push(timestamps[i] - timestamps[i - 1]);
    }
    return { s: startTimestamp, d: deltas };
}

function deltaDecode(compact) {
    if (!compact || !compact.s) return [];
    const timestamps = [compact.s];
    for (let i = 0; i < compact.d.length; i++) {
        timestamps.push(timestamps[i] + compact.d[i]);
    }
    return timestamps.map(ts => ({ timestamp: ts }));
}

function arrayToObject(arr) {
    if (!arr) return {};
    return arr.reduce((obj, item) => {
        obj[item.timestamp] = item.amount;
        return obj;
    }, {});
}

function objectToArray(obj, amountKey = 'amount', tsKey = 'timestamp') {
    if (!obj) return [];
    return Object.entries(obj).map(([timestamp, amount]) => ({
        [amountKey]: amount,
        [tsKey]: Number(timestamp)
    }));
}

function isDataCompact(playerData) {
    if (!playerData || !playerData.inventory || !playerData.skills) return false;
    // Check for a few key indicators of the compact format
    const isLogsCompact = playerData.inventory.logs && typeof playerData.inventory.logs.s === 'number';
    const isLeavesCompact = playerData.inventory.leaves && !Array.isArray(playerData.inventory.leaves);
    const isWoodcuttingCompact = playerData.skills.woodcutting && !Array.isArray(playerData.skills.woodcutting);
    return isLogsCompact && isLeavesCompact && isWoodcuttingCompact;
}

function compactPlayerData(playerData) {
    if (isDataCompact(playerData)) return playerData;
    const compacted = JSON.parse(JSON.stringify(playerData));

    compacted.inventory.logs = deltaEncode(playerData.inventory.logs);
    compacted.inventory.leaves = arrayToObject(playerData.inventory.leaves);
    compacted.skills.woodcutting = arrayToObject(playerData.skills.woodcutting);
    compacted.skills.gathering = arrayToObject(playerData.skills.gathering);

    return compacted;
}

function expandPlayerData(playerData) {
    if (!isDataCompact(playerData)) return playerData;
    const expanded = JSON.parse(JSON.stringify(playerData));

    expanded.inventory.logs = deltaDecode(playerData.inventory.logs);
    expanded.inventory.leaves = objectToArray(playerData.inventory.leaves, 'amount', 'timestamp');
    expanded.skills.woodcutting = objectToArray(playerData.skills.woodcutting, 'amount', 'timestamp');
    expanded.skills.gathering = objectToArray(playerData.skills.gathering, 'amount', 'timestamp');

    return expanded;
}

export const format = {
    compactPlayerData,
    expandPlayerData,
    isDataCompact,
};