const matrix4Schema = {
  type: 'array',
  items: { type: 'number' },
  minItems: 16,
  maxItems: 16,
} as const;

const vector3Schema = {
  type: 'array',
  items: { type: 'number' },
  minItems: 3,
  maxItems: 3,
} as const;

const inertiaSchema = {
  type: 'array',
  items: { type: 'number' },
  minItems: 9,
  maxItems: 9,
} as const;

const jointTypeSchema = {
  enum: [
    'fixed', 'revolute', 'continuous', 'prismatic', 'ball',
    'cylindrical', 'planar', 'pin-slot', 'inferred', 'unknown',
  ],
} as const;

const jointLimitSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    lower: { type: 'number' },
    upper: { type: 'number' },
    effort: { type: 'number', minimum: 0 },
    velocity: { type: 'number', minimum: 0 },
  },
} as const;

export const manifestSchema = {
  $id: 'https://sophicad.local/schema/manifest-1.0.0.json',
  type: 'object',
  additionalProperties: false,
  required: [
    'schemaVersion', 'packageId', 'createdAt', 'producer',
    'producerVersion', 'source', 'coordinateSystem', 'files',
  ],
  properties: {
    schemaVersion: { type: 'string', pattern: '^1\\.[0-9]+\\.[0-9]+$' },
    packageId: { type: 'string', minLength: 1 },
    createdAt: { type: 'string', format: 'date-time' },
    producer: { type: 'string', minLength: 1 },
    producerVersion: { type: 'string', minLength: 1 },
    source: {
      type: 'object',
      additionalProperties: false,
      required: ['designGuid', 'documentName', 'dataFileId', 'versionId', 'fingerprint'],
      properties: {
        designGuid: { type: 'string', minLength: 1 },
        documentName: { type: 'string', minLength: 1 },
        dataFileId: { type: ['string', 'null'] },
        versionId: { type: ['string', 'null'] },
        fingerprint: { type: 'string', pattern: '^[a-f0-9]{64}$' },
      },
    },
    coordinateSystem: {
      type: 'object',
      additionalProperties: false,
      required: ['frameName', 'convention', 'sourceToRobot'],
      properties: {
        frameName: { type: 'string', minLength: 1 },
        convention: { const: 'x-forward-y-left-z-up' },
        sourceToRobot: matrix4Schema,
      },
    },
    files: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['path', 'purpose', 'bytes', 'sha256'],
        properties: {
          path: { type: 'string', minLength: 1 },
          purpose: {
            enum: ['authority', 'visual-mesh', 'collision-mesh', 'robot', 'report', 'other'],
          },
          bytes: { type: 'integer', minimum: 0 },
          sha256: { type: 'string', pattern: '^[a-f0-9]{64}$' },
        },
      },
    },
  },
} as const;

const parameterBaseProperties = {
  name: { type: 'string', minLength: 1 },
  unit: { type: 'string' },
  expression: { type: 'string', minLength: 1 },
  valueSi: { type: ['number', 'null'] },
  dependencies: { type: 'array', items: { type: 'string', minLength: 1 }, uniqueItems: true },
} as const;

