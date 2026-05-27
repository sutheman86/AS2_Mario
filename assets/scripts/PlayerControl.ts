// Learn TypeScript:
//  - https://docs.cocos.com/creator/manual/en/scripting/typescript.html
// Learn Attribute:
//  - https://docs.cocos.com/creator/manual/en/scripting/reference/attributes.html
// Learn life-cycle callbacks:
//  - https://docs.cocos.com/creator/manual/en/scripting/life-cycle-callbacks.html

const {ccclass, property} = cc._decorator;
import { EntityTag} from "./EntityTag";
enum Direction {
    LEFT = 0,
    RIGHT = 1,
    NONE = 2,
}

@ccclass
export default class PlayerControl extends cc.Component {

    private rb: cc.RigidBody = null;
    private move_pressed: [boolean, boolean] = [false, false];
    private movement_speed: number = 100;
    private jump_speed: number = 480;
    private jump_count: number = 0;
    private is_jumping: boolean = false;
    private gameManager: any = null;
    private lives: number = 0;
    private mapWidth: number = 0;
    private spawnPosition: cc.Vec3 = cc.v3(100, 200, 0);
    private isGrowup: boolean = false;
    private isInvincible: boolean = false;
    private pendingRespawn: boolean = false;
    private anim: cc.Animation = null;
    private currentAnim: string = "";

    @property(cc.Size)
    smallMarioColliderSize: cc.Size = cc.size(16, 16);

    @property(cc.Size)
    bigMarioColliderSize: cc.Size = cc.size(16, 27);

    // LIFE-CYCLE CALLBACKS:
    setGameManager(gameManager: any) {
        this.gameManager = gameManager;
    }

    initializePlayer(maxLives: number, mapWidth: number, spawnPosition: cc.Vec3) {
        this.lives = maxLives;
        this.mapWidth = mapWidth;
        this.spawnPosition = spawnPosition;
        this.node.setPosition(this.spawnPosition);
        this.gameManager?.updatePlayerLives(this.lives);
    }

    setMovementSpeed(speed: number) {
        this.movement_speed = speed;
    }

    setJumpSpeed(speed: number) {
        this.jump_speed = speed;
    }

    onLoad () {
        cc.systemEvent.on(cc.SystemEvent.EventType.KEY_DOWN, 
            this.onKeyDown, 
            this
        );
        cc.systemEvent.on(cc.SystemEvent.EventType.KEY_UP, 
            this.onKeyUp, 
            this
        );
    }

    onKeyDown (event: cc.Event.EventKeyboard) {
        switch(event.keyCode) {
            case cc.macro.KEY.a:
                this.move_pressed[Direction.LEFT] = true;
                break;
            case cc.macro.KEY.d:
                this.move_pressed[Direction.RIGHT] = true;
                break;
            case cc.macro.KEY.left:
                this.move_pressed[Direction.LEFT] = true;
                break;
            case cc.macro.KEY.right:
                this.move_pressed[Direction.RIGHT] = true;
                break;
        }
    }

    onKeyUp (event: cc.Event.EventKeyboard) {
        switch(event.keyCode) {
            case cc.macro.KEY.left:
                this.move_pressed[Direction.LEFT] = false;
                break;
            case cc.macro.KEY.right:
                this.move_pressed[Direction.RIGHT] = false;
                break;
            case cc.macro.KEY.space:
                if (this.jump_count < 2) {
                    this.rb.linearVelocity = cc.v2(this.rb.linearVelocity.x, this.jump_speed);
                    this.jump_count++;
                    this.is_jumping = true;
                }
                break;
        }
    }

    start () {
        this.rb = this.getComponent(cc.RigidBody);
        this.anim = this.getComponent(cc.Animation);

        if (this.rb) {
            this.rb.enabledContactListener = true;
        }

        if (!this.anim) {
            cc.warn("PlayerControl start: missing Animation component");
        }

        const playerCollider = this.getComponent(cc.PhysicsCollider);
        if (playerCollider) {
            playerCollider.enabledContactListener = true;
            playerCollider.tag = EntityTag.PLAYER;
        } else {
            cc.error("PlayerControl start: missing PhysicsCollider");
        }
    }

    update (dt) {
        if (!this.rb) {
            return;
        }

        if (this.pendingRespawn) {
            this.pendingRespawn = false;
            this.respawn();
        }

        if (this.isOutOfBounds()) {
            cc.log("Player fell off the map, resetting position");
            this.damagePlayer(true);
            cc.log(`Player lives remaining: ${this.lives}`);
        }

        this.node.setScale(this.isGrowup ? 3 : 2);

        let movement = Direction.NONE;

        if(this.move_pressed[Direction.RIGHT] && this.move_pressed[Direction.LEFT]) {
            movement = Direction.NONE;
        } else if(this.move_pressed[Direction.RIGHT]) {
            movement = Direction.RIGHT;
        } else if(this.move_pressed[Direction.LEFT]) {
            movement = Direction.LEFT;
        } else {
            movement = Direction.NONE;
        }

        if (movement === Direction.LEFT) {
            this.rb.linearVelocity = cc.v2(-this.movement_speed, this.rb.linearVelocity.y);
            this.node.scaleX = -Math.abs(this.node.scaleX);
        } else if (movement === Direction.RIGHT) {
            this.rb.linearVelocity = cc.v2(this.movement_speed, this.rb.linearVelocity.y);
            this.node.scaleX = Math.abs(this.node.scaleX);
        } else {
            this.rb.linearVelocity = cc.v2(0, this.rb.linearVelocity.y);
        }
        this.updateAnimation();
    }

