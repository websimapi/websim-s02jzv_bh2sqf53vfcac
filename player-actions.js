// This file has been refactored. Its contents have been moved to:
// - behaviors/chopping.js
// - behaviors/gathering.js
// - behaviors/following.js
// - behaviors/player-behavior-updater.js

// The primary export `updateAction` is now in `behaviors/player-behavior-updater.js`.
// Other functions are now in their respective behavior files.

export { updateAction } from './behaviors/player-behavior-updater.js';
export { startChoppingCycle } from './behaviors/chopping.js';
export { startGatheringCycle } from './behaviors/gathering.js';