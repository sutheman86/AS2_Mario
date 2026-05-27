const { ccclass, property } = cc._decorator;

@ccclass
export default class MushroomControl extends cc.Component {
    @property
    speed: number = 80;

    private rb: cc.RigidBody | null = null;
    private gameManager: any = null;

    setGameManager(gameManager: any) {
        this.gameManager = gameManager;
    }

    onLoad() {
        this.rb = this.getComponent(cc.RigidBody);

        if (this.rb) {
            this.rb.enabledContactListener = true;
        }
    }

    update(dt: number) {
        if (!this.rb) {
            return;
        }

        if (this.gameManager?.isGameplayPaused?.()) {
            return;
        }

        this.rb.linearVelocity = cc.v2(
            this.speed,
            this.rb.linearVelocity.y
        );
    }

    onBeginContact(contact, self, other) {
        // Player collects mushroom
        if (other.tag === 11) {
            cc.log("Player got mushroom");
            this.node.destroy();
            this.gameManager.playerGrowUp(true);
            return;
        }

        // Terrain is not ignored.
        // No contact.disabled here.
    }
}
