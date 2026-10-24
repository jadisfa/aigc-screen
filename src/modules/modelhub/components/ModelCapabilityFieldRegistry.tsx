import React from "react";
import { getCapabilityPlugin } from "@/modules/modelhub/types/capabilityRegistryFactory";
import type { CapabilityFieldUiConfig } from "@/modules/modelhub/types/capabilityRegistryFactory";
import {
  CapabilityConfigSectionKey,
  CapabilityConfigValue,
  CapabilityFieldDefinition,
  CapabilityFieldType,
  ModelCapabilityCode,
  ModelCapabilityConfig,
} from "@/modules/modelhub/types/modelCapabilityMetadata";
import { cn } from "@/shared/lib/utils";

export interface CapabilityFieldRendererEngineProps {
  code: ModelCapabilityCode;
  config: ModelCapabilityConfig;
  sectionKey: CapabilityConfigSectionKey;
  field: CapabilityFieldDefinition;
  value: CapabilityConfigValue | undefined;
  onChange: (value: CapabilityConfigValue) => void;
}

export interface CapabilityFieldRendererProps extends CapabilityFieldRendererEngineProps {
  uiSchema: CapabilityFieldUiConfig;
}

type CapabilityFieldRendererContext = Omit<CapabilityFieldRendererProps, "onChange">;

export interface CapabilityFieldRendererDef {
  key: string;
  aliases?: string[];
  supportedTypes?: CapabilityFieldType[];
  priority?: number;
  match?: (props: CapabilityFieldRendererContext) => number | boolean;
  component: React.ComponentType<CapabilityFieldRendererProps>;
}

class CapabilityFieldRegistry {
  private renderers: CapabilityFieldRendererDef[] = [];
  private rendererKeyMap = new Map<string, CapabilityFieldRendererDef>();

  register(renderer: CapabilityFieldRendererDef) {
    const duplicatedKeys = [renderer.key, ...(renderer.aliases || [])].filter((key) => this.rendererKeyMap.has(key));
    if (duplicatedKeys.length > 0) {
      if (import.meta.env.DEV) {
        console.warn(`[modelhub] capability field renderer already registered: ${duplicatedKeys.join(", ")}`);
      }
      return;
    }

    this.renderers.push(renderer);
    this.rendererKeyMap.set(renderer.key, renderer);
    renderer.aliases?.forEach((alias) => {
      this.rendererKeyMap.set(alias, renderer);
    });
  }

  getRenderer(props: CapabilityFieldRendererContext): React.ComponentType<CapabilityFieldRendererProps> | null {
    if (props.uiSchema.hidden) {
      return this.rendererKeyMap.get("hidden")?.component || null;
    }

    const rendererKey = props.uiSchema.rendererKey?.trim();
    if (rendererKey) {
      const semanticRenderer = this.rendererKeyMap.get(rendererKey);
      if (semanticRenderer) {
        return semanticRenderer.component;
      }
    }

    let bestMatch: CapabilityFieldRendererDef | null = null;
    let maxPriority = 0;

    for (const renderer of this.renderers) {
      let priority = renderer.supportedTypes?.includes(props.field.type) ? renderer.priority || 10 : 0;

      if (renderer.match) {
        const matched = renderer.match(props);
        if (typeof matched === "number") {
          priority = Math.max(priority, matched);
        } else if (matched) {
          priority = Math.max(priority, renderer.priority || 10);
        }
      }

      if (priority > maxPriority) {
        maxPriority = priority;
        bestMatch = renderer;
      }
    }

    return bestMatch ? bestMatch.component : null;
  }
}

export const capabilityFieldRegistry = new CapabilityFieldRegistry();

function getDefaultCapabilityFieldUiSchema(field: CapabilityFieldDefinition): CapabilityFieldUiConfig {
  if (field.type === "multiselect" || field.type === "textarea") {
    return {
      layout: {
        colSpan: 2,
      },
    };
  }

  return {};
}

export function resolveCapabilityFieldUiSchema(context: Omit<CapabilityFieldRendererEngineProps, "onChange">) {
  const defaultUiSchema = getDefaultCapabilityFieldUiSchema(context.field);
  const pluginUiSchema = getCapabilityPlugin(context.code).getFieldUiConfig?.(context) || {};

  return {
    ...defaultUiSchema,
    ...pluginUiSchema,
    layout: {
      ...defaultUiSchema.layout,
      ...pluginUiSchema.layout,
    },
  } satisfies CapabilityFieldUiConfig;
}

export function CapabilityFieldRendererEngine(props: CapabilityFieldRendererEngineProps) {
  const uiSchema = resolveCapabilityFieldUiSchema(props);
  const componentProps: CapabilityFieldRendererProps = {
    ...props,
    uiSchema,
  };
  const Component = capabilityFieldRegistry.getRenderer(componentProps);

  if (!Component) {
    return (
      <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
        {`Missing capability field renderer: ${props.field.key} (type: ${props.field.type}, renderer: ${uiSchema.rendererKey || "default"})`}
      </div>
    );
  }

  const layoutClassName = cn(uiSchema.layout?.colSpan === 2 ? "md:col-span-2" : null, uiSchema.layout?.className);

  if (!layoutClassName) {
    return <Component {...componentProps} onChange={props.onChange} />;
  }

  return (
    <div className={layoutClassName}>
      <Component {...componentProps} onChange={props.onChange} />
    </div>
  );
}
