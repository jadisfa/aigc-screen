/**
 * 参数值的 JSON Schema 描述，与后端 field-schema 保持一致
 * 用于工作流参数的校验与表单生成
 */
export enum SchemaType {
  Object = 'object',
  Array = 'array',
  String = 'string',
  Number = 'number',
  Boolean = 'boolean',
  Union = 'union',
  Null = 'null',
}

/** String 类型 format 的枚举，与 JSON Schema 常见 format 对齐 */
export enum StringFormat {
  Uri = 'uri',
  Email = 'email',
  Date = 'date',
  DateTime = 'date-time',
  Time = 'time',
  Hostname = 'hostname',
  Ipv4 = 'ipv4',
  Ipv6 = 'ipv6',
  Text = 'text',
}

interface BaseSchema {
  type: SchemaType
  required?: boolean
  nullable?: boolean
  meta?: {
    label?: string
    description?: string
    default?: unknown
  }
}

export interface StringSchema extends BaseSchema {
  type: SchemaType.String
  minLength?: number
  maxLength?: number
  pattern?: string
  enum?: string[]
  format?: StringFormat
}

export interface NumberSchema extends BaseSchema {
  type: SchemaType.Number
  minimum?: number
  maximum?: number
  exclusiveMinimum?: number
  exclusiveMaximum?: number
}

export interface BooleanSchema extends BaseSchema {
  type: SchemaType.Boolean
}

export interface NullSchema extends BaseSchema {
  type: SchemaType.Null
}

export interface ObjectSchema extends BaseSchema {
  type: SchemaType.Object
  properties: Record<string, FieldSchema>
  additionalProperties?: boolean
}

export interface ArraySchema extends BaseSchema {
  type: SchemaType.Array
  items: FieldSchema
  minItems?: number
  maxItems?: number
}

export interface UnionSchema extends BaseSchema {
  type: SchemaType.Union
  oneOf: FieldSchema[]
}

export type FieldSchema =
  | StringSchema
  | NumberSchema
  | BooleanSchema
  | NullSchema
  | ArraySchema
  | ObjectSchema
  | UnionSchema
