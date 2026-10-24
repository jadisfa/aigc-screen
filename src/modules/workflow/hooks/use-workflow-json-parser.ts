import { useCallback, useEffect, useRef, useState } from "react";
import { parseWorkflowJson, type ParsedWorkflowNode } from "@/shared/api/workflow/workflow";
import { parseJsonText } from "@/modules/workflow/lib/wizard-json";

export type WorkflowJsonParseState = {
  workflowJsonPreview: unknown | null;
  rawJson: unknown | null;
  nodes: ParsedWorkflowNode[];
  parseError: string | null;
  isParsing: boolean;
  parsedFromText: string;
};

export function useWorkflowJsonParser(workflowJsonText: string) {
  const [workflowJsonPreview, setWorkflowJsonPreview] = useState<unknown | null>(null);
  const [rawJson, setRawJson] = useState<unknown | null>(null);
  const [nodes, setNodes] = useState<ParsedWorkflowNode[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [parsedFromText, setParsedFromText] = useState("");

  const parseSeqRef = useRef(0);

  const reset = useCallback(() => {
    setWorkflowJsonPreview(null);
    setRawJson(null);
    setNodes([]);
    setParseError(null);
    setIsParsing(false);
    setParsedFromText("");
  }, []);

  const parseNow = useCallback(async (): Promise<{ ok: true; rawJson: unknown; nodes: ParsedWorkflowNode[] } | { ok: false; message: string }> => {
    const text = workflowJsonText;
    const trimmed = text.trim();
    if (!trimmed) {
      reset();
      return { ok: false, message: "workflow JSON 不能为空" };
    }

    const localParsed = parseJsonText(text, "workflow JSON");
    if (localParsed.ok === false) {
      reset();
      setParseError(localParsed.message);
      return { ok: false, message: localParsed.message };
    }

    setWorkflowJsonPreview(localParsed.value);
    setParseError(null);
    setIsParsing(true);
    const seq = ++parseSeqRef.current;

    try {
      const result = await parseWorkflowJson(text);
      if (parseSeqRef.current !== seq) return { ok: false, message: "解析已取消" };
      setRawJson(result.rawJson);
      setNodes(result.nodes);
      setParsedFromText(text);
      setParseError(null);
      setIsParsing(false);
      return { ok: true, rawJson: result.rawJson, nodes: result.nodes };
    } catch (e) {
      if (parseSeqRef.current !== seq) return { ok: false, message: "解析已取消" };
      const msg = e instanceof Error ? e.message : "解析失败";
      setRawJson(null);
      setNodes([]);
      setParsedFromText("");
      setParseError(msg);
      setIsParsing(false);
      return { ok: false, message: msg };
    }
  }, [reset, workflowJsonText]);

  useEffect(() => {
    const text = workflowJsonText;
    const trimmed = text.trim();
    if (!trimmed) {
      reset();
      return;
    }

    const localParsed = parseJsonText(text, "workflow JSON");
    if (localParsed.ok === false) {
      reset();
      setParseError(localParsed.message);
      return;
    }

    setWorkflowJsonPreview(localParsed.value);
    setRawJson(null);
    setNodes([]);
    setParsedFromText("");
    setParseError(null);

    const seq = ++parseSeqRef.current;
    setIsParsing(true);
    const timer = window.setTimeout(async () => {
      try {
        const result = await parseWorkflowJson(text);
        if (parseSeqRef.current !== seq) return;
        setRawJson(result.rawJson);
        setNodes(result.nodes);
        setParsedFromText(text);
        setParseError(null);
        setIsParsing(false);
      } catch (e) {
        if (parseSeqRef.current !== seq) return;
        setRawJson(null);
        setNodes([]);
        setParsedFromText("");
        setParseError(e instanceof Error ? e.message : "解析失败");
        setIsParsing(false);
      }
    }, 350);

    return () => window.clearTimeout(timer);
  }, [reset, workflowJsonText]);

  const state: WorkflowJsonParseState = { workflowJsonPreview, rawJson, nodes, parseError, isParsing, parsedFromText };
  return { ...state, parseNow, reset };
}
