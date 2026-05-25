// Learn TypeScript:
//  - https://docs.cocos.com/creator/manual/en/scripting/typescript.html
// Learn Attribute:
//  - https://docs.cocos.com/creator/manual/en/scripting/reference/attributes.html
// Learn life-cycle callbacks:
//  - https://docs.cocos.com/creator/manual/en/scripting/life-cycle-callbacks.html

const { ccclass } = cc._decorator;

@ccclass
export default class GameState extends cc.Component {
    static instance: GameState | null = null;

    currentLevel: number = 0;

    onLoad() {
        if (GameState.instance) {
            this.node.destroy();
            return;
        }

        GameState.instance = this;
        cc.game.addPersistRootNode(this.node);
    }

    reset() {
        this.currentLevel = 0;
    }
}