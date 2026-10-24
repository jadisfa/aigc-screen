import { Plus, Shield, CheckCircle2, Pencil, Trash2, Eraser } from "lucide-react";
import { useState } from "react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Badge } from "@/shared/ui/badge";
import { Switch } from "@/shared/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shared/ui/dialog";
import CommonPaginationBar from "@/shared/components/CommonPaginationBar";
import {
  PageHeader,
  PageShell,
  StatusBadge,
  TableSurface,
} from "@/shared/components/page";

interface Server {
  id: number;
  name: string;
  address: string;
  status: "ONLINE" | "OFFLINE";
  queue: number;
  concurrency: number;
  priority: number;
  exclusive: string;
  enabled: boolean;
}

const mockServers: Server[] = [
  { id: 1, name: "3333", address: "https://34gr6613wa70.vicp.fun/", status: "OFFLINE", queue: 0, concurrency: 3, priority: 0, exclusive: "", enabled: true },
  { id: 2, name: "RH", address: "https://www.runninghub.cn/proxy/d70555280", status: "OFFLINE", queue: 0, concurrency: 1, priority: 0, exclusive: "", enabled: true },
  { id: 3, name: "123", address: "https://34gr6613wa71.vicp.fun/", status: "OFFLINE", queue: 0, concurrency: 1, priority: 0, exclusive: "", enabled: true },
  { id: 4, name: "777", address: "https://34gr6613wa21.vicp.fun/", status: "OFFLINE", queue: 0, concurrency: 1, priority: 0, exclusive: "", enabled: true },
  { id: 5, name: "Batik", address: "https://vjjbymwb.proxy.gptpro.ink/", status: "OFFLINE", queue: 0, concurrency: 1, priority: 0, exclusive: "", enabled: true },
  { id: 6, name: "9981", address: "http://118.196.20.215:8188", status: "OFFLINE", queue: 0, concurrency: 1, priority: 0, exclusive: "", enabled: true },
];

