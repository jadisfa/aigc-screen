import { Image as ImageIcon } from "lucide-react";
import { useEffect, useState } from "react";

export function CateIcon(props: { url?: string | null; alt?: string; className?: string }) {
  const [error, setError] = useState(false);
  const url = (props.url || "").trim();
  const showImg = !!url && !error;
  
  useEffect(() => {
    setError(false);
  }, [url]);

  return (
    <div className={`rounded-md overflow-hidden bg-muted shrink-0 ${props.className || ""}`}>
      {showImg ? (
        <img
          src={url}
          alt={props.alt || "icon"}
          className="h-full w-full object-cover"
          onError={() => setError(true)}
        />
      ) : (
        <div className="h-full w-full flex items-center justify-center text-muted-foreground">
          <ImageIcon className="w-[60%] h-[60%]" />
        </div>
      )}
    </div>
  );
}
