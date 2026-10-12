# Model 4 implementation

Source: Assembly testing website 4.step. SHA-256 a8435cbd1f3598f699c9bc4f95bd08b898c1e92c5d29baf5d6665e07fb7ed3de. 506 bodies; 839403 vertices; 889261 triangles. Neutral envelope 850 × 900 × 1875.75 mm.

## Changes from model 3

New head, grippers, motor covers, bearings and brackets; many detailed motors replaced by two-body step-motor exports. Body IDs changed substantially. Spine is 80 × 80 mm from Z56 to 1704, shoulder center Z1724/Y−20. Right arm tubes and distal hardware are about 30 mm lower than their left equivalents due to different shoulder brackets. Small right-side CAD placement rotations are preserved in source geometry. Idealized shaft axes use cardinal directions; tiny source alignment offsets are not a native joint solution.

The old nine structural-sheet mounting bodies and separate hip-swing motor axis are absent. Structural sheet remains a read-only 5 mm compatibility field. Hip swing is removed from UI and nonzero values are rejected in imported model-4 limb state. Head movement is controlled independently in the Head tab. Grippers have wrist and driven-jaw servo controls as described below.

## Body ownership

Base/body: IDs 0–24. Head: 194–266, attached to overall height. Arm L: 25–158 excluding leg IDs 159–164, plus 165–180 and 267–301. Arm R: 302–486. Leg L: 159–164 and 181–193. Leg R: 487–505. Exact stage assignments are explicit in src/limbs.ts and tested for completeness. Top base covers are 1 and 2. Named motor covers: 179,182,183,263,446,490,491.

Arm stages: first shoulder housing fixed, second housing follows lift, upper tube and twist-motor housing follow swing, elbow housing and its cover follow twist, lower output brackets/tube/gripper follow elbow. Covers are not incorrectly assigned to distal moving tubes. Leg stages: hip motor/cover fixed to hip beam, thigh and knee housing follow hip lift, lower output bracket/tube follow reversed knee bend.

Tube IDs: 153,158,161,164,437,451,496,505. Source circle centers and upper-end elevations are recorded in src/model4-tubes.json. Diameter 50, wall 2, arm lengths 200/300, leg lengths 250/250 mm. Fitted circle centers preserve small source placement differences. Radius edits apply to tubes only; clamps and motor housings remain rigid.

Arm L shaft lines: X through Y−20/Z1724; Y through X320.5/Z1724; Z through X320.5/Y−20; elbow X through Y−20/Z1374.75. Arm R mirrors shaft placement and has twist/elbow elevation 30 mm lower. Upper-arm changes move twist/elbow hardware; lower-arm changes carry all gripper bodies.

Leg hip shaft: X through Y−20/Z1008.75. Knee shaft: X through Y−20/Z697.5. Thigh tube top Z968.75; lower tube top Z657.5. Thigh changes translate knee hardware and update the pivot. Hip width changes X position from ±169.45 by half span delta; hip height/base height translate the whole leg.

## Validation and evidence

Default height 1875.75. Spine top = total height −171.75. Neutral leg clearance requires hip position ≥662.5 + (thigh−250) + (lower leg−250) mm. Arm clearance uses conservative distal-gripper minimum Z857.6 plus height/length deltas. Other base and wheel rules remain as before. These are limited envelope checks, not collision detection.

100 browser-independent TypeScript tests pass against model 4. Tests replaced obsolete source-ID assertions rather than retaining model-3 assumptions. Build passes. Neutral and posed geometry images were rendered directly from the mesh arrays and the actual application deformation/matrix functions, then visually inspected. They are not browser screenshots. No new browser verification is claimed because browser automation had been blocked by browser security policy. Local HTTP checks verify the served build and model.

Prior dated Word documentation and archives are preserved as historical snapshots, not silently overwritten with different source data.

## Hand servo preview

Each arm adds wrist_rotation −90..90° and clamp 0..45°. These user-approved limits are provisional, not hardware specifications. Zero preserves the imported geometry. Positive clamp closes the driven jaw; the geometry may overlap near 45°. No contact solver or servo electronics are simulated.

