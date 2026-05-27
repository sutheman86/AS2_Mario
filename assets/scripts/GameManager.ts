// Learn TypeScript:
//  - https://docs.cocos.com/creator/manual/en/scripting/typescript.html
// Learn Attribute:
//  - https://docs.cocos.com/creator/manual/en/scripting/reference/attributes.html
// Learn life-cycle callbacks:
//  - https://docs.cocos.com/creator/manual/en/scripting/life-cycle-callbacks.html

const { ccclass, property } = cc._decorator;
import {EntityTag } from "./EntityTag";

@ccclass
export default class GameManager extends cc.Component {

    // LIFE-CYCLE CALLBACKS:
    @property
    gravity: number = -960;

    @property(cc.Prefab)
    playerPrefab: cc.Prefab | null = null;

    @property(cc.Prefab)
    enemyTurtlePrefab: cc.Prefab | null = null;

    @property(cc.Prefab)
    enemyGoombaPrefab: cc.Prefab | null = null;

    @property(cc.Prefab)
    enemyFlowerPrefab: cc.Prefab | null = null;

    @property(cc.TiledMap)
    tileMap0: cc.TiledMap | null = null;

    @property(cc.Node)
    worldNode: cc.Node | null = null;

    @property
    playerMaxLives: number = 3;

    @property(cc.Prefab)
    questionBlockPrefab: cc.Prefab | null = null;

    @property(cc.Prefab)
    mushroomPrefab: cc.Prefab | null = null;

    @property(cc.Node)
    uiOverlayNode: cc.Node | null = null;

    @property
    maxGameTimeSeconds: number = 999;

    @property(cc.Prefab)
    finishFlagPrefab: cc.Prefab | null = null;

    private playerControl: any = null;
    private enemyInstances: cc.Node[] = [];
    private questionBlockInstances: cc.Node[] = [];
    private mushroomInstances: cc.Node[] = [];
    private mapWidth: number = 0;
    private tileLayerNamesInDrawOrder: string[] =
        ["Background", "Terrain3", "Terrain2", "Terrain1", "Object Layer", "Ground"];
    private enemyZIndex: number = 9;
    private flowerZIndex: number = 1;
    private terrainLayerNames: string[] =
        ["Ground", "Terrain1", "Terrain2", "Terrain3"];
    private objectLayerNames: string[] = ["Object Layer"];
    private terrainColliders: { [layerName: string]: cc.PhysicsCollider[] } = {};
    private finishFlag: cc.Node | null = null;
    private remainingTime: number = 0;
    private playerScore: number = 0;

// NOTE: built-ins
    onLoad () {
        cc.PhysicsManager.FIXED_TIME_STEP = 1 / 60;
        cc.PhysicsManager.MAX_ACCUMULATOR = 1 / 5;

        const physics = cc.director.getPhysicsManager();
        physics.enabled = true;
        physics.enabledAccumulator = true;
        physics.gravity = cc.v2(0, this.gravity);
        cc.director.getCollisionManager().enabled = true;
        cc.log(this.tileMap0?.getProperties());

        // DEBUG: debug purpose
        // cc.director.getScheduler().setTimeScale(0.3);
    }

    start () {
        this.loadTiledMap();
        this.loadPlayer();
        this.loadEnemy("Turtle", 400, 100);
        this.loadEnemy("Flower", 432, 96);
        this.loadEnemy("Goomba", 300, 200);

        this.uiOverlayNode?.getComponent("GameUIOverlay")?.updateScore(0);
        this.remainingTime = this.maxGameTimeSeconds;
        this.uiOverlayNode?.getComponent("GameUIOverlay")?.updateTime(this.remainingTime);
        this.playerScore = 0;
        this.schedule(this.timerCountdown, 1);
    }

