const ToolInputProperty = {
  String: 'string',
  Boolean: 'boolean',
  Number: 'number'
}

export type InputPropertyDefaultType = string | boolean | number

export type ToolInputPropertyType =
  (typeof ToolInputProperty)[keyof typeof ToolInputProperty]

/**
 * 工具输入参数
 * @description 工具输入参数
 * @property type 工具输入参数的类型，给大语言模型的类型参考，而不是语言内部的类型定义，字符串格式的‘string','boolean','number'
 * @property description 工具输入参数的描述
 * @property examples 工具输入参数的示例,让大语言模型更加容易理解应该返回的格式
 * @property default 工具输入参数的默认值，string | boolean | number
 */
interface ToolInputProperty {
  type: ToolInputPropertyType
  description: string
  examples?: InputPropertyDefaultType[]
  default?: InputPropertyDefaultType
}

interface ToolInputSchema {
  type: 'object'
  properties: {
    [key: string]: ToolInputProperty
  }
  required: string[]
}

export interface McpTool {
  name: string
  description: string
  inputSchema: ToolInputSchema
}
