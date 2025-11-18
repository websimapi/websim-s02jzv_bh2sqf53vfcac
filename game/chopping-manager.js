import { PLAYER_STATE } from '../player-state.js';
import { finishChopping } from '../behaviors/chopping.js';

export function updateActiveChopping(game, deltaTime) {
    const { players, map, activeChoppingTargets, settings } = game;
    const CHOP_WORK = settings.woodcutting.tree_chop_work;
    const finishedTargets = [];

    for (const [targetId, chopData] of activeChoppingTargets.entries()) {
        // Clean up choppers who are no longer chopping this target
        for (const playerId of chopData.choppers) {
            const player = players.get(playerId);
            const playerTargetId = player?.actionTarget ? `${player.actionTarget.x},${player.actionTarget.y}` : null;
            if (!player || player.state !== PLAYER_STATE.CHOPPING || playerTargetId !== targetId) {
                chopData.choppers.delete(playerId);
            }
        }

        if (chopData.choppers.size === 0) {
            activeChoppingTargets.delete(targetId);
            continue;
        }

        const workDone = chopData.choppers.size * deltaTime * 1000;
        chopData.remainingWork -= workDone;

        // Update individual player timers for UI
        for (const playerId of chopData.choppers) {
            const player = players.get(playerId);
            if (player) { // Player should exist as we just validated
                player.actionTimer = Math.max(0, chopData.remainingWork / 1000);
                player.actionTotalTime = CHOP_WORK / 1000;
            }
        }

        if (chopData.remainingWork <= 0) {
            finishedTargets.push(targetId);
        }
    }

    for (const targetId of finishedTargets) {
        const chopData = activeChoppingTargets.get(targetId);
        if (!chopData) continue;

        // Find one player to "finish" the chop and spawn resources
        const finisherId = chopData.choppers.values().next().value;
        const finisher = players.get(finisherId);

        if (finisher) {
            // This player will cut the tree, change map tile, and generate logs/bushes
            // Other players will see the tile change and call treeHasBeenChopped
            finishChopping(finisher, map, game, players);
        } else {
            // No valid finisher, just remove the target
            activeChoppingTargets.delete(targetId);
        }
    }
}