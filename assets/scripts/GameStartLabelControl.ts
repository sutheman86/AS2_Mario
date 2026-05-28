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

    @property(cc.Label)
    label: cc.Label | null = null;


    // LIFE-CYCLE CALLBACKS:

    // onLoad () {}

    start () {
        this.label!.string = `LEVEL ${GameState.selectedLevel + 1}`
    }

    // update (dt) {}
}