    // NOTE: load / initalize data
    loadEnemy(type: string = "Turtle", spawnX: number, spawnY: number) {
        const classKey = `Enemy${type}Control`;


        cc.log("Instantiating enemy");

        const targetPrefab = (this as any)[`enemy${type}Prefab`]!;

        if(!targetPrefab) {
            cc.error(`Enemy ${type} prefab not set in GameManager`);
            return;
        }

        const enemyInstance = cc.instantiate(targetPrefab);
        enemyInstance.getComponent(cc.PhysicsBoxCollider).tag = EntityTag.ENEMY; 
        const enemyParent = this.tileMap0 ? this.tileMap0.node : this.worldNode || this.node;
        enemyParent.addChild(enemyInstance);
        enemyInstance.zIndex = this.getEnemyZIndex(type);
        enemyInstance.setPosition(spawnX!, spawnY!, 0);
        let enemyControl: any = enemyInstance.getComponent(classKey);

        if (!enemyControl) {
            cc.error(`Enemy ${type} prefab missing ${classKey} component`);
            return;
        }

        enemyControl.initialize(this);
        this.enemyInstances.push(enemyInstance);
    }

    getEnemyZIndex(type: string): number {
        if (type === "Flower") {
            return this.flowerZIndex;
        }

        return this.enemyZIndex;
    }

    loadTiledMap() {
        if(!this.tileMap0) {
            throw new Error("Tilemap not set in GameManager");
            return;
        }

        const mapSize = this.tileMap0.getMapSize();
        const tileSize = this.tileMap0.getTileSize();
        this.mapWidth = mapSize.width * tileSize.width * 2;
        this.setTileLayerZIndexes();

        this.terrainColliders = {};
        this.loadTerrainLayers();
        this.loadObjectLayers();

        this.finishFlag = cc.instantiate(this.finishFlagPrefab!);
        this.finishFlag.setParent(this.tileMap0.node);
        const mapProps_raw = this.tileMap0.getProperties();
        const mapProps = (mapProps_raw as any);
        if(typeof mapProps.finishX !== "number" || typeof mapProps.finishY !== "number") {
            cc.error("Invalid finish flag position in tilemap properties");
        } else {
            const flagX = mapProps.finishX * tileSize.width - tileSize.width / 2;
            const flagY = mapProps.finishY * tileSize.height - tileSize.height;
            cc.log(`Finish flag position from tilemap properties: (${flagX}, ${flagY})`);
            this.finishFlag.setPosition(flagX, flagY, 0);
        }
    }

    loadTerrainLayers() {
        if(!this.tileMap0) {
            cc.error("Tilemap not set in GameManager");
            return;
        }
        for (const layerName of this.terrainLayerNames) {
            const group = this.tileMap0.getObjectGroup(layerName);

            if (!group) {
                cc.warn(`Terrain layer '${layerName}' not found in tilemap`);
                continue;
            }

            this.terrainColliders[layerName] = [];

            for (const obj of group.getObjects()) {
                const collider = this.createTerrainCollider(layerName, obj);
                if (layerName === "Ground" && collider) {
                    collider.tag = EntityTag.GROUND;
                    cc.log(`Tagged collider for ${layerName} as Ground`);
                }

                if (collider) {
                    this.terrainColliders[layerName].push(collider);
                    cc.log(`Collider created for ${layerName}: ${obj.name || obj.id}`);
                }
            }
        }
    }

    setTileLayerZIndexes() {
        if(!this.tileMap0) {
            cc.error("Tilemap not set in GameManager");
            return;
        }

        for (let i = 0; i < this.tileLayerNamesInDrawOrder.length; i++) {
            const layerName = this.tileLayerNamesInDrawOrder[i];
            const layer = this.tileMap0.getLayer(layerName);

            if (!layer) {
                cc.warn(`Tile layer '${layerName}' not found in tilemap`);
                continue;
            }

            layer.node.zIndex = i * 2;
            cc.log(`Tile layer '${layerName}' zIndex set to ${layer.node.zIndex}`);
        }
    }

    loadObjectLayers() {
        if(!this.tileMap0) {
            cc.error("Tilemap not set in GameManager");
            return;
        }
        for (const layerName of this.objectLayerNames) {
            const group = this.tileMap0.getObjectGroup(layerName);

            if (!group) {
                cc.warn(`Object layer '${layerName}' not found in tilemap`);
                continue;
            }

            for (const obj of group.getObjects()) {
                this.loadMapObject(layerName, obj);
            }
        }
    }

