const { ccclass, property } = cc._decorator;

@ccclass
export default class PlayerCamera extends cc.Component {
    private target: cc.Node | null = null;
    private boundsEnabled: boolean = false;
    private boundsLeft: number = 0;
    private boundsRight: number = 0;
    private boundsBottom: number = 0;
    private boundsTop: number = 0;
    private loggedViewSize: boolean = false;

    @property
    followX: boolean = true;

    @property
    followY: boolean = false;

    setTarget(target: cc.Node) {
        this.target = target;
    }

    setWorldBounds(left: number, right: number, bottom: number, top: number) {
        this.boundsEnabled = true;
        this.boundsLeft = left;
        this.boundsRight = right;
        this.boundsBottom = bottom;
        this.boundsTop = top;
        cc.log(`Camera bounds set to: left=${left}, right=${right}, bottom=${bottom}, top=${top}`);
    }

    lateUpdate(dt: number) {
        if (!this.target) {
            return;
        }

        const targetWorldPos = this.target.convertToWorldSpaceAR(cc.Vec2.ZERO);
        const parent = this.node.parent;

        if (!parent) {
            return;
        }

        const current = this.node.position;
        let targetWorldX = this.followX ? targetWorldPos.x : this.node.convertToWorldSpaceAR(cc.Vec2.ZERO).x;
        let targetWorldY = this.followY ? targetWorldPos.y : this.node.convertToWorldSpaceAR(cc.Vec2.ZERO).y;

        if (this.boundsEnabled) {
            const camera = this.getComponent(cc.Camera);
            const bottomLeft = camera.getScreenToWorldPoint(cc.v2(0, 0));
            const topRight = camera.getScreenToWorldPoint(cc.v2(cc.winSize.width, cc.winSize.height));
            const halfWidth = (topRight.x - bottomLeft.x) / 2;
            const halfHeight = (topRight.y - bottomLeft.y) / 2;

            if (!this.loggedViewSize) {
                this.loggedViewSize = true;
                cc.log(`Camera half view: width=${halfWidth}, height=${halfHeight}`);
            }

            if (this.followX) {
                targetWorldX = this.clamp(targetWorldX, this.boundsLeft + halfWidth, this.boundsRight - halfWidth);
            }

            if (this.followY) {
                targetWorldY = this.clamp(targetWorldY, this.boundsBottom + halfHeight, this.boundsTop - halfHeight);
            }
        }

        const targetLocalPos = parent.convertToNodeSpaceAR(cc.v2(targetWorldX, targetWorldY));

        this.node.setPosition(
            targetLocalPos.x,
            targetLocalPos.y,
            current.z
        );
    }

    private clamp(value: number, min: number, max: number): number {
        if (min > max) {
            return (min + max) / 2;
        }

        return Math.max(min, Math.min(max, value));
    }
}
