import { INSPIRE_MODE_KEY, INSPIRE_QUERY_KEY, INSPIRE_TAGS_KEY } from "@/data/inspire";
import { sleep } from "@/lib/scan-session";
import { fetchDispatch } from "@/lib/screen-api/dispatch";
import {
  abandonExperience,
  completeOutfitTag,
  completeTryOn,
  createExperience,
  dispatchOutfitTag,
  dispatchTryOn,
  fetchCurrentExperience,
  fetchExperience,
  rematchExperience,
  type ScreenExperience,
  type ScreenExperienceTag,
} from "@/lib/screen-api/experiences";
import { TRYON_LOOK_KEY, readTryOnNailUrl } from "@/data/try-on";
import { readOutfitUploadId } from "@/lib/upload-flow";

export const EXPERIENCE_ID_KEY = "kiosk.experienceId";
export const EXPERIENCE_SNAPSHOT_KEY = "kiosk.experienceSnapshot";
const VISIT_EPOCH_KEY = "kiosk.visitEpoch";
const EXPERIENCE_EPOCH_KEY = "kiosk.experienceEpoch";

export type MatchProgress = (percent: number, etaSeconds?: number) => void;

export function readExperienceId() {
  return String(uni.getStorageSync(EXPERIENCE_ID_KEY) || "");
}

export function writeExperienceId(id: string) {
  uni.setStorageSync(EXPERIENCE_ID_KEY, id);
  let epoch = String(uni.getStorageSync(VISIT_EPOCH_KEY) || "");
  if (!epoch) {
    epoch = String(Date.now());
    uni.setStorageSync(VISIT_EPOCH_KEY, epoch);
  }
  uni.setStorageSync(EXPERIENCE_EPOCH_KEY, epoch);
}

/** 回到首页即结束本趟。只放弃离开前的体验号，避免误关下一趟。 */
export function beginKioskVisit() {
  const previousId = readExperienceId();
  uni.setStorageSync(VISIT_EPOCH_KEY, String(Date.now()));
  uni.removeStorageSync(EXPERIENCE_ID_KEY);
  uni.removeStorageSync(EXPERIENCE_SNAPSHOT_KEY);
  uni.removeStorageSync(EXPERIENCE_EPOCH_KEY);
  if (!previousId) {
    return;
  }
  void abandonExperience(previousId).catch(() => undefined);
}

function experienceBelongsToCurrentVisit() {
  const visitEpoch = String(uni.getStorageSync(VISIT_EPOCH_KEY) || "");
  const experienceEpoch = String(uni.getStorageSync(EXPERIENCE_EPOCH_KEY) || "");
  return Boolean(visitEpoch && experienceEpoch === visitEpoch && readExperienceId());
}

export function writeMatchedExperience(experience: ScreenExperience) {
  writeExperienceId(experience.id);
  uni.setStorageSync(EXPERIENCE_SNAPSHOT_KEY, JSON.stringify(experience));
}

export function readMatchedExperienceSnapshot(): ScreenExperience | null {
  try {
    const raw = uni.getStorageSync(EXPERIENCE_SNAPSHOT_KEY);
    if (!raw) {
      return null;
    }
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    const snapshot = parsed as ScreenExperience;
    return snapshot.id ? snapshot : null;
  } catch {
    return null;
  }
}

/** 结果页「你的穿搭风格」：穿搭识别用 complete 返回的 tags；关键词路径才回落到顾客输入。 */
export type StyleTag = {
  code: string;
  name: string;
};

export function experienceStyleTags(experience: ScreenExperience | null | undefined): StyleTag[] {
  const fromApi: StyleTag[] = [];
  const seen = new Set<string>();
  for (const tag of experience?.tags || []) {
    const name = tagName(tag);
    if (!name) {
      continue;
    }
    const code = String(tag.code || "").trim();
    const key = code || name;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    fromApi.push({ code, name });
  }
  if (fromApi.length) {
    return fromApi;
  }
  return inspireStyleTagNames().map((name) => ({ code: "", name }));
}

