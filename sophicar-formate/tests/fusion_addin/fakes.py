from fusion_addin.lib.domain import (
    ComponentRecord,
    DesignIdentity,
    DocumentSnapshot,
    OccurrenceRecord,
    ParameterRecord,
)


IDENTITY = (
    1.0, 0.0, 0.0, 0.0,
    0.0, 1.0, 0.0, 0.0,
    0.0, 0.0, 1.0, 0.0,
    0.0, 0.0, 0.0, 1.0,
)


def make_snapshot(
    parameter_name="l1",
    expression="200 mm",
    value_si=0.2,
):
    return DocumentSnapshot(
        identity=DesignIdentity(
            design_guid="design-1",
            document_name="test1.f3d",
            data_file_id=None,
            version_id=None,
        ),
        parameters=(
            ParameterRecord(
                name=parameter_name,
                unit="mm",
                expression=expression,
                value_si=value_si,
                dependencies=(),
                writable=True,
            ),
        ),
        model_parameters=(),
        components=(ComponentRecord(id="link", name="Link"),),
        occurrences=(
            OccurrenceRecord(
                id="link:1",
                component_id="link",
                name="Link:1",
                full_path="Link:1",
                transform=IDENTITY,
            ),
        ),
        joints=(),
        physical_properties=(),
        bom=(),
        robot={"rootOccurrenceId": "link:1", "linkMappings": [], "jointOverrides": []},
        component_meshes={},
    )