Wrist stage 5: left output 270 and mount/gripper bodies 281–296; right output 457 and bodies 468–483. Clamp stage 6 overrides left 286/297/298/299 and right 473/484/485/486. Remaining wrist housings/mounts stay at elbow stage 4. Existing renderer matrix caching separates stages 4/5/6.

Wrist axes use local Z through left (320.5, −20) and right (−320.480, −20.020). Clamp axes use normalized (1, −1, 0) through left (318.515438, −46.506058, 970.119524) and right (−322.459365, −46.537039, 939.650643). These approximate axes are inferred from the output mounts, not native CAD joints. Height, shoulder span and both arm lengths translate the pivots along with their hardware. Parent shoulder/elbow transforms compose before wrist and clamping transforms.

Configuration import accepts missing new hand fields as zero while rejecting nonnumeric, nonfinite and out-of-range angles. Legs do not expose or accept hand movement. Tests cover L/R isolation, rigid hardware ownership, limit validation, old configuration compatibility and hinge continuity after dimension changes.

## Motor specification catalog

The Motors tab holds separate left/right selections for shoulder, knee, elbow and wrist. Three editable placeholder records per side store name, type, torque, speed, voltage and ratio; missing specifications are null. No numeric motor ratings are invented. src/motors.ts validates and copies imported metadata, while src/motor-controls.ts renders it. The viewer and geometry modules do not consume this state. Save/load includes the optional motors object; missing objects default to unspecified records. Current/Option A/Option B edits are per side. Reset restores all placeholders.

Base drive motor options are available directly below the dimensions on the Base tab. Base L and Base R each provide Current motor, Option A and Option B with editable specifications, independent selection, save/load and reset. Older catalogs without base motor fields receive unspecified defaults. These selections do not change the assembly or movement.

## Export via Fusion 360

The sidebar export button opens the Fusion handoff workflow. Download the companion script ZIP and export request; run the script in Fusion with the original parametric robot design active. Native parameter mappings must be verified before use. The default mode applies dimensions and keeps the current Fusion pose; website pose mode additionally requires all 18 driving angle parameter mappings, including the head. Motor choices remain JSON metadata. The native document is not saved, and original parameter expressions are restored after the temporary export update.

See public/fusion/README.md for installation, mappings, units, pose handling and limitations. The helper uses supported Autodesk parameter-update and STEP-export APIs. 100 TypeScript tests and 10 Python tests pass; native Fusion export is not yet verified because the original .f3d/.f3z robot design has not been provided. Browser visual verification remains blocked.

## Direct STEP download

Download STEP in the sidebar generates a .step file directly in a Web Worker. It captures the dimensions, joint pose and top-cover visibility at click time. Progress, cancellation and a persistent Save STEP file link are provided. It needs no Fusion installation. Motor specification selections do not change geometry.

The file uses AP214 manifold surface representations with explicit planar triangular faces, with source component names and mm units. It is a faceted surface model, not the original smooth solid CAD or a Fusion feature history. No simplification is applied; near-zero-area triangles are skipped. A 504-part export with covers hidden generated 888,746 faces in 3.6 seconds locally and was 343,517,288 bytes (about 328 MiB). Large files can take substantial memory and time in CAD. The Fusion pathway remains available for native solid output.

Verification: all 100 TypeScript tests pass. Full model generation succeeds. A representative four-part export containing resized geometry and posed grippers was independently reimported with OpenCascade, preserving 21,436 triangles and dimensions/pose bounds within 0.001 mm. Full-model reimport and actual browser download were not verified; browser automation remains blocked. Reproduce with node scripts/verify-step-export.cjs (sample CAD round trip) or add --full (full generation).

## Head rotation and tilt

The Head tab provides independent Fixed/Movable modes, rotation −90°..90°, tilt −30°..30°, numeric inputs, sliders and Reset head. Zero is the original STEP pose. Positive tilt looks up toward the front (−Y). These are provisional, non-collision-checked limits. The neutral total height parameter still describes the unposed assembly; the measured envelope follows the pose.