export async function rematchBySelectedTags(tagCodes: string[]): Promise<ScreenExperience> {
  const id = readExperienceId();
  if (!id) {
    throw new Error("请先从穿搭或灵感开始本趟体验");
  }
  const selected = uniqueNames(tagCodes);
  if (!selected.length) {
    throw new Error("请选择风格标签");
  }
  const experience = await rematchExperience(id, selected);
  writeMatchedExperience(experience);
  return experience;
}

export function inspireKeyword(): string {
  const text = String(uni.getStorageSync(INSPIRE_QUERY_KEY) || "").trim();
  if (text) {
    return text;
  }
  try {
    const tags = JSON.parse(String(uni.getStorageSync(INSPIRE_TAGS_KEY) || "[]")) as unknown;
    if (Array.isArray(tags)) {
      return tags.map((tag) => String(tag).trim()).filter(Boolean).join(" ");
    }
  } catch {
    /* ignore */
  }
  return "";
}

export function matchingScene(): "outfit" | "keyword" {
  return uni.getStorageSync(INSPIRE_MODE_KEY) === "keyword" ? "keyword" : "outfit";
}

export async function loadMatchedExperience(): Promise<ScreenExperience | null> {
  if (!experienceBelongsToCurrentVisit()) {
    return null;
  }
  const snapshot = readMatchedExperienceSnapshot();
  const current = await fetchCurrentExperience().catch(() => null);
  if (current?.id) {
    const merged = mergeMatchedExperience(current, snapshot);
    writeMatchedExperience(merged);
    return merged;
  }
  const id = readExperienceId() || snapshot?.id || "";
  if (id) {
    const fetched = await fetchExperience(id).catch(() => null);
    if (fetched) {
      const merged = mergeMatchedExperience(fetched, snapshot);
      writeMatchedExperience(merged);
      return merged;
    }
  }
  return snapshot;
}

export async function runMatching(onProgress?: MatchProgress, signal?: { aborted: boolean }): Promise<ScreenExperience> {
  const scene = matchingScene();
  onProgress?.(8);
  let experience: ScreenExperience;
  if (scene === "keyword") {
    const keyword = inspireKeyword();
    if (!keyword) {
      throw new Error("请先输入或选择灵感关键词");
    }
    experience = await createExperience({ scene: "keyword", keyword });
    writeMatchedExperience(experience);
    onProgress?.(100);
    return experience;
  }

  const outfitUploadId = readOutfitUploadId();
  console.log(outfitUploadId, 183, 'experience-flows.ts')
  if (!outfitUploadId) {
    throw new Error("请先确认穿搭图");
  }
  experience = await createExperience({ scene: "outfit", outfitUploadId });
  writeMatchedExperience(experience);
  onProgress?.(16);

  const accepted = await dispatchOutfitTag(experience.id);
  const eta = accepted.etaSeconds && accepted.etaSeconds > 0 ? accepted.etaSeconds : 20;
  onProgress?.(24, eta);
  const task = await waitDispatch(accepted.taskId, eta, onProgress, signal);
  if (signal?.aborted) {
    throw new Error("已取消");
  }
  if (task.status !== "succeeded") {
    throw new Error(kioskFailureByCode(task.errorCode, task.errorMessage, "穿搭识别暂时不可用，请稍后重试"));
  }
  onProgress?.(92);
  const completed = await completeOutfitTag(experience.id, accepted.taskId);
  writeMatchedExperience(completed);
  onProgress?.(100);
  return completed;
}

async function requireOpenExperienceId() {
  if (experienceBelongsToCurrentVisit()) {
    try {
      const current = await fetchCurrentExperience();
      if (current?.id) {
        writeExperienceId(current.id);
        return current.id;
      }
    } catch {
      const stored = readExperienceId();
      if (stored) {
        return stored;
      }
    }
  }
  const created = await createExperience({ scene: "catalog" });
  writeExperienceId(created.id);
  return created.id;
}