const ServerManagement = () => {
  const [servers, setServers] = useState<Server[]>(mockServers);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);

  // Add form state
  const [formName, setFormName] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formPriority, setFormPriority] = useState("0");
  const [formError, setFormError] = useState<string | null>(null);

  // Pagination
  const [pageSize, setPageSize] = useState("10");
  const [currentPage, setCurrentPage] = useState(1);

  const resetForm = () => {
    setFormName("");
    setFormAddress("");
    setFormPriority("0");
    setFormError(null);
  };

  const hasFormContent = () => {
    return formName.trim() !== "" || formAddress.trim() !== "" || formPriority !== "0";
  };

  const handleCloseDialog = () => {
    if (hasFormContent()) {
      setShowCancelDialog(true);
    } else {
      resetForm();
      setAddDialogOpen(false);
    }
  };

  const handleSave = () => {
    if (!formName.trim()) {
      setFormError("请输入服务器名称");
      return;
    }
    if (!formAddress.trim()) {
      setFormError("请输入服务器地址");
      return;
    }
    const newServer: Server = {
      id: Date.now(),
      name: formName.trim(),
      address: formAddress.trim(),
      status: "OFFLINE",
      queue: 0,
      concurrency: 1,
      priority: Number(formPriority) || 0,
      exclusive: "",
      enabled: true,
    };
    setServers((prev) => [...prev, newServer]);
    resetForm();
    setAddDialogOpen(false);
  };

  const handleToggleEnabled = (id: number) => {
    setServers((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    );
  };

  const handleEnableAll = () => {
    setServers((prev) => prev.map((s) => ({ ...s, enabled: true })));
  };

  const handleDisableAll = () => {
    setServers((prev) => prev.map((s) => ({ ...s, enabled: false })));
  };

  const handleDelete = (id: number) => {
    setServers((prev) => prev.filter((s) => s.id !== id));
  };

  const handleConcurrencyChange = (id: number, val: string) => {
    const num = Number(val);
    if (isNaN(num)) return;
    setServers((prev) =>
      prev.map((s) => (s.id === id ? { ...s, concurrency: num } : s))
    );
  };

  const handlePriorityChange = (id: number, val: string) => {
    const num = Number(val);
    if (isNaN(num)) return;
    setServers((prev) =>
      prev.map((s) => (s.id === id ? { ...s, priority: num } : s))
    );
  };

  // Pagination logic
  const pageSizeNum = Number(pageSize);
  const totalPages = Math.ceil(servers.length / pageSizeNum);
  const paginatedServers = servers.slice(
    (currentPage - 1) * pageSizeNum,
    currentPage * pageSizeNum
  );

  return (
    <PageShell>
      <PageHeader
        title="服务器管理"
        actions={
          <>
            <Button variant="page" onClick={() => setAddDialogOpen(true)}>
              <Plus className="w-4 h-4" />
              添加服务器
            </Button>
            <Button variant="pageOutline">验证所有</Button>
            <Button
              variant="pageOutline"
              className="!border-destructive !text-destructive hover:!bg-destructive/10"
              onClick={handleDisableAll}
            >
              停用所有
            </Button>
            <Button variant="pageOutline" onClick={handleEnableAll}>启用所有</Button>
            <Button variant="pageOutline">更新服务器模型</Button>
          </>
        }
      />

      <TableSurface>
        <Table className="text-[13px]">
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[140px]">服务器名称</TableHead>
              <TableHead className="min-w-[140px]">服务器地址</TableHead>
              <TableHead className="w-24 text-center">状态</TableHead>
              <TableHead className="w-24 text-center">实时队列</TableHead>
              <TableHead className="w-24 text-center">并发</TableHead>
              <TableHead className="w-24 text-center">优先级</TableHead>
              <TableHead className="w-24 text-center">专属</TableHead>
              <TableHead className="w-24 text-center">启用状态</TableHead>
              <TableHead>操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedServers.map((server) => (
              <TableRow key={server.id}>
                <TableCell>{server.name}</TableCell>
                <TableCell>{server.address}</TableCell>
                <TableCell className="text-center">
                  <StatusBadge tone={server.status === "ONLINE" ? "success" : "danger"}>
                    {server.status}
                  </StatusBadge>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="secondary" className="text-xs">{server.queue}</Badge>
                </TableCell>
                <TableCell className="text-center">
                  <Input
                    type="number"
                    value={server.concurrency}
                    onChange={(e) => handleConcurrencyChange(server.id, e.target.value)}
                    className="w-16 h-8 text-center mx-auto"
                    min={1}
                  />
                </TableCell>
                <TableCell className="text-center">
                  <Input
                    type="number"
                    value={server.priority}
                    onChange={(e) => handlePriorityChange(server.id, e.target.value)}
                    className="w-16 h-8 text-center mx-auto"
                    min={0}
                  />
                </TableCell>
                <TableCell className="text-center">
                  <Button variant="outline" size="icon" className="h-7 w-7" title="设置专属">
                    <Shield className="w-4 h-4" />
                  </Button>
                </TableCell>
                <TableCell className="text-center">
                  <Switch
                    checked={server.enabled}
                    onCheckedChange={() => handleToggleEnabled(server.id)}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button variant="ghost" size="icon" className="h-7 w-7" title="验证">
                      <CheckCircle2 className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-primary hover:text-primary" title="修改">
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:bg-destructive/10"
                      onClick={() => handleDelete(server.id)}
                      title="删除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" title="清空队列">
                      <Eraser className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {paginatedServers.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-12">
                  暂无服务器，点击"添加服务器"创建
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableSurface>

      <CommonPaginationBar
        total={servers.length}
        pageNo={currentPage}
        pageSize={pageSizeNum}
        canNextPage={totalPages > 0 && currentPage < totalPages}
        onPageNoChange={setCurrentPage}
        onPageSizeChange={(nextPageSize) => {
          setPageSize(String(nextPageSize));
          setCurrentPage(1);
        }}
        showLastButton={true}
      />

      {/* Add Server Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={(open) => { if (!open) handleCloseDialog(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>添加服务器</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-3">
              <Input
                placeholder="服务器名称"
                value={formName}
                onChange={(e) => {
                  setFormName(e.target.value);
                  if (formError) setFormError(null);
                }}
                className="flex-1"
              />
              <Input
                placeholder="服务器地址,浏览器可访问的ComfyUI地址"
                value={formAddress}
                onChange={(e) => {
                  setFormAddress(e.target.value);
                  if (formError) setFormError(null);
                }}
                className="flex-[2]"
              />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm border border-border rounded px-3 py-1.5 bg-muted">优先级</span>
              <Input
                type="number"
                placeholder="优先级"
                value={formPriority}
                onChange={(e) => setFormPriority(e.target.value)}
                className="w-24"
                min={0}
              />
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              <p className="font-medium">填写说明：</p>
              <p>1.不能使用http://127.0.0.1:8188的本地服务器地址</p>
              <p>2.本地或者局域网部署，可以使用http://192.168.2.173:8188等IP地址访问</p>
              <p>3.指定的服务器地址必须是一个可以访问的GPU算力服务器地址,包含完整的协议头，可直接从浏览器窗口复制,示例：</p>
              <p>
                https://xxxxx.com{" "}
                <span className="text-destructive font-medium">【注意.com后面部分请勿复制】</span>
              </p>
              <p>4.其他详细说明说明，参考详细文档：点击访问</p>
            </div>
          </div>
          {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>关闭</Button>
            <Button onClick={handleSave}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirm Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认取消</AlertDialogTitle>
            <AlertDialogDescription>
              您已输入内容，确定要取消吗？未保存的内容将会丢失。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>继续编辑</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                resetForm();
                setAddDialogOpen(false);
                setShowCancelDialog(false);
              }}
            >
              确认取消
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
};

export default ServerManagement;

