import type { Caption, Dataset, ImageRow, Profile, Vote } from "@/lib/data";

export const TZ = "America/New_York";

export type CaptionScore = {
  id: number;
  text: string;
  imageId: number | null;
  model: string | null;
  isSeed: boolean;
  up: number;
  down: number;
  total: number;
  net: number;
  /** (up - down) / total, from -1 to 1. 0 when nobody voted. */
  approval: number;
  /** Lower bound of the 95% Wilson interval on the upvote share. */
  wilson: number;
  /** 1 = perfectly split room, 0 = unanimous. Scaled by volume when ranking. */
  split: number;
  words: number;
};

/** Wilson score lower bound: ranks by "how sure are we this is funny", not raw ratio. */
export function wilsonLower(up: number, total: number, z = 1.96) {
  if (total === 0) return 0;
  const p = up / total;
  const denom = 1 + (z * z) / total;
  const centre = p + (z * z) / (2 * total);
  const margin = z * Math.sqrt((p * (1 - p) + (z * z) / (4 * total)) / total);
  return (centre - margin) / denom;
}

export function scoreCaptions(captions: Caption[], votes: Vote[]): CaptionScore[] {
  const tally = new Map<number, { up: number; down: number }>();
  for (const v of votes) {
    const t = tally.get(v.caption_id) ?? { up: 0, down: 0 };
    if (v.vote_value === 1) t.up++;
    else t.down++;
    tally.set(v.caption_id, t);
  }
  return captions.map((c) => {
    const { up, down } = tally.get(c.id) ?? { up: 0, down: 0 };
    const total = up + down;
    return {
      id: c.id,
      text: c.caption_text,
      imageId: c.image_id,
      model: c.model,
      isSeed: c.is_seed,
      up,
      down,
      total,
      net: up - down,
      approval: total ? (up - down) / total : 0,
      wilson: wilsonLower(up, total),
      split: total ? Math.min(up, down) / Math.max(up, down) : 0,
      words: c.caption_text.trim().split(/\s+/).filter(Boolean).length,
    };
  });
}

export type VoterScore = {
  id: string;
  name: string;
  email: string | null;
  avatar: string | null;
  isSeed: boolean;
  up: number;
  down: number;
  total: number;
  upShare: number;
  lastVote: string | null;
};

export function scoreVoters(profiles: Profile[], votes: Vote[]): VoterScore[] {
  const tally = new Map<string, { up: number; down: number; last: string | null }>();
  for (const v of votes) {
    const t = tally.get(v.profile_id) ?? { up: 0, down: 0, last: null };
    if (v.vote_value === 1) t.up++;
    else t.down++;
    if (!t.last || v.created_at > t.last) t.last = v.created_at;
    tally.set(v.profile_id, t);
  }
  return profiles.map((p) => {
    const t = tally.get(p.id) ?? { up: 0, down: 0, last: null };
    const total = t.up + t.down;
    return {
      id: p.id,
      name: [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email || "Unnamed user",
      email: p.email,
      avatar: p.avatar_url,
      isSeed: p.is_seed,
      up: t.up,
      down: t.down,
      total,
      upShare: total ? t.up / total : 0,
      lastVote: t.last,
    };
  });
}

function dayKey(iso: string) {
  // YYYY-MM-DD in New York time
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(iso),
  );
}

export type DailyVotes = { day: string; up: number; down: number };

export function dailyVotes(votes: Vote[], days = 30, now = new Date()): DailyVotes[] {
  const out: DailyVotes[] = [];
  const index = new Map<string, DailyVotes>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86_400_000);
    const key = dayKey(d.toISOString());
    if (index.has(key)) continue;
    const row = { day: key, up: 0, down: 0 };
    index.set(key, row);
    out.push(row);
  }
  for (const v of votes) {
    const row = index.get(dayKey(v.created_at));
    if (!row) continue;
    if (v.vote_value === 1) row.up++;
    else row.down++;
  }
  return out;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** 7 x 24 grid of vote counts, Monday first, New York time. */
export function voteHeatmap(votes: Vote[]) {
  const grid = WEEKDAYS.map(() => Array.from({ length: 24 }, () => ({ count: 0, up: 0 })));
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short", hour: "numeric", hourCycle: "h23" });
  for (const v of votes) {
    const parts = fmt.formatToParts(new Date(v.created_at));
    const wd = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
    const hr = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
    const cell = grid[WEEKDAYS.indexOf(wd)]?.[hr];
    if (!cell) continue;
    cell.count++;
    if (v.vote_value === 1) cell.up++;
  }
  return { weekdays: WEEKDAYS, grid };
}