Rotation uses a Z shaft through (0,−20,1787); tilt uses an X shaft through (0,−20,1824.75), translated by the total-height delta. Neck mounting and motor housing remain fixed; output shaft hardware, upper neck, tilt motor and covers rotate together; output bracket 265 additionally tilts. Bearing races and internal drive motion are not independently simulated. src/head.ts lists the source-body stages.

Configuration JSON includes head.pose and head.movable. Older files initialize a fixed neutral head. Direct STEP export uses the same head matrix as the viewer. Fusion website-pose export now uses request version 2 and requires head_rotation/head_tilt driving native parameters as well; older helper scripts reject the new format rather than silently omitting head movement. The Fusion-pose mode keeps the native pose as before.

100 TypeScript and 10 Python tests pass. Offline geometry previews were reviewed in docs/evidence/model-v4-head-movement.png. A five-component posed STEP sample including head output was reimported with OpenCascade (24,000 triangles) with bounds matching within 0.001 mm. These checks are not browser UI verification.

## Bill of materials (CNY)

Bill of materials is in the top project navigation, outside the parameter tabs. It opens bom.html in a separate window (or a browser tab if popup windows are blocked). The page is independently built by Vite and served alongside the configurator. It needs no 3D model download.

Opening the BOM captures the current dimensions and selected motor descriptions. The snapshot is transferred through a unique local-storage key, consumed into the new window session; edits do not affect the configurator. Directly opening bom.html uses the default examples. Each new opening is a fresh estimate, not a live synchronized procurement list. Materials, quantities and prices are illustrative and editable. There are 38 example rows across 7 categories; initial total ¥31,720 CNY. Shoulder choices have quantity two per side (lift/swing). Other motors, mechanical hardware and electronics use example specifications, not a certified model-derived bill. Tax, shipping and assembly are excluded.

Whole-number quantities and prices with two decimal places are validated. Calculations use integer fen. Category filters leave the overall total unchanged. Reset examples restores the opening configuration. Edits remain in the window until closed; Download CSV exports UTF-8 BOM-marked CNY data with spreadsheet formula protection. examples/SophiRobot-BOM-CNY.csv is included.

Validation: 100 TypeScript tests and production multi-page build pass. Local HTTP verifies both pages and their assets. Browser UI visual verification remains blocked.

The table supports keyword search across parts and materials, category filters, collapsible groups with subtotals, and quantity stepper buttons. Search and collapsed groups never change the full estimate or CSV contents. Inline messages identify invalid quantity and price fields. Reset examples offers a one-level Undo that restores edits and numeric drafts. Desktop column headings and the overall total stay visible while scrolling; narrow screens show stacked part cards.

Walking preview: use Play walk above the parameter fields to animate alternating legs and opposite arm swings in place. Speed choices are 0.5x, 1x and 1.5x. Stop walk restores the exact configured limb pose and Fixed/Movable settings are retained. Configuration edits, save/export actions, measurements and snapshots stop the preview first. Hiding the page also stops playback. Wrists, clamps, head and the AGV base stay unchanged. This is a joint animation, not a balanced gait or ground-contact simulation. During playback, dimension readouts retain the configured pose values.

Wave and say hi: the Animation previews section includes a 4.8-second right-arm greeting. It raises the arm, oscillates the shoulder and wrist, then returns smoothly to the saved pose. Legs and the opposite arm remain unchanged. A viewport caption reads Hi! I am SophiRobot; optional browser speech says the greeting when supported. Voice greeting can be disabled. Starting a different animation stops the current one, and Stop, editing or hiding the page restores the configured pose. Browser audio and rendered motion require visual/manual verification.

Three additional Animation previews: Welcome opens both arms; Reach forward extends both arms ahead; Celebrate raises both arms with a gentle repeated motion. Each lasts four seconds at 1x and supports the speed selector. Clicking the active button stops it; selecting another switches previews. Each returns to the saved pose and preserves legs, wrists and clamps. Joint range and pose restoration tests pass; rendered motion has not been visually verified.
