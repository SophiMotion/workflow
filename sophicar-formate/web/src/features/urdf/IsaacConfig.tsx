export function IsaacConfig() {
  return (
    <div className="isaac-config">
      <label>物理引擎<select defaultValue="PhysX"><option>PhysX</option><option>ROS 2 Gazebo</option></select></label>
      <label>时间步长<div className="unit-input"><input defaultValue="0.005" inputMode="decimal" /><span>s</span></div></label>
      <label className="check-row"><input type="checkbox" defaultChecked />启用自碰撞</label>
      <label className="check-row"><input type="checkbox" defaultChecked />忽略相邻 Link 碰撞</label>
      <label>默认接触偏移<div className="unit-input"><input defaultValue="0.01" inputMode="decimal" /><span>m</span></div></label>
    </div>
  );
}
