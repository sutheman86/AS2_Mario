const {ccclass, property} = cc._decorator;

@ccclass
export default class GameUIOverlay extends cc.Component {
    @property(cc.Label)
    scoreLabel: cc.Label = null;

    @property(cc.Label)
    livesLabel: cc.Label = null;

    @property(cc.Label)
    timeLabel: cc.Label = null;

    updateScore(score: number) {
        this.scoreLabel.string = score.toString().padStart(5, "0");
    }

    updateLives(lives: number) {
        this.livesLabel.string = lives.toString()[0]
    }

    updateTime(time: number) {
        this.timeLabel.string = time.toString().padStart(3, "0");
    }
}
