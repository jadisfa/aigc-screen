import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BookOpen, ExternalLink, Loader2 } from "lucide-react";
import { cn } from "@/shared/lib/utils";

const DOC_URL = "/docs/ai-api.md";

type TocItem = {
  id: string;
  text: string;
  level: 2 | 3 | 4;
};

/** 与文档内锚点风格对齐：去点号/括号/反引号，空白转连字符 */
function slugifyHeading(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[`*_~]/g, "")
    .replace(/[（(]/g, "")
    .replace(/[）)]/g, "")
    .replace(/\./g, "")
    .replace(/[^\w\u4e00-\u9fff\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function extractText(node: unknown): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (node && typeof node === "object" && "props" in node) {
    const props = (node as { props?: { children?: unknown } }).props;
    return extractText(props?.children);
  }
  return "";
}

function parseToc(markdown: string): TocItem[] {
  const items: TocItem[] = [];
  const seen = new Map<string, number>();
  for (const line of markdown.split(/\r?\n/)) {
    const match = /^(#{2,4})\s+(.+?)\s*$/.exec(line);
    if (!match) continue;
    const level = match[1].length as 2 | 3 | 4;
    const text = match[2].replace(/#+$/, "").trim();
    if (!text || text === "目录") continue;
    let id = slugifyHeading(text);
    if (!id) continue;
    const count = seen.get(id) ?? 0;
    seen.set(id, count + 1);
    if (count > 0) id = `${id}-${count}`;
    items.push({ id, text, level });
  }
  return items;
}

/**
 * 控制台内嵌 AI 应用接口文档（内容来自 contracts/openapi，构建时同步到 public/docs）。
 */
const ApiDocsPage = () => {
  const [markdown, setMarkdown] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);
  const toc = useMemo(() => parseToc(markdown), [markdown]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`${DOC_URL}?t=${Date.now()}`);
        if (!res.ok) {
          throw new Error(`文档加载失败（${res.status}）`);
        }
        const text = await res.text();
        if (!cancelled) {
          setMarkdown(text);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "文档加载失败");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const root = contentRef.current;
    if (!root || toc.length === 0) return;

    const headings = toc
      .map((item) => root.querySelector<HTMLElement>(`#${CSS.escape(item.id)}`))
      .filter((el): el is HTMLElement => Boolean(el));

    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target?.id) {
          setActiveId(visible[0].target.id);
        }
      },
      {
        root,
        rootMargin: "0px 0px -70% 0px",
        threshold: [0, 1],
      }
    );

    headings.forEach((el) => observer.observe(el));
    if (!activeId) setActiveId(headings[0].id);

    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅在文档 TOC 变化后重建观察
  }, [toc, markdown]);

  const scrollToHeading = (id: string) => {
    const root = contentRef.current;
    const el = root?.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
    if (!root || !el) return;
    setActiveId(id);
    root.scrollTo({
      top: el.offsetTop - 16,
      behavior: "smooth",
    });
  };

  const headingComponents = useMemo(() => {
    const makeHeading = (Tag: "h2" | "h3" | "h4") =>
      function DocHeading({ children }: { children?: React.ReactNode }) {
        const text = extractText(children);
        const id = slugifyHeading(text);
        return <Tag id={id}>{children}</Tag>;
      };
    return {
      h2: makeHeading("h2"),
      h3: makeHeading("h3"),
      h4: makeHeading("h4"),
    };
  }, []);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-background px-6 py-3">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          <h1 className="text-[15px] font-semibold text-foreground">AI 应用接口文档</h1>
        </div>
        {/* <a
          href={DOC_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
        >
          原始 Markdown
          <ExternalLink className="h-3.5 w-3.5" />
        </a> */}
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {!loading && !error && toc.length > 0 ? (
          <aside className="hidden w-[240px] shrink-0 flex-col border-r border-border bg-muted/20 md:flex lg:w-[280px]">
            <div className="shrink-0 px-4 py-3 text-[12px] font-medium text-muted-foreground">目录</div>
            <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
              <ul className="space-y-0.5">
                {toc.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => scrollToHeading(item.id)}
                      className={cn(
                        "w-full rounded-md px-2.5 py-1.5 text-left text-[12px] leading-5 transition-colors",
                        item.level === 2 && "font-medium",
                        item.level === 3 && "pl-6",
                        item.level === 4 && "pl-11 text-muted-foreground",
                        activeId === item.id
                          ? "bg-primary/10 text-primary"
                          : "text-foreground/80 hover:bg-muted hover:text-foreground"
                      )}
                      title={item.text}
                    >
                      <span className="line-clamp-2">{item.text}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>
        ) : null}

        <div ref={contentRef} className="min-h-0 min-w-0 flex-1 overflow-y-auto px-6 py-6">
          {loading ? (
            <div className="flex min-h-[40vh] items-center justify-center gap-2 text-[13px] text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              正在加载接口文档…
            </div>
          ) : error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-[13px] text-destructive">
              {error}
            </div>
          ) : (
            <article
              className="mx-auto max-w-4xl scroll-mt-4 break-words pb-10 text-[14px] leading-7 text-foreground/95
                [&_h1]:mb-4 [&_h1]:mt-2 [&_h1]:text-[22px] [&_h1]:font-semibold [&_h1]:leading-8
                [&_h2]:mb-3 [&_h2]:mt-8 [&_h2]:scroll-mt-4 [&_h2]:border-b [&_h2]:border-border [&_h2]:pb-2 [&_h2]:text-[18px] [&_h2]:font-semibold
                [&_h3]:mb-2 [&_h3]:mt-6 [&_h3]:scroll-mt-4 [&_h3]:text-[16px] [&_h3]:font-semibold
                [&_h4]:mb-2 [&_h4]:mt-5 [&_h4]:scroll-mt-4 [&_h4]:text-[15px] [&_h4]:font-semibold
                [&_p]:my-3 [&_p]:leading-7
                [&_a]:text-primary hover:[&_a]:underline
                [&_strong]:font-semibold
                [&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-5
                [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-5
                [&_li]:my-1
                [&_hr]:my-6 [&_hr]:border-border
                [&_code]:rounded-sm [&_code]:bg-muted/60 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.9em]
                [&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-muted/50 [&_pre]:px-4 [&_pre]:py-3
                [&_pre>code]:bg-transparent [&_pre>code]:p-0
                [&_blockquote]:border-l-2 [&_blockquote]:border-muted-foreground/25 [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground
                [&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_table]:text-[13px]
                [&_th]:border [&_th]:border-border [&_th]:bg-muted/40 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-medium
                [&_td]:border [&_td]:border-border [&_td]:px-3 [&_td]:py-2"
            >
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={headingComponents}>
                {markdown}
              </ReactMarkdown>
            </article>
          )}
        </div>
      </div>
    </div>
  );
};

export default ApiDocsPage;
