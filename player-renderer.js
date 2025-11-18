import { PLAYER_STATE } from './player-state.js';

let woodcuttingIcon = null;
let gatheringIcon = null;
let iconsLoaded = false;

async function loadPlayerRendererAssets() {
    if (iconsLoaded) return;
    const loadImg = (src) => new Promise((resolve) => {
        const img = new Image();
        img.src = src;
        img.onload = () => resolve(img);
    });
    [woodcuttingIcon, gatheringIcon] = await Promise.all([
        loadImg('./woodcutting_icon.png'),
        loadImg('./gathering_icon.png'),
    ]);
    iconsLoaded = true;
    console.log("Player renderer assets loaded.");
}

// Immediately start loading assets
loadPlayerRendererAssets();


const MAX_ENERGY_SLOTS = 12;
const PARTIAL_BLOCKS = [' ', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
const FILLED_BLOCK = '█';
const EMPTY_BLOCK_VISUAL = '▒';
const BASE_COLOR_RGB = '173, 216, 230';
const FILLED_COLOR = `rgb(${BASE_COLOR_RGB})`;
const EMPTY_COLOR_ALPHA = `rgba(${BASE_COLOR_RGB}, 0.4)`;

function getSkillInfo(player) {
    switch (player.state) {
        case PLAYER_STATE.CHOPPING:
            return { icon: woodcuttingIcon, progress: (player.actionTotalTime - player.actionTimer) / player.actionTotalTime };
        case PLAYER_STATE.HARVESTING_LOGS:
        case PLAYER_STATE.HARVESTING_BUSHES:
            return { icon: gatheringIcon, progress: (player.actionTotalTime - player.actionTimer) / player.actionTotalTime };
        default:
            return null;
    }
}

function drawSkillIndicator(ctx, player, screenX, usernameTagY, usernameFontSize) {
    const skillInfo = getSkillInfo(player);
    if (!skillInfo || !skillInfo.icon || !iconsLoaded) return;

    const iconSize = usernameFontSize * 1.5;
    const iconRadius = iconSize / 2;
    const lineWidth = 3;

    // Measure username width to position the icon to the left
    ctx.font = `${usernameFontSize}px Arial, sans-serif`;
    const usernameWidth = ctx.measureText(player.username).width;
    const iconCenterX = screenX - (usernameWidth / 2) - iconRadius - 8;
    const iconCenterY = usernameTagY - (usernameFontSize / 2);

    // Draw background circle
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.beginPath();
    ctx.arc(iconCenterX, iconCenterY, iconRadius, 0, Math.PI * 2);
    ctx.fill();

    // Draw icon with padding
    const iconPadding = 0.15; // 15% padding
    const paddedIconSize = iconSize * (1 - iconPadding * 2);
    const paddedIconRadius = paddedIconSize / 2;
    ctx.drawImage(skillInfo.icon, iconCenterX - paddedIconRadius, iconCenterY - paddedIconRadius, paddedIconSize, paddedIconSize);

    // Draw progress arc
    const progress = Math.min(1, Math.max(0, skillInfo.progress));
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + (progress * Math.PI * 2);

    // Determine color based on progress
    let color;
    if (progress < 0.33) {
        color = `rgb(255, ${Math.floor(255 * (progress / 0.33))}, 0)`; // Red to Orange
    } else if (progress < 0.66) {
        color = `rgb(${255 - Math.floor(255 * ((progress - 0.33) / 0.33))}, 255, 0)`; // Orange to Yellow
    } else {
        color = `rgb(0, 255, ${Math.floor(255 * ((progress - 0.66) / 0.34))})`; // Yellow to Green
    }
     // A simpler green for the final stage
    if (progress >= 0.99) {
        color = 'rgb(0, 255, 0)';
    }


    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.arc(iconCenterX, iconCenterY, iconRadius, startAngle, endAngle);
    ctx.stroke();
}


function drawEnergyBar(ctx, player, screenX, usernameTagY, usernameFontSize) {
    if (player.energy.timestamps.length === 0) return;

    const barFontSize = usernameFontSize * 0.7; 
    ctx.font = `${barFontSize}px monospace`; 
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const verticalOffset = 2;
    const barY = usernameTagY + verticalOffset;

    const blockWidth = ctx.measureText(FILLED_BLOCK).width;
    const totalBarWidth = blockWidth * MAX_ENERGY_SLOTS;
    const startX = screenX - totalBarWidth / 2;

    const totalEnergyCells = player.energy.timestamps.length;
    
    const remainingRatio = 1 - player.energy.currentCellDrainRatio;
    const partialBlockIndex = Math.max(0, Math.min(PARTIAL_BLOCKS.length - 1, Math.floor(remainingRatio * PARTIAL_BLOCKS.length)));

    for (let i = 0; i < MAX_ENERGY_SLOTS; i++) {
        let block = EMPTY_BLOCK_VISUAL;
        let isDrainingCell = false;

        if (i < totalEnergyCells) {
            const cellIndex = totalEnergyCells - 1 - i; 

            if (cellIndex === 0) {
                block = PARTIAL_BLOCKS[partialBlockIndex];
                isDrainingCell = true;
            } else if (cellIndex > 0) {
                block = FILLED_BLOCK;
            }
        } 

        const currentBlockCenterX = startX + (i * blockWidth) + (blockWidth / 2);

        ctx.save(); 

        if (i < totalEnergyCells) {
            if (isDrainingCell) {
                const alpha = 0.6 + player.energy.flashState * 0.4; 
                ctx.fillStyle = `rgba(${BASE_COLOR_RGB}, ${alpha})`;
            } else {
                ctx.fillStyle = FILLED_COLOR;
            }
        } else {
            ctx.fillStyle = EMPTY_COLOR_ALPHA;
        }

        ctx.fillText(block, currentBlockCenterX, barY);
        ctx.restore(); 
    }
}

export function renderPlayer(ctx, player, tileSize, cameraX, cameraY) {
    const radius = tileSize / 2.5;
    const screenX = ((player.pixelX + player.offsetX) * tileSize) - cameraX;
    const screenY = ((player.pixelY + player.offsetY) * tileSize) - cameraY;

    ctx.save();	

    ctx.fillStyle = player.color;
    ctx.beginPath();
    ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(screenX, screenY, radius, 0, Math.PI * 2);
    ctx.stroke();

    const baseFontSize = Math.max(12, tileSize * 0.6); 
    const fontSize = Math.max(10, baseFontSize * (2/3));
    ctx.font = `${fontSize}px Arial, sans-serif`;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    ctx.fillStyle = 'white';
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.lineWidth = 3;

    const tagY = screenY - radius - 18;

    ctx.strokeText(player.username, screenX, tagY);
    ctx.fillText(player.username, screenX, tagY);

    if (player.isPowered()) {
        drawEnergyBar(ctx, player, screenX, tagY, fontSize);
        drawSkillIndicator(ctx, player, screenX, tagY, fontSize);
    }

    ctx.restore();
}