    loadMapObject(layerName: string, obj: any) {
        this.debugTiledObject(layerName, obj);
        if(!obj.kind) {
            cc.warn(`Object ${obj.name || obj.id} has no kind`);
            return;
        }

        if (obj.kind === "block") {
            cc.log(`Found block object: ${obj.name || obj.id}`);
            const blockNode = cc.instantiate(this.questionBlockPrefab!);
            blockNode.setParent(this.tileMap0!.node);
            blockNode.setPosition(
                obj.x + obj.width / 2,
                obj.y - obj.height / 2,
                0
            );

            this.questionBlockInstances.push(blockNode);
            return;
        }

        cc.warn(`Unhandled map object type '${obj.kind}' on ${layerName}: ${obj.name || obj.id}`);
    }

    loadPlayerSetCameraBounds(playerCamera: any) {
        if (!this.tileMap0) {
            return;
        }

        const mapSize = this.tileMap0.getMapSize();
        const tileSize = this.tileMap0.getTileSize();
        const mapWidth = mapSize.width * tileSize.width;
        const mapHeight = mapSize.height * tileSize.height;
        const bottomLeft = this.tileMap0.node.convertToWorldSpaceAR(cc.v2(0, 0));
        const topRight = this.tileMap0.node.convertToWorldSpaceAR(cc.v2(mapWidth, mapHeight));

        playerCamera.setWorldBounds(
            bottomLeft.x,
            topRight.x,
            bottomLeft.y,
            topRight.y
        );
    }

    loadPlayer() {

        if(!this.tileMap0) {
            cc.error("Tilemap not set in GameManager");
            return;
        }

        if(!this.playerPrefab) {
            cc.error("Player prefab not set in GameManager");
            return;
        }
        cc.log("Instantiating player");

        const playerInstance = cc.instantiate(this.playerPrefab);
        const playerParent = this.worldNode || this.node;
        const mapProps_raw = this.tileMap0.getProperties();
        const mapProps=  (mapProps_raw as any);
        playerParent.addChild(playerInstance);
        this.playerControl = playerInstance.getComponent("PlayerControl");

        if (!this.playerControl) {
            cc.error("Player prefab does not have PlayerControl component");
            return;
        }

        if(typeof mapProps.playerSpawnX !== "number" || typeof mapProps.playerSpawnY !== "number") {
            cc.error("Tilemap missing playerSpawnX or playerSpawnY properties");
            return;
        }
        const tileSize = this.tileMap0.getTileSize();
        const spawnX = 
            mapProps.playerSpawnX * 2 * tileSize.width - 0.5 * tileSize.width;
        const spawnY = mapProps.playerSpawnY * 2 * tileSize.height - 0.5 * tileSize.height;
        cc.log(`Player spawn position from tilemap properties: (${spawnX}, ${spawnY})`);

        this.playerControl.setGameManager(this);
        this.playerControl.initializePlayer(
            this.playerMaxLives, 
            this.mapWidth, 
            cc.v3(spawnX, spawnY, 0)
        );

        const mainCamera = cc.Camera.main;
        if(!mainCamera) {
            cc.error("Main camera not found in scene");
            return;
        }

        const playerCamera = mainCamera.getComponent("PlayerCamera");
        if (!playerCamera) {
            cc.error("Main camera does not have PlayerCamera component");
            return;
        }
        this.loadPlayerSetCameraBounds(playerCamera);
        playerCamera.setTarget(playerInstance);

    }

