export class PlayerSkills {
    constructor(player) {
        this.player = player;
        this.skills = {
            // Data is now in { [timestamp]: amount } format
            woodcutting: {},
            gathering: {}
        };
    }

    addExperience(skill, amount) {
        if (this.skills[skill]) {
            const timestamp = Date.now();
            this.skills[skill][timestamp] = amount;

            const totalExp = Object.values(this.skills[skill]).reduce((sum, entry) => sum + entry, 0);
            console.log(`[${this.player.username}] Gained +${amount} XP in ${skill}. Total: ${totalExp}. Timestamp: ${timestamp}`);
        } else {
            console.warn(`[${this.player.username}] Attempted to add XP to non-existent skill: ${skill}`);
        }
    }

    getState() {
        return this.skills;
    }

    loadState(state) {
        this.skills = state || { woodcutting: {}, gathering: {} };
    }
}