export type GroupApproval = { label: string; captions: number; up: number; down: number; total: number; upShare: number };

function groupApproval(scores: CaptionScore[], keyOf: (s: CaptionScore) => string, order?: string[]): GroupApproval[] {
  const map = new Map<string, GroupApproval>();
  for (const s of scores) {
    const k = keyOf(s);
    const g = map.get(k) ?? { label: k, captions: 0, up: 0, down: 0, total: 0, upShare: 0 };
    g.captions++;
    g.up += s.up;
    g.down += s.down;
    g.total += s.total;
    map.set(k, g);
  }
  const rows = [...map.values()].map((g) => ({ ...g, upShare: g.total ? g.up / g.total : 0 }));
  if (order) return order.map((o) => rows.find((r) => r.label === o)).filter((r): r is GroupApproval => !!r);
  return rows.sort((a, b) => b.upShare - a.upShare);
}

export const LENGTH_BUCKETS = ["1–5 words", "6–8 words", "9–12 words", "13+ words"];

export function approvalByLength(scores: CaptionScore[]) {
  return groupApproval(
    scores,
    (s) => (s.words <= 5 ? LENGTH_BUCKETS[0] : s.words <= 8 ? LENGTH_BUCKETS[1] : s.words <= 12 ? LENGTH_BUCKETS[2] : LENGTH_BUCKETS[3]),
    LENGTH_BUCKETS,
  );
}

export function approvalByModel(scores: CaptionScore[]) {
  return groupApproval(scores, (s) => s.model ?? "Unlabeled");
}

export function buildDashboard(d: Dataset, now = new Date()) {
  const captions = scoreCaptions(d.captions, d.votes);
  const voters = scoreVoters(d.profiles, d.votes);
  const up = d.votes.filter((v) => v.vote_value === 1).length;
  const week = 7 * 86_400_000;
  const last7 = d.votes.filter((v) => now.getTime() - new Date(v.created_at).getTime() < week).length;
  const prior7 = d.votes.filter((v) => {
    const age = now.getTime() - new Date(v.created_at).getTime();
    return age >= week && age < 2 * week;
  }).length;

  const voted = captions.filter((c) => c.total > 0);
  const activeVoters = voters.filter((v) => v.total > 0);
  const medianVotes = (() => {
    const xs = voted.map((c) => c.total).sort((a, b) => a - b);
    if (!xs.length) return 0;
    const mid = Math.floor(xs.length / 2);
    return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
  })();

  const MIN_VOTES_FOR_PERSONA = 8;
  const judged = activeVoters.filter((v) => v.total >= MIN_VOTES_FOR_PERSONA);

  return {
    totals: {
      captions: d.captions.length,
      images: d.images.length,
      users: d.profiles.length,
      activeVoters: activeVoters.length,
      votes: d.votes.length,
      upShare: d.votes.length ? up / d.votes.length : 0,
      last7,
      prior7,
      unvotedCaptions: captions.length - voted.length,
    },
    captions,
    medianVotes,
    best: [...voted].sort((a, b) => b.wilson - a.wilson).slice(0, 5),
    worst: [...voted].sort((a, b) => a.wilson - b.wilson || b.total - a.total).slice(0, 5),
    divisive: [...voted]
      .filter((c) => c.total >= 6)
      .sort((a, b) => b.split * Math.log1p(b.total) - a.split * Math.log1p(a.total))
      .slice(0, 5),
    daily: dailyVotes(d.votes, 30, now),
    heatmap: voteHeatmap(d.votes),
    byLength: approvalByLength(voted),
    byModel: approvalByModel(voted),
    harshest: [...judged].sort((a, b) => a.upShare - b.upShare).slice(0, 4),
    easiest: [...judged].sort((a, b) => b.upShare - a.upShare).slice(0, 4),
    minVotesForPersona: MIN_VOTES_FOR_PERSONA,
    seedRows: d.profiles.filter((p) => p.is_seed).length + d.captions.filter((c) => c.is_seed).length,
  };
}

export type DashboardData = ReturnType<typeof buildDashboard>;

export function imageById(images: ImageRow[]) {
  return new Map(images.map((i) => [i.id, i]));
}
