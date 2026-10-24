export type FormServiceCode = "mail" | "sms" | "translation" | "audit_media";

export type PlatformTypeOption = {
  value: string;
  label: string;
};

export type FormServiceItem = {
  id: string;
  name: string;
  code: FormServiceCode;
  enabled: boolean;
};

export type MailServerConfig = {
  smtpHost: string;
  smtpPort: string;
  username: string;
  passwordOrAuthCode: string;
  useSsl: boolean;
};

export type SmsTemplateConfig = {
  appId: string;
  templateRels: SmsTemplateRelConfig[];
};

export type SmsTemplateRelConfig = {
  id: string;
  templateCode: string;
  domesticMessageTemplateId: string;
  internationalMessageTemplateId: string;
  domesticSignName: string;
  internationalSignName: string;
  enabled: boolean;
};

export type SmsTemplateRelIssue = {
  level: "warning" | "error";
  message: string;
};

export type AuditConfig = {
  callbackUrl: string;
  imagePolicy: string;
  audioPolicy: string;
  videoPolicy: string;
};

export type AvailableServiceOption = {
  value: FormServiceCode;
  label: string;
};
