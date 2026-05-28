// Learn TypeScript:
//  - https://docs.cocos.com/creator/manual/en/scripting/typescript.html
// Learn Attribute:
//  - https://docs.cocos.com/creator/manual/en/scripting/reference/attributes.html
// Learn life-cycle callbacks:
//  - https://docs.cocos.com/creator/manual/en/scripting/life-cycle-callbacks.html

import GameState from "./GameState";

const {ccclass, property} = cc._decorator;

@ccclass
export default class NewClass extends cc.Component {
    start () {
        this.node.active = GameState.selectedLevel < GameState.MAXLEVEL;
    }

    onPressedCallback() {
        GameState.selectedLevel++;
        cc.director.loadScene("Game");
    }
}
