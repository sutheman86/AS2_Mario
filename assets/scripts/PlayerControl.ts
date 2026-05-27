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
    private isDeadSequencePlaying: boolean = false;
    private isVictorySequencePlaying: boolean = false;
    private isVictoryGrounded: boolean = false;
    private victoryTransitionScheduled: boolean = false;
    private isPowerTransitionPlaying: boolean = false;

    @property(cc.Size)
    smallMarioColliderSize: cc.Size = cc.size(16, 16);

    @property(cc.Size)
    bigMarioColliderSize: cc.Size = cc.size(16, 27);

    @property
    victorySlideSpeed: number = 60;

    @property(cc.AudioClip)
    jumpSound: cc.AudioClip | null = null;

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
        if (this.isDeadSequencePlaying || this.isVictorySequencePlaying || this.isPowerTransitionPlaying || this.gameManager?.isGameplayPaused?.()) {
            return;
        }

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
        if (this.isDeadSequencePlaying || this.isVictorySequencePlaying || this.isPowerTransitionPlaying || this.gameManager?.isGameplayPaused?.()) {
            return;
        }

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
                    this.playSound(this.jumpSound);
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

        if (this.isDeadSequencePlaying) {
            return;
        }

        if (this.isPowerTransitionPlaying) {
            this.rb.linearVelocity = cc.v2(0, this.rb.linearVelocity.y);
            return;
        }

        if (this.isVictorySequencePlaying) {
            this.rb.linearVelocity = this.isVictoryGrounded
                ? cc.v2(0, 0)
                : cc.v2(0, -this.victorySlideSpeed);
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
        if (this.isDeadSequencePlaying || this.isPowerTransitionPlaying) {
            return;
        }

        if (this.isVictorySequencePlaying) {
            if (this.isVictoryGroundContact(self, other)) {
                this.landPlayer();
            }

            return;
        }

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
        if (this.isDeadSequencePlaying) {
            contact.disabled = true;
            return;
        }

        if (this.isVictorySequencePlaying) {
            if (this.isVictoryGroundContact(self, other)) {
                this.landPlayer();
            }

            return;
        }

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
        if (this.isGrowup || this.isPowerTransitionPlaying) {
            return;
        }

        this.playPowerTransition("small_grow", true);
    }

    applyGrowUp() {
        this.isGrowup = true;
        this.resizePlayerColliderKeepingBottom(this.bigMarioColliderSize);
    }

    shrinkDown() {
        if (!this.isGrowup || this.isPowerTransitionPlaying) {
            return;
        }

        this.playPowerTransition("big_shrink", false);
    }

    applyShrinkDown() {
        this.isGrowup = false;
        this.resizePlayerColliderKeepingBottom(this.smallMarioColliderSize);
    }

    private resizePlayerColliderKeepingBottom(size: cc.Size) {
        const collider = this.getComponent(cc.PhysicsBoxCollider);

        if (!collider) {
            cc.error("PlayerControl: missing PhysicsBoxCollider");
            return;
        }

        const oldBottom = collider.offset.y - collider.size.height / 2;
        collider.size = size;
        collider.offset = cc.v2(
            collider.offset.x,
            oldBottom + collider.size.height / 2
        );
        collider.apply();
    }

    damagePlayer(ignoreInvincibility: boolean = false) {
        if (this.isDeadSequencePlaying || this.isVictorySequencePlaying) {
            return;
        }

        if (this.isInvincible) {
            cc.log("Player is invincible, ignoring damage");
            return;
        }

        if (this.isGrowup && !ignoreInvincibility) {
            this.shrinkDown();
            cc.log("Player hit while growup, shrinking back down and granting temporary invincibility");
            this.isInvincible = true;
            return;
        }

        if (this.lives > 0) {
            this.lives--;
            this.gameManager?.updatePlayerLives(this.lives);
            this.playDeathSequence(this.lives <= 0);
            return;
        }

        if (this.lives <= 0) {
            this.playDeathSequence(true);
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
        this.applyShrinkDown();
        this.isInvincible = true;
        this.scheduleOnce(() => {
            this.isInvincible = false;
        }, 2);
        this.isDeadSequencePlaying = false;
        this.setColliderEnabled(true);
        this.gameManager?.setGameplayPaused(false);
        this.gameManager?.playLevelBgm();
        this.reset();
    }

    private playPowerTransition(animationName: string, shouldGrow: boolean) {
        if (this.isDeadSequencePlaying || this.isVictorySequencePlaying || this.isPowerTransitionPlaying) {
            return;
        }

        this.isPowerTransitionPlaying = true;
        this.move_pressed = [false, false];
        this.gameManager?.setGameplayPaused(true);

        if (shouldGrow) {
            this.gameManager?.playPowerUpSound?.();
        } else {
            this.gameManager?.playPowerDownSound?.();
        }

        if (this.rb) {
            this.rb.linearVelocity = cc.v2(0, this.rb.linearVelocity.y);
        }

        this.forcePlayAnimation(animationName);

        this.scheduleOnce(() => {
            if (shouldGrow) {
                this.applyGrowUp();
            } else {
                this.applyShrinkDown();
            }

            this.isPowerTransitionPlaying = false;
            this.gameManager?.setGameplayPaused(false);
            this.scheduleOnce(() => {
                this.isInvincible = false;
            }, 1.0);
        }, 2);
    }

    private playDeathSequence(isGameOver: boolean) {
        if (!this.rb || this.isDeadSequencePlaying) {
            return;
        }

        this.isDeadSequencePlaying = true;
        this.move_pressed = [false, false];
        this.landPlayer();
        this.gameManager?.setGameplayPaused(true);
        this.gameManager?.playDeathBgm?.();
        this.setColliderEnabled(false);
        this.rb.linearVelocity = cc.v2(0, 420);
        this.rb.angularVelocity = 0;
        this.forcePlayAnimation("small_die");

        this.scheduleOnce(() => {
            if (isGameOver) {
                this.gameManager?.gameOver();
            } else {
                this.respawn();
            }
        }, 3);
    }

    playVictorySequence() {
        if (!this.rb || this.isDeadSequencePlaying || this.isVictorySequencePlaying) {
            return;
        }

        this.isVictorySequencePlaying = true;
        this.isVictoryGrounded = false;
        this.victoryTransitionScheduled = false;
        this.move_pressed = [false, false];
        this.jump_count = 0;
        this.is_jumping = false;
        this.gameManager?.setGameplayPaused(true);
        this.gameManager?.playVictoryBgm?.();
        this.rb.linearVelocity = cc.v2(0, -this.victorySlideSpeed);
        this.rb.angularVelocity = 0;
        this.forcePlayAnimation(this.isGrowup ? "big_win" : "small_win");
    }

    private isOutOfBounds(): boolean {
        return this.node.y < 0 || this.node.x < 0 || this.node.x > this.mapWidth;
    }

    private landPlayer() {
        this.jump_count = 0;
        this.is_jumping = false;

        if (this.isVictorySequencePlaying) {
            this.scheduleVictoryTransitionAfterLanding();
            return;
        }

        this.gameManager?.startTimerAfterPlayerGroundContact?.();
    }

    private scheduleVictoryTransitionAfterLanding() {
        if (this.victoryTransitionScheduled) {
            return;
        }

        this.isVictoryGrounded = true;
        this.victoryTransitionScheduled = true;

        if (this.rb) {
            this.rb.linearVelocity = cc.v2(0, 0);
            this.rb.angularVelocity = 0;
        }

        this.scheduleOnce(() => {
            cc.director.loadScene("GameWin");
        }, 2);
    }

    private isVictoryGroundContact(self: cc.PhysicsCollider, other: cc.PhysicsCollider): boolean {
        if (other.tag === EntityTag.QUESTION_BLOCK) {
            return this.isOnTopOfCollider(self, other);
        }

        if (!this.isTerrain(other)) {
            return false;
        }

        return this.shouldCountAsGroundContact(self, other);
    }

    private updateAnimation() {
        const variant = this.isGrowup ? "big" : "small";
        if(this.anim.getAnimationState(`${variant}_jump`)?.isPlaying && !this.is_jumping) {
            return;
        }
        const isMoving = 
            (!this.move_pressed[Direction.LEFT] && this.move_pressed[Direction.RIGHT]) ||
            (this.move_pressed[Direction.LEFT] && !this.move_pressed[Direction.RIGHT]);
        const isJumping = this.is_jumping;
        const isFalling = this.rb.linearVelocity.y < 0 || (this.jump_count > 0 && !isJumping);
        let desiredAnim = `${variant}_idle`;
        if(isJumping) {
            this.anim.play(`${variant}_jump`);
            this.is_jumping = false;
            return;
        } 

        if (isFalling) {
            desiredAnim = `${variant}_fall`;
        } else if (isMoving) {
            desiredAnim = `${variant}_run`;
        } else {
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

    private forcePlayAnimation(name: string) {
        if (!this.anim) {
            return;
        }

        if (!this.anim.getAnimationState(name)) {
            cc.warn(`Player animation clip '${name}' not found`);
            return;
        }

        this.currentAnim = name;
        this.anim.play(name, 0);
    }

    private playSound(sound: cc.AudioClip | null) {
        if (!sound) {
            return;
        }

        cc.audioEngine.playEffect(sound, false);
    }

    private setColliderEnabled(enabled: boolean) {
        const collider = this.getComponent(cc.PhysicsCollider);

        if (collider) {
            collider.enabled = enabled;
        }
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