    // NOTE: creating / destroying objects
    createTerrainCollider(layerName: string, obj: any): cc.PhysicsCollider | null {
        if(!this.tileMap0) {
            cc.error("Tilemap not set in GameManager");
            return null;
        }

        const colliderNode_raw = new cc.Node(`${layerName}_Collider_${obj.name || obj.id}`);
        const colliderNode = (colliderNode_raw as any);
        colliderNode.setParent(this.tileMap0.node);
        colliderNode["terrainLayerName"] = layerName;
        colliderNode["isLayeredTerrain"] = layerName !== "Ground" && this.terrainLayerNames.indexOf(layerName) >= 0;

        const body = colliderNode.addComponent(cc.RigidBody);
        body.type = cc.RigidBodyType.Static;

        const points = obj.points || obj.polygonPoints;

        if (points && points.length) {
            const collider = colliderNode.addComponent(cc.PhysicsPolygonCollider);
            colliderNode.setPosition(obj.x, obj.y, 0);
            collider.points = points.map((point: any) => cc.v2(point.x, point.y));
            collider.friction = 0.8;
            collider.apply();
            collider["terrainPoints"] = collider.points.map((point: cc.Vec2) => {
                return cc.v2(colliderNode.x + point.x, colliderNode.y + point.y);
            });
            return collider;
        }

        if (!obj.width || !obj.height) {
            cc.warn(`Skipping object ${obj.name || obj.id}: missing width/height`);
            colliderNode.destroy();
            return null;
        }

        const collider = colliderNode.addComponent(cc.PhysicsBoxCollider);
        collider.size = new cc.Size(obj.width, obj.height);
        colliderNode.setPosition(
            obj.x + obj.width / 2,
            obj.y - obj.height / 2,
            0
        );
        collider.apply();
        collider["terrainLeft"] = obj.x;
        collider["terrainRight"] = obj.x + obj.width;
        collider["terrainTop"] = obj.y;
        cc.log(`Created collider for ${layerName} at (${colliderNode.x}, ${colliderNode.y}) terrainTop: ${collider["terrainTop"]}`);
        return collider;
    }

    spawnMushroomFromBlock(blockNode: cc.Node) {
        if (!this.mushroomPrefab) {
            cc.error("Mushroom prefab not set in GameManager");
            return;
        }

        const mushroom = cc.instantiate(this.mushroomPrefab);
        const parent = blockNode.parent || this.worldNode || this.node;
        parent.addChild(mushroom);

        const blockCollider = blockNode.getComponent(cc.PhysicsBoxCollider);
        const mushroomCollider = mushroom.getComponent(cc.PhysicsBoxCollider);
        const blockHalfHeight = blockCollider ? blockCollider.size.height / 2 : blockNode.height / 2;
        const mushroomHalfHeight = mushroomCollider ? mushroomCollider.size.height / 2 : mushroom.height / 2;

        mushroom.getComponent("MushroomControl").setGameManager(this);

        mushroom.setPosition(
            blockNode.x,
            blockNode.y + blockHalfHeight + mushroomHalfHeight + 2,
            0
        );

        const rb = mushroom.getComponent(cc.RigidBody);
        if (rb) {
            rb.enabledContactListener = true;
            rb.linearVelocity = cc.v2(0, 0);
        } else {
            cc.error("Mushroom prefab is missing RigidBody");
        }

        if (mushroomCollider) {
            mushroomCollider.tag = EntityTag.MUSHROOM;
            mushroomCollider.sensor = false;
            mushroomCollider.apply();
        } else {
            cc.error("Mushroom prefab is missing PhysicsBoxCollider");
        }

        this.mushroomInstances.push(mushroom);
        cc.log(`Spawned mushroom at (${mushroom.x}, ${mushroom.y})`);
    }

    // NOTE: rulesets
    shouldAllowPlayerTerrainContact(playerCollider: cc.PhysicsCollider, terrainCollider: cc.PhysicsCollider): boolean {
        if (!this.tileMap0 || !playerCollider || !terrainCollider) {
            return true;
        }

        if(terrainCollider.tag === EntityTag.GROUND) { 
            cc.log("PlayerControl: Contact with Ground layer, allowing contact");
            return true; 
        }


        const playerAabb = (playerCollider as any).getAABB();
        const playerBottomLeftMap = this.tileMap0.node.convertToNodeSpaceAR(cc.v2(playerAabb.xMin, playerAabb.yMin));
        const playerBottomRightMap = this.tileMap0.node.convertToNodeSpaceAR(cc.v2(playerAabb.xMax, playerAabb.yMin));
        const playerLeftMapX = Math.min(playerBottomLeftMap.x, playerBottomRightMap.x);
        const playerRightMapX = Math.max(playerBottomLeftMap.x, playerBottomRightMap.x);
        const playerBottomMapY = Math.min(playerBottomLeftMap.y, playerBottomRightMap.y);
        const surfaceY = this.getColliderSurfaceYInXRange(terrainCollider, playerLeftMapX, playerRightMapX);

        if (surfaceY === null) {
            return false;
        }

        const targetSurfaceY = this.getHighestReachableTerrainSurfaceYInXRange(
            playerLeftMapX,
            playerRightMapX,
            playerBottomMapY
        );

        if (targetSurfaceY === null) {
            return false;
        }

        return Math.abs(surfaceY - targetSurfaceY) <= 8;
    }

