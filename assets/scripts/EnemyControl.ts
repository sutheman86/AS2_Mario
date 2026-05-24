const { ccclass, property } = cc._decorator;

@ccclass
export default class EnemyControl extends cc.Component {
    private static readonly PLAYER_TAG = 11;
    private static readonly ENEMY_TAG = 7;

    @property
    speed: number = 60;

    private rb: cc.RigidBody | null = null;
    private direction: number = -1;
    private gameManager: any = null;
    private collider: cc.PhysicsBoxCollider | null = null;

    @property
    ledgeLookAhead: number = 24;

    @property
    maxGroundDrop: number = 24;

    setGameManager(gameManager: any) {
        this.gameManager = gameManager;
    }

    onLoad() {
        this.rb = this.getComponent(cc.RigidBody);

        if (this.rb) {
            this.rb.enabledContactListener = true;
        }
        this.collider = this.getComponent(cc.PhysicsBoxCollider);
    }

    update(dt: number) {
        if (!this.rb) return;

        this.rb.linearVelocity = cc.v2(
            this.direction * this.speed,
            this.rb.linearVelocity.y
        );

        if (this.isOnGround() && !this.hasGroundAhead()) {
            this.reverseDirection();
        }
    }

    reverseDirection() {
        this.direction *= -1;
        this.node.scaleX = Math.abs(this.node.scaleX) * this.direction;
    }

    die() {
        this.node.destroy();
    }

    onBeginContact(contact, self, other) {
        if (this.isMapCollider(other)) {
            return;
        }

        if(other.tag === EnemyControl.ENEMY_TAG) { return; }

        if (other.tag === EnemyControl.PLAYER_TAG) {
            if(other.node.y > this.node.y + this.node.height / 2) {
                this.die();
            }
            else {
                this.gameManager.killPlayer();
            }
            return;
        }

        this.reverseDirection();
    }

    onPreSolve(contact: cc.PhysicsContact, self: cc.PhysicsCollider, other: cc.PhysicsCollider) {
        if (this.isMapCollider(other) && !this.isGroundCollider(other)) {
            contact.disabled = true;
            return;
        }

        if (other.tag == EnemyControl.ENEMY_TAG) {
            contact.disabled = true;
        }
    }

    private isMapCollider(other: cc.PhysicsCollider): boolean {
        return !!(other && other.node && other.node["terrainLayerName"]);
    }

    private isGroundCollider(other: cc.PhysicsCollider): boolean {
        return this.isMapCollider(other) && other.node["terrainLayerName"] === "Ground";
    }

    private hasGroundAhead(): boolean {
        if (!this.gameManager) {
            return true;
        }

        const collider = this.getComponent(cc.PhysicsBoxCollider);

        if (!collider) {
            return true;
        }

        const aabb = (collider as any).getAABB();
        const footY = aabb.yMin;
        const aheadX = this.direction < 0
            ? aabb.xMin - this.ledgeLookAhead
            : aabb.xMax + this.ledgeLookAhead;
        const groundY = this.gameManager.getGroundSurfaceYAtWorldX(aheadX);

        return groundY !== null &&
            groundY <= footY + 8 &&
            footY - groundY <= this.maxGroundDrop;
    }

    private isOnGround(): boolean {
        if (!this.gameManager) {
            return false;
        }

        const collider = this.getComponent(cc.PhysicsBoxCollider);

        if (!collider) {
            return false;
        }

        const aabb = (collider as any).getAABB();
        const centerX = (aabb.xMin + aabb.xMax) / 2;
        const groundY = this.gameManager.getGroundSurfaceYAtWorldX(centerX);

        return groundY !== null && Math.abs(aabb.yMin - groundY) <= 8;
    }
}
