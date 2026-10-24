import { Checkbox } from "@/shared/ui/checkbox";

type RangeSelectorProps<T extends string> = {
  options: { value: T; label: string }[];
  value: T[];
  onChange: (nextValue: T[]) => void;
  emptyText: string;
};

export function RangeSelector<T extends string>(props: RangeSelectorProps<T>) {
  const summary =
    props.value.length === 0
      ? props.emptyText
      : props.options
          .filter((item) => props.value.includes(item.value))
          .map((item) => item.label)
          .join(" / ");

  return (
    <div className="space-y-3 rounded-md border border-border/60 bg-muted/10 px-4 py-3">
      <div className="text-sm text-foreground">{summary}</div>
      <div className="flex flex-wrap gap-4">
        {props.options.map((option) => {
          const checked = props.value.includes(option.value);
          return (
            <label key={option.value} className="flex items-center gap-2 text-sm text-foreground">
              <Checkbox
                checked={checked}
                onCheckedChange={(nextChecked) => {
                  const isChecked = nextChecked === true;
                  if (isChecked) {
                    props.onChange(props.value.includes(option.value) ? props.value : [...props.value, option.value]);
                    return;
                  }
                  props.onChange(props.value.filter((item) => item !== option.value));
                }}
              />
              <span>{option.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
