// 用户协议
import { useEffect, useState } from "react";
import { getPublicUserAgreement } from "@/shared/api/sys/system-config";

const publicService = () => {
  const [serviceData, setServiceData] = useState<any>(null);
  useEffect(() => {
    getPublicUserAgreement().then((res) => {
      setServiceData(res?.content);
    });
  }, []);

  return (
    <div
      className="max-w-5xl mx-auto pa-2"
      dangerouslySetInnerHTML={{ __html: serviceData }}
    ></div>
  );
};

export default publicService;
