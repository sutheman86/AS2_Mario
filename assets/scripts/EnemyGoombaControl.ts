const { ccclass, property } = cc._decorator;
import {EntityTag}from "./EntityTag";

@ccclass
export default class EnemyGoombaControl extends cc.Component {

    @property
    speed: number = 60;

    private rb: cc.RigidBody | null = null;
    private direction: number = -1;
    private gameManager: any = null;
    private collider: cc.PhysicsBoxCollider | null = null;
    private isSquashed: boolean = false;
    private anim: cc.Animation = null;
    private currentAnim: string = "";
    private visualNode: cc.Node | null = null;
    private spawnId: number | null = null;
    private hasReportedKilled: boolean = false;

    @property
    ledgeLookAhead: number = 24;

    @property
    maxGroundDrop: number = 24;

    initialize(gameManager: any, spawnId: number | null = null) {
        this.gameManager = gameManager;
        this.spawnId = spawnId;
        this.visualNode = this.node.getChildByName("Visual");
        this.anim = this.visualNode.getComponent(cc.Animation);
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
        if (this.gameManager?.isGameplayPaused?.()) {
            return;
        }

        this.rb.linearVelocity = cc.v2(
            this.direction * this.speed,
            this.rb.linearVelocity.y
        );

        if (this.isOnGround() && !this.hasGroundAhead() && !this.isSquashed) {
            this.reverseDirection();
        }

        if (this.isOutOfBounds()) {
            this.die(true);
        }
        this.updateAnimation();
    }

    reverseDirection() {
        this.direction *= -1;
        this.node.scaleX = Math.abs(this.node.scaleX) * this.direction;
    }

    private squashed() {
        this.isSquashed = true;
        this.speed = 0;
        if (this.collider) {
            this.collider.size = cc.size(16, 16);
            this.collider.apply();
        }
    }

    shellKicked(direction: number = 1) {
        this.speed = direction * 100;
    }

    private playAnimation(name: string) {
        if (!this.anim || this.currentAnim === name) {
            return;
        }

        if (!this.anim.getAnimationState(name)) {
            cc.warn(`Player animation clip '${name}' not found`);
            return;
        }

        this.currentAnim = name;
        this.anim.play(name);
    }

    private updateAnimation() {
        if (this.isSquashed) {
            this.playAnimation("goomba_squashed");
        } else {
            this.playAnimation("goomba_normal");
        }
    }

    private die(suddenDeath: boolean = false) {
        if (suddenDeath) {
            this.reportKilled();
            this.node.destroy();
            return;
        }

        if(!this.isSquashed) {
            this.squashed();
            this.scheduleOnce(() => {
                this.reportKilled();
                this.node.destroy();
            }, 2);
        }
    }

    private reportKilled() {
        if (this.hasReportedKilled) {
            return;
        }

        this.hasReportedKilled = true;
        this.gameManager?.enemyKilled(this.spawnId, this.node);
    }

    private isOutOfBounds(): boolean {
        return this.node.y < 0 || this.node.x < 0 || this.node.x > this.mapWidth;
    }

    private isOnTopOfCollider(mario: cc.PhysicsCollider, enemy: cc.PhysicsCollider): boolean {
        const marioAABB = (mario as any).getAABB();
        const enemyAABB = (enemy as any).getAABB();
        return marioAABB.yMin >= enemyAABB.yMax - 12;
    }

    private decideColliderOrientation(self: cc.PhysicsCollider, other: cc.PhysicsCollider) {
        const myAABB = (self as any).getAABB();
        const marioAABB = (other as any).getAABB();
        if(myAABB.xMin + 8 > marioAABB.xMax) { // right
            cc.log("turtle shell kicked right");
            return -1;
        }
        else if(myAABB.xMax - 8 < marioAABB.xMin) { // left
            cc.log("turtle shell kicked left");
            return 1;
        }
        cc.log("turtle shell not kicked");
        return 0;
    }

    onBeginContact(contact, self, other) {
        if (this.isMapCollider(other)) {
            return;
        }

        if(other.tag === EntityTag.ENEMY || other.tag === EntityTag.COIN) { return; }

        if (other.tag === EntityTag.PLAYER) {
            const rb = other.node.getComponent(cc.RigidBody);
            if(this.isOnTopOfCollider(other, self)) {
                this.gameManager.playStompSound();
                this.die();
                if(!this.isSquashed) {
                    this.gameManager.increasePlayerScore(200);
                }
                rb.linearVelocity = cc.v2(rb.linearVelocity.x, 360);
            }
            else {
                if (!this.isSquashed) {
                    this.gameManager.damagePlayer();
                }
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

        if (other.tag == EntityTag.ENEMY || other.tag === EntityTag.COIN) {
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
