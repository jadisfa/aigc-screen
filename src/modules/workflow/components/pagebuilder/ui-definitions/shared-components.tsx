import { useEffect, useState } from "react";
import { Textarea } from "@/shared/ui/textarea";

// OptionsTextarea：
// - 用于在扩展配置面板（renderExtEditor）中编辑“多行选项”
// - UI 展示为一个 Textarea：每行一个 option
// - 内部会把文本转换为 string[] 并回传给上层
export function OptionsTextarea(props: { options: string[]; onChange: (opts: string[]) => void }) {
  const [text, setText] = useState(() => props.options.join("\n"));

  // 当外部 options 更新时，同步刷新 textarea 文本
  // 这里做了去空行/去空白的比较，避免循环触发 setState
  useEffect(() => {
    const newText = props.options.join("\n");
    if (text.split("\n").filter((x) => x.trim()).join("\n") !== props.options.filter((x) => x.trim()).join("\n")) {
      setText(newText);
    }
  }, [props.options, text]);

  return (
    <Textarea
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const nextOptions = e.target.value.split("\n").map((x) => x.trim()).filter((x) => x);
        props.onChange(nextOptions);
      }}
      rows={4}
    />
  );
}
