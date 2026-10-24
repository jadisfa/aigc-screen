import { memo } from "react";
import { Sparkles, AppWindow, Waypoints, FolderOpen, type LucideIcon } from "lucide-react";
import brandLogo from "@/assets/logo.png";
import nail1 from "@/assets/nail1.jpg";
import nail2 from "@/assets/nail2.jpg";
import nail3 from "@/assets/nail3.jpg";
import { BRAND_PURPLE, TEXT_MUTED, TEXT_PRIMARY } from "./loginTheme";

const INSPIRE_IMAGES = [nail1, nail2, nail3] as const;
const FEATURE_CARDS: { title: string; desc: string; icon: LucideIcon }[] = [
  {
    title: "应用管理",
    desc: "配置创作应用与分类，发布后可直接给业务侧调用。",
    icon: AppWindow,
  },
  {
    title: "模型中枢",
    desc: "接入基础模型，按模型池和路由组织调用能力。",
    icon: Waypoints,
  },
  {
    title: "素材管理",
    desc: "沉淀作品、文件与模型素材，方便团队查找和复用。",
    icon: FolderOpen,
  },
];

export const LoginBrandHeader = memo(function LoginBrandHeader() {
  return (
    <header className="absolute left-6 top-5 z-30 hidden max-w-[29rem] items-center gap-2.5 lg:flex xl:left-10 xl:top-7">
      <img src={brandLogo} alt="奈杜AIGC" className="h-7 w-auto shrink-0 object-contain object-center xl:h-8" />
      <div className="flex min-w-0 flex-col justify-center">
        <div className="text-[15px] font-semibold uppercase leading-none tracking-[0.2em]" style={{ color: BRAND_PURPLE }}>
          NDMY
        </div>
        <div className="mt-1.5 text-[12px] font-medium leading-none" style={{ color: TEXT_MUTED }}>
          美甲行业人工智能驱动解决方案全球领先者
        </div>
      </div>
    </header>
  );
});

export const LoginMobileBrand = memo(function LoginMobileBrand() {
  return (
    <div className="mb-4 flex items-center justify-center gap-2.5 lg:hidden">
      <img src={brandLogo} alt="奈杜AIGC" className="h-8 w-auto object-contain" />
      <div className="leading-tight">
        <div className="text-[15px] font-semibold" style={{ color: TEXT_PRIMARY }}>
          奈杜AIGC
        </div>
        <div className="text-[12px]" style={{ color: TEXT_MUTED }}>
          智能创作中台
        </div>
      </div>
    </div>
  );
});

export const LoginShowcase = memo(function LoginShowcase() {
  return (
    <section className="login-showcase">
      <h1 className="login-showcase-title">新一代AI美甲创意生产力平台</h1>
      <p className="login-showcase-lead">
        乘着数字经济与个性化消费的浪潮，美妆时尚产业开启智能化转型。NDMY‑AI 美甲，美甲行业 AI 解决方案领跑者，以 AIGC 技术打造美甲专用 AI 模型，实现美甲全链路数字化赋能。
      </p>
      <div className="login-showcase-body">
        <div className="login-overview">
          <div className="login-overview-head">
            <div
              className="login-overview-icon"
              style={{ background: `linear-gradient(135deg, ${BRAND_PURPLE} 0%, #A855F7 100%)` }}
            >
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="login-overview-kicker">创作能力</div>
          </div>
          <div className="login-overview-note">
            从应用配置到AI创作、结果产出，再到素材归档，一站式完成创作。
          </div>
          <div className="login-inspire">
            {INSPIRE_IMAGES.map((image, index) => (
              <div key={image} className="login-inspire-item">
                <img
                  src={image}
                  alt={`创作示例 ${index + 1}`}
                  width={320}
                  height={400}
                  loading="eager"
                  decoding="async"
                  draggable={false}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="login-features">
          {FEATURE_CARDS.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="login-feature">
                <div className="login-feature-head">
                  <span className="login-feature-icon" aria-hidden>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="login-feature-title">{item.title}</div>
                </div>
                <div className="login-feature-desc">{item.desc}</div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
});
