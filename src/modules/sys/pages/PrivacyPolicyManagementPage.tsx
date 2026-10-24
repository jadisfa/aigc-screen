import { Eye, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { resolvePagedTotal } from "@/shared/hooks/use-paged-total";
import {
  PageHeader,
  PageShell,
  StatusBadge,
  TableSurface,
} from "@/shared/components/page";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import LegalDocumentEditor from "@/modules/sys/components/LegalDocumentEditor";
import {
  createLegalDocument,
  deleteLegalDocument,
  getLegalDocument,
  getPublicPrivacyPolicy,
  listLegalDocuments,
  publishLegalDocument,
  updateLegalDocument,
  type LegalDocument,
  type LegalDocumentPublic,
  type LegalDocumentSummary,
} from "@/shared/api/sys/system-config";
import { formatDateTime } from "@/shared/lib/datetime";
import { notify } from "@/shared/lib/notify";

export default function PrivacyPolicyManagementPage() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [pageNo, setPageNo] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [items, setItems] = useState<LegalDocumentSummary[]>([]);
  const [total, setTotal] = useState(0);

  const [editing, setEditing] = useState(false);
  const [editingDoc, setEditingDoc] = useState<LegalDocument | null>(null);

  const [formTitle, setFormTitle] = useState("");
  const [formVersion, setFormVersion] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const [publicOpen, setPublicOpen] = useState(false);
  const [publicDoc, setPublicDoc] = useState<LegalDocumentPublic | null>(null);

  const statusLabel = useMemo(() => {
    return (status: string) => (status === "online" ? "已发布" : "草稿");
  }, []);

  const refreshList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listLegalDocuments({ docType: "privacy_policy", pageNo, pageSize, total: resolvePagedTotal(pageNo, total) });
      setItems(res.items || []);
      setTotal(res.page?.total || 0);
    } catch (e) {
      notify.error("加载失败", { description: e instanceof Error ? e.message : "请求失败" });
    } finally {
      setLoading(false);
    }
  }, [pageNo, pageSize, total]);

  const refreshPublic = useCallback(async () => {
    try {
      setPublicDoc(await getPublicPrivacyPolicy());
    } catch {
      setPublicDoc(null);
    }
  }, []);

  function openCreate() {
    setEditingDoc(null);
    setFormTitle("");
    setFormVersion("");
    setFormContent("");
    setFormError(null);
    setEditing(true);
  }

  async function openEdit(id: string) {
    setLoading(true);
    try {
      const doc = await getLegalDocument(id);
      if (doc.status !== "offline") {
        notify.error("不可编辑", { description: "线上版本不允许编辑，建议新增版本后上线" });
        return;
      }
      setEditingDoc(doc);
      setFormTitle(doc.title || "");
      setFormVersion(doc.version || "");
      setFormContent(doc.content || "");
      setFormError(null);
      setEditing(true);
    } catch (e) {
      notify.error("加载失败", { description: e instanceof Error ? e.message : "请求失败" });
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (saving) return;
    if (!formTitle.trim() || !formVersion.trim()) {
      setFormError("请填写标题与版本号");
      return;
    }
    if (!formContent.trim()) {
      setFormError("请填写协议内容");
      return;
    }
    setFormError(null);
    setSaving(true);
    try {
      if (editingDoc) {
        await updateLegalDocument(editingDoc.id, {
          title: formTitle.trim(),
          version: formVersion.trim(),
          content: formContent,
        });
      } else {
        await createLegalDocument({
          docType: "privacy_policy",
          title: formTitle.trim(),
          version: formVersion.trim(),
          status: "offline",
          content: formContent,
        });
      }
      notify.success(editingDoc ? "保存成功" : "创建成功");
      setEditing(false);
      await refreshList();
    } catch (e) {
      notify.error("保存失败", { description: e instanceof Error ? e.message : "请求失败" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: LegalDocumentSummary) {
    if (item.status !== "offline") {
      notify.error("不可删除", { description: "仅允许删除草稿（offline）版本" });
      return;
    }
    const ok = window.confirm(`确认删除版本「${item.title}」吗？`);
    if (!ok) return;
    try {
      await deleteLegalDocument(item.id);
      notify.success("删除成功");
      await refreshList();
    } catch (e) {
      notify.error("删除失败", { description: e instanceof Error ? e.message : "请求失败" });
    }
  }

  async function handlePublish(item: LegalDocumentSummary) {
    const ok = window.confirm(`确认上线版本「${item.title}」吗？上线会自动下线同类型其它线上版本。`);
    if (!ok) return;
    try {
      await publishLegalDocument(item.id);
      notify.success("上线成功");
      await refreshList();
      await refreshPublic();
    } catch (e) {
      notify.error("上线失败", { description: e instanceof Error ? e.message : "请求失败" });
    }
  }

  useEffect(() => {
    void refreshList();
  }, [refreshList]);

  useEffect(() => {
    void refreshPublic();
  }, [refreshPublic]);

  if (editing) {
    return (
      <LegalDocumentEditor
        editingDoc={editingDoc}
        formTitle={formTitle}
        setFormTitle={(v) => {
          setFormError(null);
          setFormTitle(v);
        }}
        formVersion={formVersion}
        setFormVersion={(v) => {
          setFormError(null);
          setFormVersion(v);
        }}
        formContent={formContent}
        setFormContent={(v) => {
          setFormError(null);
          setFormContent(v);
        }}
        saving={saving}
        onSave={handleSave}
        onCancel={() => setEditing(false)}
        docTypeName="政策"
        formError={formError}
      />
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="隐私政策"
        titleExtra={
          publicDoc ? (
            <Badge variant="outline" className="text-xs">
              线上版本：{publicDoc.version}
            </Badge>
          ) : null
        }
        actions={
          <>
            <Button variant="pageOutline" onClick={async () => { await refreshPublic(); setPublicOpen(true); }} disabled={loading}>
              <Eye className="w-4 h-4 mr-1" />
              查看线上版本
            </Button>
            <Button variant="page" onClick={openCreate} disabled={loading}>
              <Plus className="w-4 h-4" />
              新增版本
            </Button>
          </>
        }
      />

      <TableSurface>
        <Table className="text-[13px]">
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">序号</TableHead>
              <TableHead className="min-w-[160px]">标题</TableHead>
              <TableHead className="w-28">版本号</TableHead>
              <TableHead className="w-24">编辑者</TableHead>
              <TableHead className="w-44">编辑时间</TableHead>
              <TableHead className="w-24">状态</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                 <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                  暂无数据
                </TableCell>
              </TableRow>
            ) : (
              items.map((v, idx) => (
                <TableRow key={v.id}>
                  <TableCell>{(pageNo - 1) * pageSize + idx + 1}</TableCell>
                  <TableCell>{v.title}</TableCell>
                  <TableCell>{v.version}</TableCell>
                  <TableCell>{v.editor || "-"}</TableCell>
                  <TableCell>{formatDateTime(v.editedAt)}</TableCell>
                  <TableCell>
                    <StatusBadge tone={v.status === "online" ? "success" : "warning"}>
                      {statusLabel(v.status)}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-primary hover:text-primary" onClick={() => void openEdit(v.id)} title="编辑" disabled={v.status !== "offline"}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-emerald-700 hover:bg-emerald-100" onClick={() => void handlePublish(v)} title="上线">
                        <Upload className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 border-destructive text-destructive hover:bg-destructive/10"
                        onClick={() => void handleDelete(v)}
                        title="删除"
                        disabled={v.status !== "offline"}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableSurface>

      <div className="flex items-center justify-end mt-4 gap-3 text-sm text-muted-foreground">
        <span>共 {total || items.length} 条</span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" disabled={pageNo === 1} onClick={() => setPageNo(1)}>
            {"<<"}
          </Button>
          <Button variant="ghost" size="sm" disabled={pageNo === 1} onClick={() => setPageNo((p) => Math.max(1, p - 1))}>
            {"<"}
          </Button>
          <Button variant="ghost" size="sm" disabled={loading || items.length < pageSize} onClick={() => setPageNo((p) => p + 1)}>
            {">"}
          </Button>
        </div>
        <span>
          第 {pageNo} 页 / {pageSize} 条
        </span>

        <div className="subpage-toolbar-end">
          <Select
            value={String(pageSize)}
            onValueChange={(v) => {
              setPageSize(Number(v));
              setPageNo(1);
            }}
          >
            <SelectTrigger className="subpage-native-select w-24 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="subpage-select-content">
              <SelectItem className="subpage-select-item" value="10">
                10/页
              </SelectItem>
              <SelectItem className="subpage-select-item" value="20">
                20/页
              </SelectItem>
              <SelectItem className="subpage-select-item" value="50">
                50/页
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Dialog open={publicOpen} onOpenChange={setPublicOpen}>
        <DialogContent className="max-w-[100vw] w-screen h-screen m-0 p-6 flex flex-col rounded-none">
          <DialogHeader>
            <DialogTitle>线上版本</DialogTitle>
          </DialogHeader>
           <div className="flex-1 overflow-y-auto mt-4 bg-muted/20 scrollbar-hide">
            {publicDoc ? (
              <div className="max-w-4xl mx-auto bg-background p-4 shadow-sm rounded-md">
                <h1 className="text-2xl font-bold text-center text-foreground mb-3">{publicDoc.title}</h1>
                <p className="text-center text-sm text-muted-foreground mb-8">版本：{publicDoc.version}</p>
                <div className="prose max-w-none" dangerouslySetInnerHTML={{ __html: publicDoc.content }} />
              </div>
            ) : (
              <div className="text-sm text-muted-foreground flex items-center justify-center h-full">未获取到线上版本</div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
