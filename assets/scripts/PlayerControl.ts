// Learn TypeScript:
//  - https://docs.cocos.com/creator/manual/en/scripting/typescript.html
// Learn Attribute:
//  - https://docs.cocos.com/creator/manual/en/scripting/reference/attributes.html
// Learn life-cycle callbacks:
//  - https://docs.cocos.com/creator/manual/en/scripting/life-cycle-callbacks.html

const {ccclass, property} = cc._decorator;

enum Direction {
    LEFT = 0,
    RIGHT = 1
}

@ccclass
export default class NewClass extends cc.Component {

    private rb: cc.RigidBody = null;
    private move_pressed: [boolean, boolean] = [false, false];
    private jump_count: number = 0;
    private movement_speed: number = 100;
    private jump_speed: number = 480;
    private gameManager: any = null;

    // LIFE-CYCLE CALLBACKS:
    setGameManager(gameManager: any) {
        this.gameManager = gameManager;
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
            case cc.macro.KEY.a:
                this.move_pressed[Direction.LEFT] = false;
                break;
            case cc.macro.KEY.d:
                this.move_pressed[Direction.RIGHT] = false;
                break;
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
                }
                break;
        }
    }

    start () {
        this.rb = this.getComponent(cc.RigidBody);

        if (this.rb) {
            this.rb.enabledContactListener = true;
        }
    }

    update (dt) {
        if (this.move_pressed[Direction.LEFT]) {
            this.rb.linearVelocity = cc.v2(-this.movement_speed, this.rb.linearVelocity.y);
        } else if (this.move_pressed[Direction.RIGHT]) {
            this.rb.linearVelocity = cc.v2(this.movement_speed, this.rb.linearVelocity.y);
        } else {
            this.rb.linearVelocity = cc.v2(0, this.rb.linearVelocity.y);
        }
    }

    onBeginContact (contact, self, other) {
        if(other.tag === 4) {
            if (this.isHittingBottomOfCollider(self, other)) {
                cc.log("PlayerControl onBeginContact: hit question block");
                this.gameManager.questionBlockHit(other.node);
            }
            return;
        }

        if (!this.isTerrain(other)) {
            return;
        }

        if (!this.shouldCountAsGroundContact(self, other)) {
            return;
        }

        this.jump_count = 0;
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
        this.jump_count = 0;
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
