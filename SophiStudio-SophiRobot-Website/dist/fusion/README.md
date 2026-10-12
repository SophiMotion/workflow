# SophiStudio / SophiRobot — Fusion STEP export

This companion runs inside Autodesk Fusion. The website downloads configuration data; Fusion creates the STEP using native CAD geometry. It does not convert the tessellated website mesh into a native parametric model.

## Requirements and setup

1. Obtain and open the original parametric robot design (.f3d/.f3z or its Fusion cloud document). Save a working copy before setup. Importing Assembly testing website 4.step does NOT recreate its driving parameters or joints.
2. Extract SophiRobot-Fusion-Export.zip. Keep SophiRobotExport.py, its manifest, export_core.py, schema.json and mapping.json together inside the SophiRobotExport folder.
3. Open Fusion's Scripts and Add-Ins dialog (search for it in Fusion if your toolbar differs). Add the extracted SophiRobotExport folder as a script, then run it. No external Python installation is required; Fusion supplies the adsk API.
4. Before the first export, review mapping.json. Names are case-sensitive. Each mapped user parameter must already exist AND actually drive the intended geometry. Merely creating unused parameters will not resize the model. The script checks existence and units, but cannot prove the native model's geometry relationships.
5. In the website, select Export via Fusion 360 near the bottom of the sidebar. Choose a pose mode and download SophiRobot-fusion-request.json.
6. Run SophiRobotExport in Fusion with the correct native design active. Select the request. Review the active document and every target parameter/value, then choose a new STEP filename.
7. The script changes native parameters as a batch, rebuilds, checks timeline errors, and exports STEP. It restores original parameter expressions afterward, including if export fails. It never saves the native document automatically; Fusion may still mark it modified after temporary changes. If restoration fails, the script reports it and does not finalize STEP.
8. A successful run creates the STEP and an adjacent .step.json report with the original request, applied mapping and motor specifications. Inspect the exported model before downstream use.

## Mapping dimensions

Mapping format: each website key has name (native Fusion user parameter), scale and offset. Native target value = website value × scale + offset, in mm or deg. Scale must be finite and nonzero. Targets must be unique. Only existing native USER parameters are used.

Known starting aliases from the provided screenshots:
- total_height -> Total_height
- od_tire -> OD_tire
- thin_sheet -> sheet_thickness
- hip_length -> Hip_length
- hip_position -> Hip_height
- tube_diameter -> dia_tube
- tube_thickness -> thickness_tube
- Other dimensions initially use their website names, including thigh_length and lower_leg_length. These names still need verification against the native design.

All 20 editable website dimensions must be mapped. The inactive structural_sheet compatibility field is excluded. Parameters for frame size, ground clearance, tire width, gaps and other dimensions not exposed by the website retain their native values.

IMPORTANT: matching names do not guarantee matching definitions. The website's total_height is the neutral overall envelope INCLUDING the head (1875.75 mm by default). Your earlier screenshot's Total_height was 1600 mm and may use another datum. Verify the correct relationship and configure scale/offset, or a genuinely driving native parameter with the correct meaning. Hip_position uses height above the base deck. Tire_thickness follows OD minus rim diameter, whereas tube_thickness is radial wall thickness. Do not assume these are interchangeable.

## Pose modes

Keep the current Fusion pose (default): applies dimensions only. Website limb angles are preserved in the JSON report but are NOT applied to CAD. Set your desired pose in Fusion first if needed.

Apply the website pose: additionally requires all 18 angle mappings (six per arm, two per leg, two for the head). The initial mapping names look like arm_l_shoulder_lift and leg_r_elbow_bend. These are proposed names, not verified parameters in your model. Connect the native joint angle expressions to suitable driving user parameters, then map them. Configure sign using scale -1 and angle origin using offset where necessary. Website knee bend is reversed; left/right conventions and servo axes require checking against native joints. Zero must correspond to the website STEP reference pose. All angle mappings are required, including zero angles; missing mappings stop export rather than retaining an unexpected native pose.

The script does not infer joint associations, component IDs, or design history from STEP, and cannot guarantee that independently constructed CAD geometry matches the website's approximate deformations.

## Output policies

- Full native root assembly is exported; website hide/unhide state is not applied.
- Motor selections are metadata only and are stored in the adjacent JSON report. CAD motors are not replaced and ratings are not verified.
- Existing output files are not overwritten; select a new filename.
- A missing mapping, invalid value/unit, failed parameter update, timeline error, rebuild failure or failed STEP translator stops export.
- STEP contains geometry, not the original Fusion feature timeline or driving parameter system.

## Verification status

Web request validation, Python mapping and restoration logic are covered by automated tests. Python syntax and the website build are checked. End-to-end Fusion export has NOT been verified against the original robot design because that file has not been provided. Browser UI automation remains unavailable in this session.

## Autodesk API references

https://help.autodesk.com/cloudhelp/ENU/Fusion-360-API/files/SetParametersFromACsvFileAndExportToSTEP_Sample.htm
https://help.autodesk.com/cloudhelp/ENU/Fusion-360-API/files/fusion_Design_modifyParameters.htm
https://help.autodesk.com/cloudhelp/ENU/Fusion-360-API/files/fusion_ExportManager_createSTEPExportOptions.htm

Head movement uses head_rotation and head_tilt user parameters by default, mapped from head.rotation and head.tilt. Positive website tilt looks up toward the front (−Y); verify the sign and datum in native CAD. New downloads use export request version 2 so older helper scripts cannot silently omit head motion. Replace the helper files with this version while preserving your reviewed custom mapping names and adding both head mappings.