export async function runTryOn(
  imageUrl: string,
  onProgress?: MatchProgress,
  signal?: { aborted: boolean },
) {
  if (!/^https?:\/\//i.test(imageUrl)) {
    throw new Error("请选择或扫码上传手模图");
  }
  const experienceId = await requireOpenExperienceId();
  onProgress?.(8);
  const lookId = String(uni.getStorageSync(TRYON_LOOK_KEY) || "");
  const productId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(lookId)
    ? lookId
    : undefined;
  const accepted = await dispatchTryOn(experienceId, {
    imageUrl,
    productId,
    productImageUrl: readTryOnNailUrl() || undefined,
  });
  const eta = accepted.etaSeconds && accepted.etaSeconds > 0 ? accepted.etaSeconds : 20;
  onProgress?.(24, eta);
  const task = await waitDispatch(accepted.taskId, eta, onProgress, signal);
  if (signal?.aborted) {
    throw new Error("已取消");
  }
  if (task.status !== "succeeded") {
    throw new Error(kioskFailureByCode(task.errorCode, task.errorMessage, "试戴暂时不可用，请稍后重试"));
  }
  onProgress?.(92);
  const generation = await completeTryOn(experienceId, {
    tryonTaskId: accepted.taskId,
    productId,
    stockKind: productId ? undefined : "custom_no_stock",
  });
  onProgress?.(100);
  return { ...generation, tryonTaskId: accepted.taskId };
}

async function waitDispatch(
  taskId: string,
  etaSeconds: number,
  onProgress?: MatchProgress,
  signal?: { aborted: boolean },
): Promise<{ status?: string; errorMessage?: string; errorCode?: string }> {
  const started = Date.now();
  const timeoutMs = Math.max(etaSeconds * 1000, 30_000) + 120_000;
  while (!signal?.aborted && Date.now() - started < timeoutMs) {
    const detail = await fetchDispatch(taskId);
    const elapsed = (Date.now() - started) / 1000;
    const pct = Math.min(88, 24 + Math.round((elapsed / etaSeconds) * 64));
    onProgress?.(pct, etaSeconds);
    if (detail.status === "succeeded" || detail.status === "failed" || detail.status === "canceled") {
      return detail;
    }
    await sleep(2000);
  }
  if (signal?.aborted) {
    return { status: "canceled" };
  }
  throw new Error("匹配超时，请再试一次");
}

function mergeMatchedExperience(live: ScreenExperience, snapshot: ScreenExperience | null): ScreenExperience {
  if (!snapshot || snapshot.id !== live.id) {
    return live;
  }
  return {
    ...live,
    tags: live.tags?.length ? live.tags : snapshot.tags,
    matchedProducts: Array.isArray(live.matchedProducts) ? live.matchedProducts : snapshot.matchedProducts,
  };
}

function tagName(tag: ScreenExperienceTag | string | null | undefined): string {
  if (typeof tag === "string") {
    return tag.trim();
  }
  return String(tag?.name || "").trim();
}

function inspireStyleTagNames(): string[] {
  try {
    const tags = JSON.parse(String(uni.getStorageSync(INSPIRE_TAGS_KEY) || "[]")) as unknown;
    if (Array.isArray(tags)) {
      const names = uniqueNames(tags.map((tag) => String(tag)));
      if (names.length) {
        return names;
      }
    }
  } catch {
    /* ignore */
  }
  const query = String(uni.getStorageSync(INSPIRE_QUERY_KEY) || "").trim();
  return query ? [query] : [];
}

function uniqueNames(names: Array<string | undefined | null>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of names) {
    const name = String(raw || "").trim();
    if (!name || seen.has(name)) {
      continue;
    }
    seen.add(name);
    result.push(name);
  }
  return result;
}

function kioskFailureByCode(errorCode: string | undefined, errorMessage: string | undefined, fallback: string): string {
  const code = String(errorCode || "").trim().toUpperCase();
  if (
    code === "SCHEDULER-QUOTA-429"
    || code === "FUND_BALANCE_NOT_ENOUGH"
    || code === "FUND_ACCOUNT_NOT_FOUND"
  ) {
    return "账户余额不足，请充值后重试";
  }
  if (
    code === "COMFYUI_NODE_UNAUTHORIZED"
    || code === "COMFYUI_API_ERROR"
    || code.startsWith("SCHEDULER-COMFYUI-")
  ) {
    return fallback;
  }
  if (errorMessage && (errorMessage.includes("余额不足") || errorMessage.includes("账户不存在"))) {
    return "账户余额不足，请充值后重试";
  }
  return (errorMessage || "").trim() || fallback;
}
