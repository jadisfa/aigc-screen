import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs";
import { Textarea } from "@/shared/ui/textarea";
import { cn } from "@/shared/lib/utils";

function formatPrimitive(v: unknown): string {
  if (v === null) return "null";
  if (typeof v === "string") return JSON.stringify(v);
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "undefined") return "undefined";
  return String(v);
}

function valueMeta(v: unknown): { typeLabel: string; countLabel?: string } {
  if (v === null) return { typeLabel: "null" };
  if (Array.isArray(v)) return { typeLabel: "array", countLabel: String(v.length) };
  if (typeof v === "object") return { typeLabel: "object", countLabel: String(Object.keys(v as Record<string, unknown>).length) };
  return { typeLabel: typeof v };
}

function JsonTreeNode(props: { name: string; value: unknown; depth: number }) {
  const meta = valueMeta(props.value);
  const indent = props.depth * 12;
  const isContainer = meta.typeLabel === "object" || meta.typeLabel === "array";

  if (!isContainer) {
    return (
      <div className="text-[12px] leading-5 font-mono" style={{ paddingLeft: indent }}>
        <span className="text-muted-foreground">{props.name}</span>
        <span className="text-muted-foreground">: </span>
        <span className="text-foreground">{formatPrimitive(props.value)}</span>
      </div>
    );
  }

  const entries: Array<{ key: string; value: unknown }> = Array.isArray(props.value)
    ? (props.value as unknown[]).map((v, idx) => ({ key: String(idx), value: v }))
    : Object.entries(props.value as Record<string, unknown>).map(([k, v]) => ({ key: k, value: v }));

  return (
    <details className="text-[12px] leading-5" open={props.depth < 1}>
      <summary className="font-mono cursor-pointer select-none" style={{ paddingLeft: indent }}>
        <span className="text-muted-foreground">{props.name}</span>
        <span className="text-muted-foreground">: </span>
        <span className="text-muted-foreground">
          {meta.typeLabel}
          {meta.countLabel ? `(${meta.countLabel})` : ""}
        </span>
      </summary>
      <div className="mt-1 space-y-1">
        {entries.map((e) => (
          <JsonTreeNode key={`${props.name}.${e.key}`} name={e.key} value={e.value} depth={props.depth + 1} />
        ))}
      </div>
    </details>
  );
}

export default function JsonEditor(props: {
  jsonText: string;
  onJsonTextChange: (next: string) => void;
  parsedValue: unknown | null;
  className?: string;
}) {
  const [mode, setMode] = useState<"tree" | "text">("tree");

  return (
    <div
      className={cn(
        "h-full min-h-0 flex flex-col border border-border rounded-xl overflow-hidden bg-background",
        props.className,
      )}
    >
      <Tabs
        value={mode}
        onValueChange={(v) => setMode(v === "text" ? "text" : "tree")}
        className="h-full min-h-0 flex flex-col"
      >
        <div className="shrink-0 px-3 py-2 border-b border-border">
          <TabsList className="h-8">
            <TabsTrigger value="tree" className="h-7">
              结构
            </TabsTrigger>
            <TabsTrigger value="text" className="h-7">
              文本
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent
          value="tree"
          className="mt-0 flex-1 min-h-0 p-3 overflow-auto data-[state=inactive]:hidden"
        >
          {props.parsedValue == null ? (
            <div className="text-sm text-muted-foreground">暂无可展示内容</div>
          ) : (
            <div className="space-y-1">
              <JsonTreeNode name="root" value={props.parsedValue} depth={0} />
            </div>
          )}
        </TabsContent>

        <TabsContent
          value="text"
          className="mt-0 flex-1 min-h-0 p-3 overflow-hidden flex flex-col data-[state=inactive]:hidden"
        >
          <Textarea
            value={props.jsonText}
            onChange={(e) => props.onJsonTextChange(e.target.value)}
            className="flex-1 min-h-0 h-full font-mono text-[12px] leading-5 resize-none bg-muted/30"
            placeholder="可直接粘贴 JSON"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
