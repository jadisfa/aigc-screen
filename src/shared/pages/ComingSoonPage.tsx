import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/shared/ui/button";

export default function ComingSoonPage({
  title,
  description = "该功能页面尚未接入，当前为占位页。",
}: {
  title: string;
  description?: string;
}) {
  const navigate = useNavigate();

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="max-w-4xl mx-auto px-6 py-10">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回
          </Button>
          <h1 className="text-xl font-semibold">{title}</h1>
        </div>
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="text-sm text-muted-foreground">{description}</div>
        </div>
      </div>
    </div>
  );
}