    onBeginContact (contact, self, other) {
        if(other.tag === EntityTag.QUESTION_BLOCK) {
            if (this.isHittingBottomOfCollider(self, other)) {
                cc.log("PlayerControl onBeginContact: hit question block");
                this.gameManager.questionBlockHit(other.node);
                return;
            }

            if (this.isOnTopOfCollider(self, other)) {
                this.landPlayer();
            }

            return;
        }

        if (other.tag === EntityTag.FINISH) {
            this.gameManager.winGame();
            return;
        }

        if (!this.isTerrain(other)) {
            return;
        }

        if (!this.shouldCountAsGroundContact(self, other)) {
            return;
        }

        this.landPlayer();
    }

    onPreSolve(contact: cc.PhysicsContact, self: cc.PhysicsCollider, other: cc.PhysicsCollider) {
        if (!this.isLayeredTerrain(other)) {
            return;
        }

        if (!this.shouldCollideWithTerrain(self, other)) {
            contact.disabled = true;
        }
    }

    reset() {
        this.landPlayer();
    }

    growUp() {
        this.isGrowup = true;
        const collider = this.getComponent(cc.PhysicsCollider);
        collider.size = this.bigMarioColliderSize;
        collider.apply();
    }

    shrinkDown() {
        this.isGrowup = false;
        const collider = this.getComponent(cc.PhysicsCollider);
        collider.size = this.smallMarioColliderSize;
        collider.apply();
    }

    damagePlayer(ignoreInvincibility: boolean = false) {
        if (this.isInvincible) {
            cc.log("Player is invincible, ignoring damage");
            return;
        }

        if (this.isGrowup && !ignoreInvincibility) {
            this.shrinkDown();
            cc.log("Player hit while growup, shrinking back down and granting temporary invincibility");
            this.isInvincible = true;
            this.scheduleOnce(() => {
                this.isInvincible = false;
            }, 1.0);
            return;
        }

        if (this.lives > 0) {
            this.lives--;
            this.gameManager?.updatePlayerLives(this.lives);
            this.queueRespawn();
        }

        if (this.lives <= 0) {
            this.gameManager?.gameOver();
        }
    }

    queueRespawn() {
        this.pendingRespawn = true;
    }

    respawn() {
        if (this.rb) {
            this.rb.linearVelocity = cc.v2(0, 0);
            this.rb.angularVelocity = 0;
        }

        this.node.setPosition(this.spawnPosition);
        this.node.setScale(2);
        this.shrinkDown();
        this.isInvincible = false;
        this.reset();
    }

    private isOutOfBounds(): boolean {
        return this.node.y < 0 || this.node.x < 0 || this.node.x > this.mapWidth;
    }

    private landPlayer() {
        this.jump_count = 0;
        this.is_jumping = false;
    }

    private updateAnimation() {
        const variant = this.isGrowup ? "big" : "small";
        if(this.anim.getAnimationState(`${variant}_jump`)?.isPlaying && !this.is_jumping) {
            cc.log("jumping is still playing but player is not jumping, skip.");
            return;
        }
        const isMoving = 
            (!this.move_pressed[Direction.LEFT] && this.move_pressed[Direction.RIGHT]) ||
            (this.move_pressed[Direction.LEFT] && !this.move_pressed[Direction.RIGHT]);
        const isJumping = this.is_jumping;
        const isFalling = this.rb.linearVelocity.y < 0 || (this.jump_count > 0 && !isJumping);
        let desiredAnim = `${variant}_idle`;
        if(isJumping) {
            cc.log("Player is jumping");
            this.anim.play(`${variant}_jump`);
            this.is_jumping = false;
            return;
        } 

        if (isFalling) {
            cc.log("Player is falling");
            desiredAnim = `${variant}_fall`;
        } else if (isMoving) {
            desiredAnim = `${variant}_run`;
        } else {
            cc.log("Player is idle");
        }
        this.playAnimation(desiredAnim);
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

    private isLayeredTerrain(other: cc.PhysicsCollider): boolean {
        return !!(other && other.node && other.node["isLayeredTerrain"]);
    }

    private isTerrain(other: cc.PhysicsCollider): boolean {
        return !!(other && other.node && other.node["terrainLayerName"]);
    }

    private shouldCollideWithTerrain(self: cc.PhysicsCollider, other: cc.PhysicsCollider): boolean {
        if (!this.gameManager) {
            return true;
        }

        return this.gameManager.shouldAllowPlayerTerrainContact(self, other);
    }

    private shouldCountAsGroundContact(self: cc.PhysicsCollider, other: cc.PhysicsCollider): boolean {
        if (this.isLayeredTerrain(other)) {
            return this.shouldCollideWithTerrain(self, other);
        }

        return this.isOnTopOfCollider(self, other);
    }

    private isOnTopOfCollider(self: cc.PhysicsCollider, other: cc.PhysicsCollider): boolean {
        const playerAabb = (self as any).getAABB();
        const terrainAabb = (other as any).getAABB();

        return playerAabb.yMin >= terrainAabb.yMax - 8;
    }

    private isHittingBottomOfCollider(self: cc.PhysicsCollider, other: cc.PhysicsCollider): boolean {
        const playerAabb = (self as any).getAABB();
        const blockAabb = (other as any).getAABB();

        return playerAabb.yMax <= blockAabb.yMin + 8;
    }
}
