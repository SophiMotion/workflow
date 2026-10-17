# ABB IRB 6700-235/2.65 model provenance

- Source: [ROS-Industrial abb_irb6700_support](https://github.com/ros-industrial/abb/tree/45f4769d826cf3ac62a65495f2db67b78b0c81df/abb_irb6700_support)
- Fixed revision: `45f4769d826cf3ac62a65495f2db67b78b0c81df` (noetic-devel, package 1.5.0).
- Authors listed upstream: Michael Ripperger; Levi Armstrong (SwRI). Maintained by the ROS-Industrial community.
- License: Apache-2.0. Original LICENSE, package.xml and XACRO are retained here. Asset URLs and SHA-256 hashes are in manifest.json.
- Visual and simplified collision STL files are unmodified. Visual vertex normals are smoothed at runtime, with a 36° crease threshold. Collision geometry uses the original coordinates and triangles.
- This application implements FK, analytical spherical-wrist IK and geometric collision checks using the upstream dimensions, axes, limits and velocity limits. It is not an ABB controller implementation, certified simulation or OEM commissioning package.
- Cell base placement, spot gun, BIW, fixtures, motion paths and times are application-authored teaching geometry. Installation transforms use ROS Z-up to Three.js Y-up. The procedural gun's fixed local offset, rather than the separately recorded user TCP fields, determines its TCP.
- Runtime collision exclusions: adjacent link indices; the cylinder/piston linkage against links 0–4; gun-to-gun parts belonging to the same gun; gun-to-link 5/6 mounting connection; copper electrode caps/neck and small mounting hardware. These contact areas and flexible services require a dedicated contact/dress-pack model. Visibility toggles never disable collision checks.
- Welding clearance is estimated from collision mesh surfaces, not manufacturing tolerances. Full-path sampling is ≤ 0.05 s plus stage boundaries, not a continuous collision proof. J5 ±3° flags the spherical wrist singular neighborhood; other singularities, joint acceleration and dynamics are not validated.
