import { Plus, Pencil, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { usePagedTotal } from "@/shared/hooks/use-paged-total";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/shared/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import CommonPaginationBar from "@/shared/components/CommonPaginationBar";
import {
  PageFilterBar,
  PageHeader,
  PageShell,
  SearchField,
  TableSurface,
} from "@/shared/components/page";
import MessageTemplateEditorDialog from "@/modules/integration/components/MessageTemplateEditorDialog";
import {
  createMessageTemplate,
  deleteMessageTemplate,
  listMessageTemplateVariables,
  listMessageTemplates,
  parseMessageTemplateVariables,
  updateMessageTemplate,
  type CreateMessageTemplateCommand,
  type MessageTemplate,
  type VariableDict,
  type VariableItem,
} from "@/shared/api/integration/message-template";
import { getMessageTemplateDictionaries } from "@/shared/api/integration/integration-dictionaries";
import { notify } from "@/shared/lib/notify";
export default function MessageTemplateManagementPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTemplateCode = searchParams.get("templateCode")?.trim() ?? "";
  const requestedTemplateType = searchParams.get("templateType")?.trim() ?? "";
  const requestedAction = searchParams.get("action")?.trim() ?? "";

  const [pageNo, setPageNo] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [keyword, setKeyword] = useState(requestedTemplateCode);
  const [appliedKeyword, setAppliedKeyword] = useState(requestedTemplateCode);
  const [templateTypeFilter, setTemplateTypeFilter] = useState<string>(requestedTemplateType || "all");
  const [regionFilter, setRegionFilter] = useState<string>("all");

  const applyKeywordSearch = () => {
    const normalized = keyword.trim();
    setKeyword(normalized);
    setAppliedKeyword(normalized);
    setPageNo(1);
  };

  const templateTypeParam = templateTypeFilter === "all" ? undefined : templateTypeFilter;
  const regionParam = regionFilter === "all" ? undefined : regionFilter;
  const dictionaryQuery = useQuery({
    queryKey: ["intMessageTemplateDictionaries"],
    queryFn: getMessageTemplateDictionaries,
  });
  const templateTypeOptions = useMemo(
    () => dictionaryQuery.data?.templateTypes ?? [],
    [dictionaryQuery.data?.templateTypes],
  );
  const regionOptions = useMemo(
    () => dictionaryQuery.data?.regions ?? [],
    [dictionaryQuery.data?.regions],
  );
  const templateTypeLabelMap = useMemo(
    () => new Map(templateTypeOptions.map((opt) => [opt.value, opt.label])),
    [templateTypeOptions]
  );
  const regionLabelMap = useMemo(
    () => new Map(regionOptions.map((opt) => [opt.value, opt.label])),
    [regionOptions]
  );

  const listQuery = useQuery({
    queryKey: ["intMessageTemplates", pageNo, pageSize, appliedKeyword, templateTypeFilter, regionFilter],
    queryFn: () =>
      listMessageTemplates({
        pageNo,
        pageSize,
        total: requestTotal,
        keyword: appliedKeyword.trim() ? appliedKeyword.trim() : undefined,
        templateType: templateTypeParam,
        region: regionParam,
      }),
  });

  const requestTotal = usePagedTotal(pageNo, listQuery.data?.page?.total);

  useEffect(() => {
    if (!listQuery.isError) return;
    notify.fromError(listQuery.error, "请求失败", "加载失败");
  }, [listQuery.error, listQuery.isError]);

  useEffect(() => {
    if (!dictionaryQuery.isError) return;
    notify.fromError(dictionaryQuery.error, "请求失败", "字典加载失败");
  }, [dictionaryQuery.error, dictionaryQuery.isError]);

  const items = useMemo(() => listQuery.data?.items ?? [], [listQuery.data?.items]);
  const pageTotal = listQuery.data?.page?.total ?? 0;
  const canNextPage = useMemo(() => {
    if (pageTotal > 0) return pageNo * pageSize < pageTotal;
    return items.length === pageSize;
  }, [items.length, pageNo, pageSize, pageTotal]);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["intMessageTemplates"] });
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteMessageTemplate(id),
    onSuccess: async () => {
      notify.success("删除成功");
      await refresh();
    },
    onError: (e) => {
      notify.fromError(e, "请求失败", "删除失败");
    },
  });

  const upsertMutation = useMutation({
    mutationFn: (p: { mode: "create" | "edit"; id?: string; payload: CreateMessageTemplateCommand }) => {
      if (p.mode === "create") {
        return createMessageTemplate(p.payload);
      }
      return updateMessageTemplate(p.id!, p.payload);
    },
    onSuccess: async (_data, variables) => {
      notify.success(variables.mode === "create" ? "创建成功" : "保存成功");
      await refresh();
    },
    onError: (e) => {
      notify.fromError(e, "请求失败", "保存失败");
    },
  });

  const [editorOpen, setEditorOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<MessageTemplate | null>(null);

  const [formTemplateCode, setFormTemplateCode] = useState("");
  const [formTemplateName, setFormTemplateName] = useState("");
  const [formTemplateType, setFormTemplateType] = useState<string>("sms");
  const [formRegion, setFormRegion] = useState<string>("domestic");
  const [formExternalTemplateId, setFormExternalTemplateId] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formVariables, setFormVariables] = useState<string[]>([]);
  const [variablesInitialized, setVariablesInitialized] = useState(false);

  const variablesQuery = useQuery({
    queryKey: ["intMessageTemplateVariables", formTemplateType, formTemplateCode],
    queryFn: async () => {
      const res = await listMessageTemplateVariables({ templateType: formTemplateType, templateCode: formTemplateCode.trim() });
      if (Array.isArray(res)) {
        const entries = (res as VariableItem[]).map((v) => [v.key, v] as const);
        return Object.fromEntries(entries) as VariableDict;
      }
      if (!res || typeof res !== "object") return {};
      return res as VariableDict;
    },
    enabled: editorOpen && !!formTemplateCode.trim(),
  });

  const openCreate = () => {
    setEditorMode("create");
    setEditing(null);
    setFormTemplateCode("");
    setFormTemplateName("");
    setFormTemplateType("sms");
    setFormRegion("domestic");
    setFormExternalTemplateId("");
    setFormContent("");
    setFormVariables([]);
    setVariablesInitialized(false);
    setFormError(null);
    setEditorOpen(true);
  };

  const openEdit = (t: MessageTemplate) => {
    setEditorMode("edit");
    setEditing(t);
    setFormTemplateCode(t.templateCode || "");
    setFormTemplateName(t.templateName || "");
    setFormTemplateType(t.templateType || "sms");
    setFormRegion(t.region || "domestic");
    setFormExternalTemplateId(t.externalTemplateId || "");
    setFormContent(t.content || "");
    const parsedVariables = parseMessageTemplateVariables(t);
    setFormVariables(parsedVariables);
    setVariablesInitialized(parsedVariables.length > 0);
    setFormError(null);
    setEditorOpen(true);
  };

  useEffect(() => {
    if (!requestedTemplateCode) return;
    setKeyword((prev) => (prev === requestedTemplateCode ? prev : requestedTemplateCode));
    setAppliedKeyword((prev) => (prev === requestedTemplateCode ? prev : requestedTemplateCode));
    setPageNo(1);
  }, [requestedTemplateCode]);

  useEffect(() => {
    if (!requestedTemplateType) return;
    setTemplateTypeFilter((prev) => (prev === requestedTemplateType ? prev : requestedTemplateType));
    setPageNo(1);
  }, [requestedTemplateType]);

  useEffect(() => {
    if (requestedAction !== "edit" || !requestedTemplateCode || listQuery.isLoading || editorOpen) {
      return;
    }
    const matched = items.find(
      (item) => item.templateCode === requestedTemplateCode && (!requestedTemplateType || item.templateType === requestedTemplateType),
    );
    if (!matched) {
      return;
    }
    openEdit(matched);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("action");
    setSearchParams(nextParams, { replace: true });
  }, [
    editorOpen,
    items,
    listQuery.isLoading,
    requestedAction,
    requestedTemplateCode,
    requestedTemplateType,
    searchParams,
    setSearchParams,
  ]);

  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState<MessageTemplate | null>(null);
  const openDelete = (t: MessageTemplate) => {
    setDeleting(t);
    setDeleteConfirmOpen(true);
  };
  const variableDict = variablesQuery.data ?? {};

  useEffect(() => {
    if (editorMode !== "create" || !editorOpen) return;
    setVariablesInitialized(false);
    setFormVariables([]);
  }, [editorMode, editorOpen, formTemplateCode, formTemplateType]);

  useEffect(() => {
    if (!editorOpen || variablesInitialized || !variablesQuery.isSuccess) return;
    const keys = Object.keys(variableDict);
    if (keys.length === 0) return;
    const otpSmsDefault =
      formTemplateType === "sms" && formTemplateCode.trim().startsWith("otp_") && keys.includes("code")
        ? ["code"]
        : [];
    setFormVariables((prev) => (prev.length > 0 ? prev.filter((key) => keys.includes(key)) : otpSmsDefault));
    setVariablesInitialized(true);
  }, [
    editorOpen,
    formTemplateCode,
    formTemplateType,
    variableDict,
    variablesInitialized,
    variablesQuery.isSuccess,
  ]);

  const handleSave = async () => {
    if (!formTemplateCode.trim()) {
      setFormError("templateCode 必填");
      return;
    }
    if (!formTemplateName.trim()) {
      setFormError("模板名称必填");
      return;
    }
    if (!formRegion.trim()) {
      setFormError("Region 必填");
      return;
    }
    if (formVariables.length === 0) {
      setFormError("请从变量字典中至少选择一个变量");
      return;
    }
    if (formTemplateType === "sms" && !formExternalTemplateId.trim()) {
      setFormError("短信模板需要填写外部模板ID");
      return;
    }
    if ((formTemplateType === "email" || formTemplateType === "inbox") && !formContent.trim()) {
      setFormError("邮件/站内信模板内容必填");
      return;
    }
    setFormError(null);
    const payload: CreateMessageTemplateCommand = {
      templateCode: formTemplateCode.trim(),
      templateName: formTemplateName.trim(),
      templateType: formTemplateType,
      region: formRegion,
      externalTemplateId: formExternalTemplateId.trim() ? formExternalTemplateId.trim() : null,
      content: formContent,
      variables: formVariables,
    };
    await upsertMutation.mutateAsync({ mode: editorMode, id: editing?.id, payload });
    setEditorOpen(false);
  };

  if (editorOpen) {
    return (
      <MessageTemplateEditorDialog
        mode={editorMode}
        onCancel={() => {
          setFormError(null);
          setEditorOpen(false);
        }}
        onSave={handleSave}
        savePending={upsertMutation.isPending}
        formError={formError}
        templateTypeOptions={templateTypeOptions}
        regionOptions={regionOptions}
        formTemplateCode={formTemplateCode}
        setFormTemplateCode={setFormTemplateCode}
        formTemplateName={formTemplateName}
        setFormTemplateName={setFormTemplateName}
        formTemplateType={formTemplateType}
        setFormTemplateType={setFormTemplateType}
        formRegion={formRegion}
        setFormRegion={setFormRegion}
        formExternalTemplateId={formExternalTemplateId}
        setFormExternalTemplateId={setFormExternalTemplateId}
        formContent={formContent}
        setFormContent={setFormContent}
        formVariables={formVariables}
        setFormVariables={setFormVariables}
        variableDict={variableDict}
      />
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="消息模板管理"
        actions={
          <>
            <Button variant="pageOutline" onClick={() => refresh()} disabled={listQuery.isFetching}>
              刷新
            </Button>
            <Button variant="page" onClick={openCreate}>
              <Plus className="w-4 h-4" />
              新增模板
            </Button>
          </>
        }
      />

      <PageFilterBar className="!flex-nowrap overflow-x-auto">
          <Select
            value={templateTypeFilter}
            onValueChange={(v) => {
              setTemplateTypeFilter(v);
              setPageNo(1);
            }}
          >
            <SelectTrigger className="subpage-native-select w-40 h-9">
              <SelectValue placeholder="模板类型" />
            </SelectTrigger>
            <SelectContent className="subpage-select-content">
              <SelectItem className="subpage-select-item" value="all">
                全部类型
              </SelectItem>
              {templateTypeOptions.map((opt) => (
                <SelectItem key={opt.value} className="subpage-select-item" value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={regionFilter}
            onValueChange={(v) => {
              setRegionFilter(v);
              setPageNo(1);
            }}
          >
            <SelectTrigger className="subpage-native-select w-36 h-9">
              <SelectValue placeholder="Region" />
            </SelectTrigger>
            <SelectContent className="subpage-select-content">
              <SelectItem className="subpage-select-item" value="all">
                全部
              </SelectItem>
              {regionOptions.map((opt) => (
                <SelectItem key={opt.value} className="subpage-select-item" value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <SearchField
            wrapClassName="!w-[380px] !max-w-[380px] shrink-0"
            placeholder="搜索 templateCode / 名称，回车搜索"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyKeywordSearch();
              }
            }}
          />
      </PageFilterBar>

      <TableSurface>
        <Table className="text-[13px]">
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[150px]">模板名称</TableHead>
              <TableHead className="min-w-[100px]">模板业务编码</TableHead>
              <TableHead className="w-58">类型</TableHead>
              <TableHead className="w-58">国内/国际</TableHead>
              <TableHead className="min-w-[160px]">外部模板ID</TableHead>
              <TableHead className="w-32">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {listQuery.isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                  加载中...
                </TableCell>
              </TableRow>
            )}
            {!listQuery.isLoading &&
              items.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{t.templateName}</TableCell>
                  <TableCell className="font-medium text-primary">{t.templateCode}</TableCell>
                  <TableCell className="text-muted-foreground">{templateTypeLabelMap.get(t.templateType) || t.templateType || "-"}</TableCell>
                  <TableCell className="text-muted-foreground">{regionLabelMap.get(t.region) || t.region || "-"}</TableCell>
                  <TableCell className="text-muted-foreground">{t.externalTemplateId || "-"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-primary hover:text-primary"
                        title="编辑"
                        onClick={() => openEdit(t)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:bg-destructive/10"
                        title="删除"
                        onClick={() => openDelete(t)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            {!listQuery.isLoading && items.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                  暂无消息模板
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableSurface>

      <CommonPaginationBar
        total={pageTotal || items.length}
        pageNo={pageNo}
        pageSize={pageSize}
        canNextPage={canNextPage}
        onPageNoChange={setPageNo}
        onPageSizeChange={(nextPageSize) => {
          setPageSize(nextPageSize);
          setPageNo(1);
        }}
      />

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              将删除消息模板：{deleting?.templateName || "-"}（{deleting?.templateCode || "-"}）。该操作不可恢复。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deleting) return;
                await deleteMutation.mutateAsync(deleting.id);
                setDeleteConfirmOpen(false);
                setDeleting(null);
              }}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
