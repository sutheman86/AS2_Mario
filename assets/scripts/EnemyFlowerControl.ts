const { ccclass, property } = cc._decorator;
import {EntityTag}from "./EntityTag";

export class FlowerState {
    static readonly IDLE = 0;
    static readonly GOUP = 1;
    static readonly STAY = 2;
    static readonly GODOWN = 3;
}
@ccclass
export default class EnemyFlowerControl extends cc.Component {

    @property
    speed: number = 120;

    @property
    idlePeriod: number = 5;

    @property
    stayPeriod: number = 5;

    @property
    riseHeight: number = 32;

    private rb: cc.RigidBody | null = null;
    private gameManager: any = null;
    private anim: cc.Animation | null = null;
    private currentState: number = FlowerState.IDLE;
    private bottomY: number = 0;
    private topY: number = 0;

    nextStateSwitch() {
        switch (this.currentState) {
            case FlowerState.IDLE:
                this.enterState(FlowerState.GOUP);
                break;
            case FlowerState.STAY:
                this.enterState(FlowerState.GODOWN);
                break;
        }
    }

    scheduleNextStateSwitch(delay: number) {
        this.scheduleOnce(() => {
            this.nextStateSwitch();
        }, delay);
    }

    initialize(gameManager: any) {
        this.gameManager = gameManager;
        this.anim = this.node.getComponent(cc.Animation);
        this.anim.play("flower_bite");
        this.bottomY = this.node.y;
        this.topY = this.bottomY + this.riseHeight;
        this.enterState(FlowerState.IDLE);
        this.node.zIndex = 1;
    }

    onLoad() {
        this.rb = this.getComponent(cc.RigidBody);

        if (this.rb) {
            this.rb.enabledContactListener = true;
        }
    }

    update(dt: number) {
        if (!this.rb) return;
        if (this.gameManager?.isGameplayPaused?.()) {
            return;
        }

        switch (this.currentState) {
            case FlowerState.GOUP:
                this.rb.linearVelocity = cc.v2(0, this.speed);
                if (this.node.y >= this.topY) {
                    this.node.y = this.topY;
                    this.rb.linearVelocity = cc.v2(0, 0);
                    this.enterState(FlowerState.STAY);
                }
                break;
            case FlowerState.GODOWN:
                this.rb.linearVelocity = cc.v2(0, -this.speed);
                if (this.node.y <= this.bottomY) {
                    this.node.y = this.bottomY;
                    this.rb.linearVelocity = cc.v2(0, 0);
                    this.enterState(FlowerState.IDLE);
                }
                break;
            default:
                this.rb.linearVelocity = cc.v2(0, 0);
                break;
        }
    }

    onBeginContact(contact, self, other) {
        if (this.isMapCollider(other)) {
            return;
        }

        if (other.tag === EntityTag.ENEMY) { return; }

        if (other.tag === EntityTag.PLAYER) {
            if (this.currentState !== FlowerState.STAY) {
                return;
            }

            this.gameManager.damagePlayer();
            return;
        }

    }

    onPreSolve(contact: cc.PhysicsContact, self: cc.PhysicsCollider, other: cc.PhysicsCollider) {
        if (this.isMapCollider(other) && !this.isGroundCollider(other)) {
            contact.disabled = true;
            return;
        }

        if (other.tag == EntityTag.ENEMY) {
            contact.disabled = true;
        }

        if (other.tag === EntityTag.PLAYER && this.currentState !== FlowerState.STAY) {
            contact.disabled = true;
        }
    }

    private isMapCollider(other: cc.PhysicsCollider): boolean {
        return !!(other && other.node && other.node["terrainLayerName"]);
    }

    private isGroundCollider(other: cc.PhysicsCollider): boolean {
        return this.isMapCollider(other) && other.node["terrainLayerName"] === "Ground";
    }

    private enterState(state: number) {
        this.currentState = state;

        switch (state) {
            case FlowerState.IDLE:
                this.node.y = this.bottomY;
                this.scheduleNextStateSwitch(this.idlePeriod);
                break;
            case FlowerState.STAY:
                this.node.y = this.topY;
                this.scheduleNextStateSwitch(this.stayPeriod);
                break;
        }
    }


}
