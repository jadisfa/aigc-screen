// 隐私政策
import { useState, useEffect } from "react";
import { getPublicPrivacyPolicy } from "@/shared/api/sys/system-config";

const publicPrivacy = () => {
  const [privacyData, setPrivacyData] = useState<any>(null);
  useEffect(() => {
    getPublicPrivacyPolicy().then((res) => {
      setPrivacyData(res?.content);
    });
  }, []);

  return (
    <div
      className="max-w-5xl mx-auto pa-2"
      dangerouslySetInnerHTML={{ __html: privacyData }}
    ></div>
  );
};

export default publicPrivacy;
