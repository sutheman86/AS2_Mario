import { EntityTag } from "./EntityTag";
import GameManager from "./GameManager";

const {ccclass, property} = cc._decorator;

@ccclass
export default class CoinControl extends cc.Component {
    private gameManager: GameManager | null = null;
    initialize(gm: GameManager) {
        this.gameManager = gm;
    }
    onBeginContact(contact, self, other) {
        if(other.tag == EntityTag.PLAYER) {
            this.gameManager?.increasePlayerScore(100);
            this.gameManager?.playCoinSound();
            this.node.destroy();
        }
    }
}