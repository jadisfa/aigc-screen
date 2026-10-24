import { capabilityFieldRegistry } from "../ModelCapabilityFieldRegistry";
import { BooleanField } from "./BooleanField";
import { HiddenField } from "./HiddenField";
import { MultiSelectField } from "./MultiSelectField";
import { NumberField } from "./NumberField";
import { SelectField } from "./SelectField";
import { TextareaField } from "./TextareaField";
import { TextField } from "./TextField";

let baseCapabilityFieldsRegistered = false;

export function registerBaseCapabilityFields() {
  if (baseCapabilityFieldsRegistered) {
    return;
  }

  baseCapabilityFieldsRegistered = true;

  capabilityFieldRegistry.register({
    key: "boolean",
    supportedTypes: ["boolean"],
    component: BooleanField,
  });
  capabilityFieldRegistry.register({
    key: "hidden",
    priority: 1000,
    match: (props) => props.uiSchema.hidden === true,
    component: HiddenField,
  });
  capabilityFieldRegistry.register({
    key: "multiselect",
    aliases: ["option_grid"],
    supportedTypes: ["multiselect"],
    component: MultiSelectField,
  });
  capabilityFieldRegistry.register({
    key: "number",
    supportedTypes: ["number"],
    component: NumberField,
  });
  capabilityFieldRegistry.register({
    key: "select",
    aliases: ["supported_value_select"],
    supportedTypes: ["select"],
    component: SelectField,
  });
  capabilityFieldRegistry.register({
    key: "textarea",
    supportedTypes: ["textarea"],
    component: TextareaField,
  });
  capabilityFieldRegistry.register({
    key: "text",
    supportedTypes: ["text"],
    component: TextField,
  });
}

registerBaseCapabilityFields();

export * from "../ModelCapabilityFieldRegistry";
