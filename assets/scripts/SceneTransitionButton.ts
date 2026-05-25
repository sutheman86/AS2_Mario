const { ccclass, property } = cc._decorator;

@ccclass
export default class MainMenu extends cc.Component {
    @property
    targetScene: string = "GameStart";

    onStartClicked() {
        cc.log(`Start clicked, preloading scene: ${this.targetScene}`);
        cc.director.preloadScene(this.targetScene, (error: Error) => {
            if (error) {
                cc.error(`Failed to load scene '${this.targetScene}': ${error.message}`);
                return;
            }

            cc.log(`Preloaded scene: ${this.targetScene}`);
            const started = cc.director.loadScene(this.targetScene, () => {
                cc.log(`Loaded scene: ${this.targetScene}`);
            });

            if (!started) {
                cc.error(`Could not start loading scene '${this.targetScene}'`);
            }
        });
    }
}
