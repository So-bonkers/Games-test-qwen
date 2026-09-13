import { HIGH_SCORE_KEY } from '@/core/GameConfig';
import type { DebugHook } from '@/contracts/debug';

function requireElement(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id} not found in index.html`);
  return el;
}

export class UI {
  private readonly menuScreen = requireElement('menu-screen');
  private readonly gameoverScreen = requireElement('gameover-screen');
  private readonly hud = requireElement('hud');
  private readonly menuHighScore = requireElement('menu-highscore');
  private readonly finalScore = requireElement('final-score');
  private readonly finalHighScore = requireElement('final-highscore');
  private readonly hudScore = requireElement('hud-score');
  private readonly hudCoins = requireElement('hud-coins');
  private readonly hudMagnet = requireElement('hud-magnet');
  private readonly hudSneakers = requireElement('hud-sneakers');
  private readonly hudJetpack = requireElement('hud-jetpack');
  private readonly hudHoverboard = requireElement('hud-hoverboard');

  constructor(onPlay: () => void, onRestart: () => void) {
    requireElement('btn-play').addEventListener('click', onPlay);
    requireElement('btn-restart').addEventListener('click', onRestart);
    this.menuHighScore.textContent = `High Score: ${UI.readHighScore()}`;
  }

  static readHighScore(): number {
    return Number(localStorage.getItem(HIGH_SCORE_KEY) ?? '0');
  }

  update(hook: DebugHook): void {
    this.menuScreen.hidden = hook.state !== 'menu';
    this.gameoverScreen.hidden = hook.state !== 'gameover';
    this.hud.hidden = hook.state !== 'playing';

    if (hook.state === 'gameover') {
      this.finalScore.textContent = `Score: ${hook.world.score}`;
      this.finalHighScore.textContent = `High Score: ${UI.readHighScore()}`;
    }

    this.hudScore.textContent = `Score: ${hook.world.score}`;
    this.hudCoins.textContent = `Coins: ${hook.world.coins}`;

    this.hudMagnet.hidden = hook.powerUp.magnetRemaining <= 0;
    this.hudMagnet.textContent = `Magnet: ${Math.ceil(hook.powerUp.magnetRemaining)}s`;

    this.hudSneakers.hidden = hook.powerUp.sneakersRemaining <= 0;
    this.hudSneakers.textContent = `Sneakers: ${Math.ceil(hook.powerUp.sneakersRemaining)}s`;

    this.hudJetpack.hidden = hook.powerUp.jetpackRemaining <= 0;
    this.hudJetpack.textContent = `Jetpack: ${Math.ceil(hook.powerUp.jetpackRemaining)}s`;

    this.hudHoverboard.hidden = hook.powerUp.hoverboardCharges <= 0;
    this.hudHoverboard.textContent = `Hoverboard x${hook.powerUp.hoverboardCharges}`;
  }
}