    // NOTE: getter
    getHighestReachableTerrainSurfaceYInXRange(playerLeftMapX: number, playerRightMapX: number, playerBottomMapY: number): number | null {
        let highestSurfaceY: number | null = null;
        const tolerance = 4;

        for (const layerName of this.terrainLayerNames) {
            for (const collider of this.terrainColliders[layerName] || []) {
                const surfaceY = this.getColliderSurfaceYInXRange(collider, playerLeftMapX, playerRightMapX);

                if (surfaceY === null || playerBottomMapY < surfaceY - tolerance) {
                    continue;
                }

                if (highestSurfaceY === null || surfaceY > highestSurfaceY) {
                    highestSurfaceY = surfaceY;
                }
            }
        }

        return highestSurfaceY;
    }

    getHighestReachableTerrainSurfaceY(playerMapX: number, playerBottomMapY: number): number | null {
        let highestSurfaceY: number | null = null;
        const tolerance = 4;

        for (const layerName of this.terrainLayerNames) {
            for (const collider of this.terrainColliders[layerName] || []) {
                const surfaceY = this.getColliderSurfaceYAtX(collider, playerMapX);

                if (surfaceY === null || playerBottomMapY < surfaceY - tolerance) {
                    continue;
                }

                if (highestSurfaceY === null || surfaceY > highestSurfaceY) {
                    highestSurfaceY = surfaceY;
                }
            }
        }

        return highestSurfaceY;
    }

    getColliderSurfaceYAtX(collider_a: cc.PhysicsCollider, playerMapX: number): number | null {
        const collider = (collider_a as any);
        const points = collider["terrainPoints"] as cc.Vec2[];

        if (points && points.length >= 2) {
            return this.getPolygonSurfaceYAtX(points, playerMapX);
        }

        const left = collider["terrainLeft"];
        const right = collider["terrainRight"];

        if (left === undefined || right === undefined || playerMapX < left || playerMapX > right) {
            return null;
        }

        return collider["terrainTop"];
    }

    getColliderSurfaceYInXRange(collider_a: cc.PhysicsCollider, playerLeftMapX: number, playerRightMapX: number): number | null {
        const collider = collider_a as any;
        const points = collider["terrainPoints"] as cc.Vec2[];
        const leftX = Math.min(playerLeftMapX, playerRightMapX);
        const rightX = Math.max(playerLeftMapX, playerRightMapX);

        if (points && points.length >= 2) {
            return this.getPolygonSurfaceYInXRange(points, leftX, rightX);
        }

        const terrainLeft = collider["terrainLeft"];
        const terrainRight = collider["terrainRight"];

        if (terrainLeft === undefined || terrainRight === undefined || rightX < terrainLeft || leftX > terrainRight) {
            return null;
        }

        return collider["terrainTop"];
    }

    getPolygonSurfaceYAtX(points: cc.Vec2[], playerMapX: number): number | null {
        let surfaceY: number | null = null;

        for (let i = 0; i < points.length; i++) {
            const a = points[i];
            const b = points[(i + 1) % points.length];
            const minX = Math.min(a.x, b.x);
            const maxX = Math.max(a.x, b.x);

            if (playerMapX < minX || playerMapX > maxX || a.x === b.x) {
                continue;
            }

            const t = (playerMapX - a.x) / (b.x - a.x);
            const y = a.y + (b.y - a.y) * t;

            if (surfaceY === null || y > surfaceY) {
                surfaceY = y;
            }
        }

        return surfaceY;
    }

