const { ccclass, property } = cc._decorator;

@ccclass
export default class PhysicsDebugDraw extends cc.Component {
  @property
  drawAabb: boolean = true;

  onLoad() {
    const physics = cc.director.getPhysicsManager();

    physics.enabled = true;
    physics.debugDrawFlags = cc.PhysicsManager.DrawBits.e_shapeBit;

    if (this.drawAabb) {
      physics.debugDrawFlags |= cc.PhysicsManager.DrawBits.e_aabbBit;
    }
  }

  onDestroy() {
    cc.director.getPhysicsManager().debugDrawFlags = 0;
  }
}