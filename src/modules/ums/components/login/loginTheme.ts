/** Soft UI AIGC 中台登录：疏朗布局 + 可读对比 */

export const PAGE_BG = "linear-gradient(160deg, #F8F6FC 0%, #F3F0FA 45%, #F7F5FB 100%)";
export const BRAND_PURPLE = "#7C3AED";
export const TEXT_PRIMARY = "#14101F";
export const TEXT_BODY = "#3A3348";
export const TEXT_MUTED = "#5C556C";

export const SOFT_INPUT =
  "h-10 box-border rounded-xl border-[#D9D2E8] bg-white shadow-none text-[#14101F] placeholder:text-[#9A93A8] hover:border-[#C4BAD9] focus:border-[#7C3AED]/55";
export const SOFT_LABEL = "text-[12px] tracking-wide text-[#5C556C] font-medium";
export const SOFT_PRIMARY_BTN =
  "w-full h-11 rounded-xl text-[14px] font-medium text-white shadow-[0_12px_28px_rgba(124,58,237,0.28)] hover:opacity-95";
/** 验证码发送：淡紫底 + 细边，冷却态更安静 */
export const SOFT_OTP_BTN =
  "h-10 box-border min-w-[6.75rem] px-3 rounded-xl border border-[#DDD4F0] bg-[#F4F0FB] text-[12px] font-semibold tabular-nums tracking-wide whitespace-nowrap shrink-0 text-[#7C3AED] shadow-[0_6px_16px_-12px_rgba(124,58,237,0.45)] transition-all duration-200 hover:border-[#C4BAD9] hover:bg-[#EDE6FA] hover:text-[#6D28D9] active:scale-[0.98] disabled:pointer-events-none disabled:border-[#E8E3F2] disabled:bg-[#F7F5FB] disabled:text-[#A39BB8] disabled:shadow-none disabled:opacity-100";
export const SOFT_OTP_ROW = "grid grid-cols-[minmax(0,1fr)_auto] items-stretch gap-2.5";
export const LOGIN_TAB_PANEL = "mt-0 focus-visible:ring-0 focus-visible:ring-offset-0";
export const SOFT_TAB_TRIGGER =
  "h-full rounded-xl border-0 text-[13px] gap-1.5 text-[#8A8298] shadow-none data-[state=active]:bg-white data-[state=active]:text-[#6D28D9] data-[state=active]:font-semibold data-[state=active]:shadow-[0_2px_8px_rgba(109,40,217,0.1)]";
export const REMEMBER_LABEL =
  "text-[13px] text-muted-foreground font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer";