    getPolygonSurfaceYInXRange(points: cc.Vec2[], playerLeftMapX: number, playerRightMapX: number): number | null {
        let surfaceY: number | null = null;

        for (let i = 0; i < points.length; i++) {
            const a = points[i];
            const b = points[(i + 1) % points.length];

            if (a.x === b.x) {
                continue;
            }

            const segmentLeftX = Math.min(a.x, b.x);
            const segmentRightX = Math.max(a.x, b.x);
            const overlapLeftX = Math.max(playerLeftMapX, segmentLeftX);
            const overlapRightX = Math.min(playerRightMapX, segmentRightX);

            if (overlapLeftX > overlapRightX) {
                continue;
            }

            const leftT = (overlapLeftX - a.x) / (b.x - a.x);
            const rightT = (overlapRightX - a.x) / (b.x - a.x);
            const leftY = a.y + (b.y - a.y) * leftT;
            const rightY = a.y + (b.y - a.y) * rightT;
            const segmentSurfaceY = Math.max(leftY, rightY);

            if (surfaceY === null || segmentSurfaceY > surfaceY) {
                surfaceY = segmentSurfaceY;
            }
        }

        return surfaceY;
    }

    getGroundSurfaceYAtWorldX(worldX: number): number | null {
        if (!this.tileMap0) {
            return null;
        }

        const mapPoint = this.tileMap0.node.convertToNodeSpaceAR(cc.v2(worldX, 0));
        let highestSurfaceY: number | null = null;

        for (const collider of this.terrainColliders["Ground"] || []) {
            const surfaceY = this.getColliderSurfaceYAtX(collider, mapPoint.x);

            if (surfaceY === null) {
                continue;
            }

            if (highestSurfaceY === null || surfaceY > highestSurfaceY) {
                highestSurfaceY = surfaceY;
            }
        }

        if (highestSurfaceY === null) {
            return null;
        }

        return this.tileMap0.node.convertToWorldSpaceAR(cc.v2(mapPoint.x, highestSurfaceY)).y;
    }

    // NOTE: Operations
    playerGrowUp() {
        this.playerControl?.growUp();
    }

    increasePlayerScore(points: number) {
        this.playerScore += points;
        this.uiOverlayNode?.getComponent("GameUIOverlay")?.updateScore(this.playerScore);
    }

    updatePlayerLives(lives: number) {
        this.uiOverlayNode?.getComponent("GameUIOverlay")?.updateLives(lives);
    }

    winGame() {
        cc.log("congratulations! You reached the finish flag and won the game!");
        cc.director.loadScene("GameWin");
    }

    timerCountdown() {
        this.remainingTime = Math.max(0, this.remainingTime - 1);
        this.uiOverlayNode?.getComponent("GameUIOverlay")?.updateTime(this.remainingTime);

        if (this.remainingTime === 0) {
            this.unschedule(this.timerCountdown);
            this.onTimerEnd();
        }
    }

    onTimerEnd() {
        cc.log("Time's up! Player ran out of time.");
        this?.playerControl?.damagePlayer(true);
    }

    damagePlayer() {
        this.playerControl?.damagePlayer();
    }


    gameOver() {
        cc.log("Game Over! Restarting game...");
        cc.director.loadScene("GameOver");
    }

    // NOTE: callback
    questionBlockHit(blockNode: cc.Node) {
        cc.log(`Question block hit: ${blockNode.name}`);
        const index = this.questionBlockInstances.indexOf(blockNode);
        if (index >= 0) {
            this.questionBlockInstances.splice(index, 1);
            this.spawnMushroomFromBlock(blockNode);
            blockNode.destroy();
        } else {
            cc.warn("Hit question block that is not tracked in GameManager");
        }
    }

    // NOTE: debug utility
    debugTiledObject(layerName: string, obj: any) {
        const fields: string[] = [];

        for (const key in obj) {
            const value = obj[key];

            if (value === null || value === undefined) {
                fields.push(`${key}=${value}`);
            } else if (typeof value === "object") {
                fields.push(`${key}={${Object.keys(value).join(",")}}`);
            } else {
                fields.push(`${key}=${value}`);
            }
        }

        cc.log(`[${layerName}] object ${obj.name || obj.id}: ${fields.join("; ")}`);
    }
}
