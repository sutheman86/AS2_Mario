// Learn TypeScript:
//  - https://docs.cocos.com/creator/manual/en/scripting/typescript.html
// Learn Attribute:
//  - https://docs.cocos.com/creator/manual/en/scripting/reference/attributes.html
// Learn life-cycle callbacks:
//  - https://docs.cocos.com/creator/manual/en/scripting/life-cycle-callbacks.html

const {ccclass, property} = cc._decorator;

@ccclass
export default class TransitionControl extends cc.Component {


    // LIFE-CYCLE CALLBACKS:

    // onLoad () {}
    @property
    targetScene: string = "Game";

    @property
    duration: number = 2;

    start () {
        this.scheduleOnce(() => {
            cc.director.loadScene(this.targetScene);
        }, this.duration);
    }

    // update (dt) {}
}
