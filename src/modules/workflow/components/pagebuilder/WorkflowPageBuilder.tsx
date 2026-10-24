import { useEffect, useMemo, useRef, useState } from "react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/shared/ui/hover-card";
import type { ParsedWorkflowNode } from "@/shared/api/workflow/workflow";
import WorkflowComponentPropertyPanel from "./WorkflowComponentPropertyPanel";
import { Plus, ChevronDown } from "lucide-react";
import type { UiComponent, UiSchemaV1 } from "./ui-schema";
import { createEmptyUiSchema, normalizePositions, parseUiSchemaText } from "./ui-schema";
import { createDefaultComponent } from "./definition/default-ext";
import { getUiComponentPaletteCategories, renderUiComponentCanvasCard, renderUiComponentPaletteHoverPreview, UiComponentIcon, type UiComponentPaletteItem } from "./ui-component-registry";

function buildSchemaText(schema: UiSchemaV1): string {
  return JSON.stringify(schema, null, 2);
}

export default function WorkflowPageBuilder(props: {
  uiSchemaText: string;
  onUiSchemaTextChange: (next: string) => void;
  nodes: ParsedWorkflowNode[];
  rawJson: unknown;
}) {
  const { uiSchemaText, onUiSchemaTextChange } = props;
  const [schema, setSchema] = useState<UiSchemaV1>(() => createEmptyUiSchema());
  const [parseError, setParseError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const placedComponents = schema.components;
  const selectedComponent = selectedId ? placedComponents.find((c) => c.id === selectedId) ?? null : null;

  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [draggingFromPalette, setDraggingFromPalette] = useState(false);
  const [draggingPlacedIndex, setDraggingPlacedIndex] = useState<number | null>(null);
  const [newlyAddedId, setNewlyAddedId] = useState<string | null>(null);

  const draggedItemRef = useRef<UiComponentPaletteItem | null>(null);
  const draggedPlacedRef = useRef<number | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    const parsed = parseUiSchemaText(uiSchemaText);
    if (parsed.ok === false) {
      setParseError(parsed.message);
      setSchema(createEmptyUiSchema());
      return;
    }
    setParseError(null);
    setSchema(parsed.value);
  }, [onUiSchemaTextChange, uiSchemaText]);

  useEffect(() => {
    if (!selectedId) return;
    if (!placedComponents.some((c) => c.id === selectedId)) {
      setSelectedId(null);
    }
  }, [placedComponents, selectedId]);

  useEffect(() => {
    if (!newlyAddedId) return;
    const timer = window.setTimeout(() => setNewlyAddedId(null), 500);
    return () => window.clearTimeout(timer);
  }, [newlyAddedId]);

  const commitComponents = (next: UiComponent[]) => {
    const normalized = normalizePositions(next);
    const nextSchema: UiSchemaV1 = { version: schema.version, components: normalized };
    setSchema(nextSchema);
    onUiSchemaTextChange(buildSchemaText(nextSchema));
  };

  const toggleCategory = (name: string) => {
    setCollapsedCategories((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const addComponent = (item: UiComponentPaletteItem, atIndex?: number) => {
    const next = createDefaultComponent(item.type, 0);
    setNewlyAddedId(next.id);
    const list = [...placedComponents];
    if (atIndex !== undefined) list.splice(atIndex, 0, next);
    else list.push(next);
    commitComponents(list);
    setSelectedId(next.id);
  };

  const removeComponent = (id: string) => {
    const next = placedComponents.filter((c) => c.id !== id);
    commitComponents(next);
    if (selectedId === id) setSelectedId(null);
  };

  const updateComponent = (next: UiComponent) => {
    commitComponents(placedComponents.map((c) => (c.id === next.id ? next : c)));
  };

  const handlePaletteDragStart = (e: React.DragEvent, item: UiComponentPaletteItem) => {
    draggedItemRef.current = item;
    draggedPlacedRef.current = null;
    setDraggingFromPalette(true);
    setDraggingPlacedIndex(null);
    e.dataTransfer.effectAllowed = "copy";
    const target = e.currentTarget as HTMLElement;
    const clone = target.cloneNode(true) as HTMLElement;
    clone.style.opacity = "0.85";
    clone.style.transform = "scale(1.05)";
    clone.style.position = "absolute";
    clone.style.top = "-9999px";
    document.body.appendChild(clone);
    e.dataTransfer.setDragImage(clone, clone.offsetWidth / 2, clone.offsetHeight / 2);
    setTimeout(() => document.body.removeChild(clone), 0);
  };

  const handlePaletteDragEnd = () => {
    setDraggingFromPalette(false);
    setDraggingPlacedIndex(null);
    setDragOverIndex(null);
    draggedItemRef.current = null;
  };

  const handlePlacedDragStart = (e: React.DragEvent, index: number) => {
    draggedPlacedRef.current = index;
    draggedItemRef.current = null;
    setDraggingPlacedIndex(index);
    setDraggingFromPalette(false);
    e.dataTransfer.effectAllowed = "move";
  };

  const handlePlacedDragEnd = () => {
    setDraggingPlacedIndex(null);
    setDraggingFromPalette(false);
    setDragOverIndex(null);
    draggedPlacedRef.current = null;
  };

  const getDropIndexByPointer = (clientY: number) => {
    if (placedComponents.length === 0) return 0;
    for (let i = 0; i < placedComponents.length; i += 1) {
      const current = placedComponents[i];
      const element = cardRefs.current[current.id];
      if (!element) continue;
      const rect = element.getBoundingClientRect();
      const midpoint = rect.top + rect.height / 2;
      if (clientY < midpoint) return i;
    }
    return placedComponents.length;
  };

  const handleCanvasDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = draggedPlacedRef.current !== null ? "move" : "copy";
    setDragOverIndex(getDropIndexByPointer(e.clientY));
  };

  const handleCanvasDragLeave = (e: React.DragEvent) => {
    const nextTarget = e.relatedTarget as Node | null;
    if (nextTarget && (e.currentTarget as HTMLElement).contains(nextTarget)) return;
    setDragOverIndex(null);
  };

  const reorder = (fromIndex: number, targetIndex: number) => {
    if (fromIndex === targetIndex || fromIndex === targetIndex - 1) return;
    const next = [...placedComponents];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(fromIndex < targetIndex ? targetIndex - 1 : targetIndex, 0, moved);
    commitComponents(next);
  };

  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const targetIndex = dragOverIndex ?? placedComponents.length;
    setDragOverIndex(null);
    setDraggingFromPalette(false);
    setDraggingPlacedIndex(null);

    if (draggedItemRef.current) {
      addComponent(draggedItemRef.current, targetIndex);
      draggedItemRef.current = null;
      return;
    }

    if (draggedPlacedRef.current !== null) {
      reorder(draggedPlacedRef.current, targetIndex);
      draggedPlacedRef.current = null;
    }
  };

  const handleItemDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverIndex(index);
    e.dataTransfer.dropEffect = draggedPlacedRef.current !== null ? "move" : "copy";
  };

  const handleItemDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverIndex(null);
    setDraggingFromPalette(false);
    setDraggingPlacedIndex(null);

    if (draggedItemRef.current) {
      addComponent(draggedItemRef.current, targetIndex);
      draggedItemRef.current = null;
      return;
    }

    if (draggedPlacedRef.current !== null) {
      reorder(draggedPlacedRef.current, targetIndex);
      draggedPlacedRef.current = null;
    }
  };

  const componentCategories = useMemo(() => getUiComponentPaletteCategories(), []);

  return (
    <div className="h-[calc(100vh-225px)] flex overflow-hidden border border-border rounded-md">
      <div className="w-[240px] shrink-0 h-full border-r border-border overflow-y-auto scrollbar-hidden bg-background p-3 space-y-4">
        {componentCategories.map((cat) => (
          <div key={cat.name}>
            <button
              onClick={() => toggleCategory(cat.name)}
              className="flex items-center gap-1 text-sm font-medium text-foreground mb-2 hover:opacity-80"
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${collapsedCategories[cat.name] ? "-rotate-90" : ""}`} />
              {cat.name}
            </button>
            {!collapsedCategories[cat.name] && (
              <div className="grid grid-cols-3 gap-1.5">
                {cat.items.map((item) => (
                  <HoverCard key={item.id} openDelay={1000} closeDelay={100}>
                    <HoverCardTrigger asChild>
                      <button
                        draggable
                        onDragStart={(e) => handlePaletteDragStart(e, item)}
                        onDragEnd={handlePaletteDragEnd}
                        className={`relative flex flex-col items-center justify-center gap-1 p-2 rounded-lg border border-border bg-background hover:border-primary hover:bg-accent transition-all text-center min-h-[68px] cursor-grab active:cursor-grabbing active:scale-95 ${
                          draggingFromPalette ? "" : ""
                        }`}
                      >
                        {item.badge && (
                          <span className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded-full leading-none font-medium">
                            {item.badge}
                          </span>
                        )}
                        <span className="text-foreground">
                          <UiComponentIcon iconName={item.iconName} className="w-5 h-5" />
                        </span>
                        <span className="text-[11px] text-foreground leading-tight line-clamp-2">{item.label}</span>
                      </button>
                    </HoverCardTrigger>
                    <HoverCardContent side="right" align="start" className="p-3 w-auto">
                      {renderUiComponentPaletteHoverPreview(item.type)}
                    </HoverCardContent>
                  </HoverCard>
                ))}
                {cat.allowCustom && (
                  <button className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg border-2 border-dashed border-border hover:border-primary hover:text-primary transition-colors text-center min-h-[68px] text-muted-foreground">
                    <Plus className="w-5 h-5" />
                    <span className="text-[11px] leading-tight">添加自定义组件</span>
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div
        className="flex-1 h-full bg-muted/20 flex items-stretch justify-center overflow-y-auto scrollbar-hidden border-r border-border"
        onDragOver={handleCanvasDragOver}
        onDragLeave={handleCanvasDragLeave}
        onDrop={handleCanvasDrop}
      >
        <div className="w-full max-w-[400px] h-full min-h-0 bg-background border-x border-border flex flex-col">
          {placedComponents.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3 p-8">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <Plus className="w-8 h-8" />
              </div>
              <p className="text-sm text-center">
                从左侧拖拽组件到此处
              </p>
            </div>
          ) : (
            <div className="p-4 space-y-1.5 flex-1 overflow-y-auto scrollbar-hidden">
              {placedComponents.map((comp, index) => (
                <div
                  key={comp.id}
                  ref={(el) => {
                    cardRefs.current[comp.id] = el;
                  }}
                  className={`transition-all duration-300 ease-out relative hover:z-50 ${
                    newlyAddedId === comp.id ? "animate-[slideInScale_0.35s_ease-out]" : ""
                  } ${draggingPlacedIndex === index ? "opacity-40 scale-95 z-0" : "opacity-100 scale-100 z-10"}`}
                >
                  <div
                    className={`transition-all duration-200 ease-out flex items-center ${
                      dragOverIndex === index ? "h-6 my-1 opacity-100" : "h-0 my-0 opacity-0"
                    }`}
                    onDragOver={(e) => handleItemDragOver(e, index)}
                    onDrop={(e) => handleItemDrop(e, index)}
                  >
                    <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                    <div className="flex-1 h-[3px] bg-primary rounded-full relative">
                      <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] px-2 py-0.5 rounded bg-primary text-primary-foreground whitespace-nowrap">
                        插入到此位置
                      </span>
                    </div>
                    <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                  </div>

                  {renderUiComponentCanvasCard({
                    comp,
                    index,
                    selected: selectedId === comp.id,
                    onSelect: () => setSelectedId(comp.id),
                    onChangeComponent: updateComponent,
                    onRemove: () => removeComponent(comp.id),
                    onDragStart: (e) => handlePlacedDragStart(e, index),
                    onDragEnd: handlePlacedDragEnd,
                  })}
                </div>
              ))}

              <div
                className={`transition-all duration-200 ease-out flex items-center ${
                  dragOverIndex === placedComponents.length ? "h-6 my-1 opacity-100" : "h-0 my-0 opacity-0"
                }`}
                onDragOver={(e) => handleItemDragOver(e, placedComponents.length)}
                onDrop={(e) => handleItemDrop(e, placedComponents.length)}
              >
                <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                <div className="flex-1 h-[3px] bg-primary rounded-full relative">
                  <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[10px] px-2 py-0.5 rounded bg-primary text-primary-foreground whitespace-nowrap">
                    插入到此位置
                  </span>
                </div>
                <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="w-[460px] shrink-0 h-full bg-background p-4 flex flex-col overflow-y-auto scrollbar-hidden">
        {parseError ? (
          <div className="text-sm text-destructive">
            ui_schema 解析失败：{parseError}
          </div>
        ) : selectedComponent ? (
          <WorkflowComponentPropertyPanel component={selectedComponent} nodes={props.nodes} rawJson={props.rawJson} onChange={updateComponent} />
        ) : (
          <div className="h-full flex items-center justify-center text-center text-muted-foreground text-sm">
            请选择画布中的组件以编辑属性
          </div>
        )}
      </div>
    </div>
  );
}
