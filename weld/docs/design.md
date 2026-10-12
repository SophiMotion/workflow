# Sophi Weld design brief

Deliverable: offline, standalone `weld.html`, editable source, local REA installation. Chinese welding workstation based on the user's supplied RobotStudio reference: robot, safety fence, fixture, workpiece, gas supply. Combine trajectory/sequence planning and thermal/mechanical result exploration.

Visual specification: `design-concept.png` generated using the built-in Image Gen tool. White professional CAD chrome, charcoal typography, orange #e66b32 accent, thin #e3e5e7 borders, pale gray viewport. 56 px header, 48 px workflow navigation, 230 px object tree, flexible 3D viewport + playback + 180 px timeline, 280 px inspector. UI labels and interaction code-native. System sans-serif with Chinese fallbacks; compact 12/13 px chrome, 15 px section titles, tabular numeric values. Lucide 1.6 px outline icons, subtle 6 px controls. Mobile sidebar drawers; viewport remains visible.

Functional requirements: select seams, show/hide scene groups, orbit/zoom/reset view, edit parameters with numerical validation, change weld order, playback along seam paths, run clearly labeled illustrative thermal history, switch contour metric, import/export project JSON, import actual CSV histories, export data/report, persist project locally.

Intentional deviations from concept: three-dimensional scene uses procedural engineering geometry so it can orbit, animate and visualize fields; it is not a bitmap photograph. No proprietary robot kinematics or licensed solver emulation is claimed. An import action and integration status dialog support the requested cross-tool workflow. Calculation values depend on the current strategy and parameters rather than the concept's illustrative labels.

Integration boundary: REA inspects shipped artifacts; no RobotStudio / Simufact installers or assemblies were supplied. Real native reverse engineering and live solver integration remain unavailable. Browser analysis with REA is used to verify the implemented artifact. All web-generated temperatures, stress and displacement are demonstrative surrogate estimates, not certified FEA results. Imported CSV fields retain explicit external provenance; no fabricated connection.


## October 12 interaction refinement

The robot uses cast-link geometry, articulated motor caps, bolts, a corrugated dress pack, a long torch and a copper nozzle. The fence uses yellow posts and dark lower shielding. This follows the supplied cell composition without claiming a proprietary ABB CAD model. Two fixed-length links are solved analytically; seam-dependent approach normals keep the torch outside the bracket. Transfer motion retracts outward and upward before crossing to another seam. Conservative body envelopes cover the part, gussets, table and fixtures only.

A deterministic time model drives the rig, electric arc, shielding cone, molten pool, particles and instanced deposition. Rewinding removes future segments. Deposited segments cool from a hot color through temper colors toward metal or oxidation color. Line energy, selected process, weave, speed and shielding conditions change width, height, ripple pitch and oxidation. A synthetic spatial field uses time since deposition and distance from the seam; it is not a thermal solver.

A separate cooling interval follows the final arc. Analysis shows the surface-temperature envelope, an illustrative stress trend, displacement, and t8/5 from the exponential cooling model. Five expandable risk records explain parameter-driven concerns without defect probabilities or pass/fail certification. All new states, presets and geometry limits are covered by automated tests plus rendered desktop/mobile checks.