/** 登录画板：固定栏宽保持比例；≥1440×900 时整页等比放大并铺满视口 */
export const LOGIN_LAYOUT_CSS = `
  .login-page {
    --login-base-w: 1440px;
    --login-base-h: 900px;
    --login-scale: 1;
    width: 100%;
    min-width: 100%;
    height: 100dvh;
    min-height: 100dvh;
    max-height: 100dvh;
    overflow: hidden;
  }
  .login-shell {
    position: relative;
    z-index: 10;
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-height: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    container-type: size;
    container-name: login;
  }
  @media (min-width: 1440px) and (min-height: 900px) {
    .login-page {
      --login-scale: min(100vw / var(--login-base-w), 100dvh / var(--login-base-h), 1.45);
    }
    .login-shell {
      flex: none;
      width: calc(100vw / var(--login-scale));
      height: calc(100dvh / var(--login-scale));
      margin: 0;
      zoom: var(--login-scale);
    }
  }
  @supports not (zoom: 1) {
    @media (min-width: 1440px) and (min-height: 900px) {
      .login-shell {
        zoom: unset;
        position: absolute;
        inset: 0;
        width: calc(100vw / var(--login-scale));
        height: calc(100dvh / var(--login-scale));
        margin: auto;
        transform: scale(var(--login-scale));
        transform-origin: center center;
      }
    }
  }
  @keyframes login-bubble-float {
    0%, 100% { transform: translate3d(0, 0, 0) scale(1); opacity: var(--bubble-opacity, 0.85); }
    40% { transform: translate3d(var(--bubble-dx, 12px), var(--bubble-dy, -24px), 0) scale(1.06); opacity: 1; }
    70% { transform: translate3d(calc(var(--bubble-dx, 12px) * -0.55), calc(var(--bubble-dy, -24px) * -0.4), 0) scale(0.94); opacity: 0.75; }
  }
  .login-tab-panel { min-height: 0; }
  .login-stage {
    --pad-x: clamp(1.18rem, 3.8cqi, 3.3rem);
    --pad-y: clamp(1.05rem, 3cqh, 2.125rem);
    --col-gap: 10rem;
    --login-w: 22.75rem;
    --showcase-w: 37rem;
    --space-3: 1.28rem;
    --space-4: 1.42rem;
    --title: 1.9rem;
    --lead: 0.85rem;
    --card-title: 1.28rem;
    --card-pad: 1.125rem;
    --radius: 1.1rem;
    --login-radius: 1.28rem;
    --inspire-gap: 0.7rem;
    --feat-title: 0.78rem;
    --feat-desc: 0.656rem;
    --overview-kicker: 0.85rem;
    box-sizing: border-box;
    width: 100%;
    margin-inline: auto;
    min-height: 100%;
    padding: var(--pad-y) var(--pad-x);
    display: flex;
    flex-direction: column;
    justify-content: center;
    justify-content: safe center;
  }
  .login-stage-grid {
    display: grid;
    width: 100%;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--col-gap);
    align-items: start;
  }
  @media (min-width: 1024px) {
    .login-stage {
      padding-top: max(var(--pad-y), 5.6rem);
    }
    .login-stage-grid {
      width: min(100%, calc(var(--showcase-w) + var(--col-gap) + var(--login-w)));
      margin-inline: auto;
      grid-template-columns: minmax(0, var(--showcase-w)) var(--login-w);
      justify-content: space-between;
      align-items: end;
    }
  }
  @media (max-width: 1279px) {
    .login-stage {
      --col-gap: clamp(2rem, 4cqi, 4rem);
      --login-w: 22.25rem;
      --showcase-w: 34rem;
      --title: 1.75rem;
      --card-pad: 1.05rem;
      --inspire-gap: 0.7rem;
    }
  }
  .login-showcase { display: none; min-width: 0; width: 100%; }
  @media (min-width: 1024px) {
    .login-showcase {
      display: flex;
      flex-direction: column;
    }
  }
  .login-panel { width: 100%; min-width: 0; }
  .login-showcase-title {
    flex-shrink: 0;
    font-size: var(--title);
    font-weight: 700;
    line-height: 1.35;
    letter-spacing: -0.02em;
    text-wrap: balance;
    color: ${TEXT_PRIMARY};
  }
  .login-showcase-lead {
    flex-shrink: 0;
    margin-top: 1.12rem;
    width: 100%;
    font-size: var(--lead);
    line-height: 1.95;
    color: ${TEXT_BODY};
  }
  .login-showcase-body {
    width: 100%;
    min-width: 0;
    margin-top: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
  }
  .login-overview {
    padding: var(--card-pad);
    border-radius: var(--radius);
    border: 1px solid #E8E2F4;
    background: #fff;
    box-shadow: 0 20px 48px -28px rgba(40, 20, 80, 0.22);
  }
  .login-overview-head {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 0.6rem;
  }
  .login-overview-icon {
    display: flex;
    height: 1.875rem;
    width: 1.875rem;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    border-radius: 0.8rem;
    color: #fff;
  }
  .login-overview-kicker {
    font-size: var(--overview-kicker);
    font-weight: 700;
    color: ${TEXT_PRIMARY};
  }
  .login-overview-note {
    margin-top: 0.32rem;
    margin-left: calc(1.875rem + 0.6rem);
    font-size: 0.78rem;
    line-height: 1.6;
    color: ${TEXT_MUTED};
  }
  .login-inspire {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--inspire-gap);
    width: 100%;
    margin-top: 0.7rem;
  }
  .login-inspire-item {
    aspect-ratio: 4 / 5;
    max-height: min(12.25rem, 25cqh);
    overflow: hidden;
    border-radius: 0.9rem;
    border: 1px solid #EDE7F6;
    background: #F3EEFA;
  }
  .login-inspire-item img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center;
  }
  .login-features {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr);
    gap: var(--inspire-gap);
    width: 100%;
    flex-shrink: 0;
    align-items: stretch;
  }
  .login-feature {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 0.2rem;
    padding: 0.85rem 0.8rem 0.9rem;
    border-radius: var(--radius);
    border: 1px solid #E8E2F4;
    background: #fff;
    box-shadow: 0 10px 28px -22px rgba(40, 20, 80, 0.18);
  }
  .login-feature-head {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: 0.5rem;
  }
  .login-feature-icon {
    display: flex;
    height: 1.65rem;
    width: 1.65rem;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    border-radius: 0.55rem;
    color: #7C3AED;
    background: #F4F0FB;
  }
  .login-feature-title {
    min-width: 0;
    font-size: var(--feat-title);
    font-weight: 600;
    line-height: 1.3;
    color: ${TEXT_PRIMARY};
  }
  .login-feature-desc {
    font-size: var(--feat-desc);
    line-height: 1.5;
    color: ${TEXT_MUTED};
  }
  .login-card {
    width: 100%;
    padding: 1.5rem 1.42rem 1.12rem;
    border-radius: var(--login-radius);
    border: 1px solid #E8E2F4;
    background: #fff;
    box-shadow: 0 28px 64px -36px rgba(40, 20, 80, 0.35);
  }
  .login-card-head { margin-bottom: 1.08rem; }
  .login-card-body { min-width: 0; }
  .login-legal {
    margin-top: 1.6rem;
    border-top: 1px solid #EDE8F5;
    padding-top: 0.8rem;
  }
  .login-card-title {
    font-size: var(--card-title);
    font-weight: 700;
    letter-spacing: -0.02em;
    color: ${TEXT_PRIMARY};
  }
  @media (max-width: 1023px) {
    .login-stage { width: min(100%, 26.5rem); }
    .login-card { padding: 1.85rem 1.42rem; }
  }
  @media (max-height: 900px) {
    .login-feature { padding: 0.7rem 0.65rem 0.75rem; }
  }
  @media (max-height: 760px) {
    .login-stage {
      --pad-y: 1rem;
      --space-3: 1.08rem;
    }
    .login-showcase-lead { margin-top: 0.92rem; }
    .login-inspire { max-height: none; }
    .login-inspire-item { max-height: min(10.75rem, 21cqh); }
  }
`;