export const modelSchema = {
  $id: 'https://sophicad.local/schema/model-1.0.0.json',
  type: 'object',
  additionalProperties: false,
  required: [
    'schemaVersion', 'units', 'parameters', 'components', 'occurrences',
    'joints', 'physicalProperties', 'bom', 'robot',
  ],
  properties: {
    schemaVersion: { type: 'string', pattern: '^1\\.[0-9]+\\.[0-9]+$' },
    units: {
      type: 'object',
      additionalProperties: false,
      required: ['length', 'mass', 'angle', 'inertia'],
      properties: {
        length: { const: 'm' },
        mass: { const: 'kg' },
        angle: { const: 'rad' },
        inertia: { const: 'kg*m^2' },
        fusionDocumentLength: { type: 'string' },
        fusionDocumentAngle: { type: 'string' },
      },
    },
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['user', 'model'],
      properties: {
        user: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['name', 'unit', 'expression', 'valueSi', 'dependencies', 'writable'],
            properties: {
              ...parameterBaseProperties,
              textValue: { type: 'string' },
              comment: { type: 'string' },
              favorite: { type: 'boolean' },
              writable: { type: 'boolean' },
              readOnlyReason: { type: 'string' },
            },
          },
        },
        model: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['name', 'unit', 'expression', 'valueSi', 'dependencies'],
            properties: {
              ...parameterBaseProperties,
              createdBy: { type: 'string' },
            },
          },
        },
      },
    },
    components: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'name'],
        properties: {
          id: { type: 'string', minLength: 1 },
          name: { type: 'string', minLength: 1 },
          partNumber: { type: 'string' },
          description: { type: 'string' },
          material: { type: 'string' },
          bodyIds: { type: 'array', items: { type: 'string' } },
          appearance: {
            type: 'object',
            additionalProperties: false,
            required: ['baseColor'],
            properties: {
              baseColor: {
                type: 'array', items: { type: 'number', minimum: 0, maximum: 1 }, minItems: 4, maxItems: 4,
              },
              metallic: { type: 'number', minimum: 0, maximum: 1 },
              roughness: { type: 'number', minimum: 0, maximum: 1 },
            },
          },
          visualMesh: { type: 'string' },
          collisionMesh: { type: 'string' },
        },
      },
    },
    occurrences: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'componentId', 'name', 'fullPath', 'transform'],
        properties: {
          id: { type: 'string', minLength: 1 },
          componentId: { type: 'string', minLength: 1 },
          name: { type: 'string', minLength: 1 },
          fullPath: { type: 'string', minLength: 1 },
          parentOccurrenceId: { type: 'string', minLength: 1 },
          entityToken: { type: 'string', minLength: 1 },
          transform: matrix4Schema,
          visible: { type: 'boolean' },
          grounded: { type: 'boolean' },
          readOnlyReason: { type: 'string' },
        },
      },
    },
    joints: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'id', 'name', 'parentOccurrenceId', 'childOccurrenceId', 'type',
          'fusionType', 'origin', 'axis', 'degreesOfFreedom', 'writeback',
        ],
        properties: {
          id: { type: 'string', minLength: 1 },
          name: { type: 'string', minLength: 1 },
          parentOccurrenceId: { type: ['string', 'null'] },
          childOccurrenceId: { type: ['string', 'null'] },
          type: jointTypeSchema,
          fusionType: { type: 'string', minLength: 1 },
          origin: matrix4Schema,
          axis: vector3Schema,
          degreesOfFreedom: { type: 'integer', minimum: 0 },
          position: { type: 'number' },
          limit: jointLimitSchema,
          suppressed: { type: 'boolean' },
          loopClosure: { type: 'boolean' },
          entityToken: { type: 'string' },
          writeback: {
            type: 'object',
            additionalProperties: false,
            required: ['limits', 'type', 'axis'],
            properties: {
              limits: { type: 'boolean' },
              type: { type: 'boolean' },
              axis: { type: 'boolean' },
            },
          },
        },
      },
    },
    physicalProperties: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'entityId', 'massKg', 'volumeM3', 'centerOfMass',
          'inertiaKgM2', 'inertiaFrame', 'accuracy',
        ],
        properties: {
          entityId: { type: 'string', minLength: 1 },
          massKg: { type: 'number', minimum: 0 },
          volumeM3: { type: 'number', minimum: 0 },
          centerOfMass: vector3Schema,
          inertiaKgM2: inertiaSchema,
          inertiaFrame: matrix4Schema,
          accuracy: { enum: ['low', 'medium', 'high', 'very-high'] },
        },
      },
    },
    bom: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['componentId', 'quantity', 'occurrenceIds'],
        properties: {
          componentId: { type: 'string', minLength: 1 },
          partNumber: { type: 'string' },
          description: { type: 'string' },
          material: { type: 'string' },
          quantity: { type: 'integer', minimum: 1 },
          occurrenceIds: { type: 'array', items: { type: 'string', minLength: 1 }, minItems: 1, uniqueItems: true },
        },
      },
    },
    robot: {
      type: 'object',
      additionalProperties: false,
      required: ['rootOccurrenceId', 'linkMappings', 'jointOverrides'],
      properties: {
        name: { type: 'string' },
        rootOccurrenceId: { type: ['string', 'null'] },
        linkMappings: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['occurrenceId', 'linkName'],
            properties: {
              occurrenceId: { type: 'string', minLength: 1 },
              linkName: { type: 'string', minLength: 1 },
            },
          },
        },
        jointOverrides: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['jointId'],
            properties: {
              jointId: { type: 'string', minLength: 1 },
              type: jointTypeSchema,
              axis: vector3Schema,
              limit: jointLimitSchema,
              damping: { type: 'number', minimum: 0 },
              friction: { type: 'number', minimum: 0 },
              effort: { type: 'number', minimum: 0 },
              velocity: { type: 'number', minimum: 0 },
            },
          },
        },
        lockedTreeJointIds: { type: 'array', items: { type: 'string', minLength: 1 }, uniqueItems: true },
      },
    },
  },
} as const;

export const changesSchema = {
  $id: 'https://sophicad.local/schema/changes-1.0.0.json',
  type: 'object',
  additionalProperties: false,
  required: [
    'schemaVersion', 'basePackageId', 'baseFingerprint', 'targetDesignGuid',
    'createdAt', 'parameterChanges', 'jointChanges', 'robotOverrides', 'bomOverrides',
  ],
  properties: {
    schemaVersion: { type: 'string', pattern: '^1\\.[0-9]+\\.[0-9]+$' },
    basePackageId: { type: 'string', minLength: 1 },
    baseFingerprint: { type: 'string', pattern: '^[a-f0-9]{64}$' },
    targetDesignGuid: { type: 'string', minLength: 1 },
    createdAt: { type: 'string', format: 'date-time' },
    author: { type: 'string' },
    note: { type: 'string' },
    parameterChanges: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'oldExpression', 'newExpression'],
        properties: {
          name: { type: 'string', minLength: 1 },
          oldExpression: { type: 'string', minLength: 1 },
          newExpression: { type: 'string', minLength: 1 },
          expectedOldValueSi: { type: ['number', 'null'] },
        },
      },
    },
    jointChanges: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['jointId', 'field', 'newValue', 'writebackMode'],
        properties: {
          jointId: { type: 'string', minLength: 1 },
          field: { enum: ['limit.lower', 'limit.upper', 'limit.effort', 'limit.velocity'] },
          oldValue: { type: 'number' },
          newValue: { type: 'number' },
          writebackMode: { enum: ['fusion-if-supported', 'robot-only'] },
        },
      },
    },
    robotOverrides: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['jointId', 'override'],
        properties: {
          jointId: { type: 'string', minLength: 1 },
          override: {
            type: 'object',
            additionalProperties: true,
            required: ['jointId'],
            properties: { jointId: { type: 'string', minLength: 1 } },
          },
        },
      },
    },
    bomOverrides: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['componentId'],
        properties: {
          componentId: { type: 'string', minLength: 1 },
          description: { type: 'string' },
          material: { type: 'string' },
        },
      },
    },
  },
} as const;
