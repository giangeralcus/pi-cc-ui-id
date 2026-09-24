/**
 * harga.ts — estimasi biaya sesi (USD) + konversi Rupiah via kurs terbaru.
 *
 * Sumber kurs: Google Finance (https://www.google.com/finance/quote/USD-IDR),
 * diambil live dengan cache 30 menit. Setiap tampilan kurs WAJIB mencantumkan
 * label "kurs Google" sesuai permintaan owner — jangan pernah menyajikan angka
 * konversi tanpa menyebut sumbernya.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export const KURS_URL = "https://www.google.com/finance/quote/USD-IDR";
export const KURS_TTL_MS = 30 * 60 * 1000;
export const KURS_TIMEOUT_MS = 8000;
/** Batas masuk akal nilai USD/IDR untuk menolak hasil parse rusak. */
export const KURS_MIN = 500;
export const KURS_MAX = 100000;

export interface UsageTotals {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
	requests: number;
}

export interface ModelCost {
	/** Nama model (untuk label tampilan), boleh kosong. */
	name?: string;
	/** Tarif USD per juta token. */
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
}

export interface CostBreakdown {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
	total: number;
}

export interface KursInfo {
	rate: number;
	fetchedAtMs: number;
	source: "Google Finance";
}

export function emptyUsageTotals(): UsageTotals {
	return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, requests: 0 };
}

/** Akumulasi satu event usage ke total sesi (aman terhadap nilai tidak valid). */
export function addUsage(t: UsageTotals, u: unknown): UsageTotals {
	if (!u || typeof u !== "object") return t;
	const g = (k: string): number => {
		const v = (u as Record<string, unknown>)[k];
		return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0;
	};
	t.input += g("input");
	t.output += g("output");
	t.cacheRead += g("cacheRead");
	t.cacheWrite += g("cacheWrite");
	t.requests += 1;
	return t;
}

function perMillion(tokens: number, rate: number | undefined): number {
	if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) return 0;
	return (tokens / 1_000_000) * rate;
}

/**
 * Estimasi biaya USD dari total token × tarif katalog model.
 * Masing-masing komponen 0 bila tarifnya tidak tersedia.
 */
export function computeCostUsd(t: UsageTotals, c: ModelCost): CostBreakdown {
	const input = perMillion(t.input, c.input);
	const output = perMillion(t.output, c.output);
	const cacheRead = perMillion(t.cacheRead, c.cacheRead);
	const cacheWrite = perMillion(t.cacheWrite, c.cacheWrite);
	return {
		input,
		output,
		cacheRead,
		cacheWrite,
		total: input + output + cacheRead + cacheWrite,
	};
}

/**
 * Parse kurs USD/IDR dari HTML halaman Google Finance quote.
 * Mengambil atribut data-last-price (format en-US, pemisah ribuan koma).
 */
export function parseGoogleFinanceRate(html: string): number | null {
	if (typeof html !== "string" || html.length === 0) return null;
	const m = html.match(/data-last-price="([0-9][0-9.,]*)"/);
	if (!m) return null;
	const cleaned = m[1].replace(/,/g, "");
	const rate = Number.parseFloat(cleaned);
	if (!Number.isFinite(rate) || rate < KURS_MIN || rate > KURS_MAX) return null;
	return rate;
}

export function formatUsd(usd: number): string {
	if (!Number.isFinite(usd) || usd === 0) return "$0";
	if (usd > 0 && usd < 0.01) return "<$0,01";
	const fixed = usd >= 100 ? usd.toFixed(0) : usd.toFixed(2);
	// Ganti 12.50 → 12,50 (gaya Indonesia) tapi pertahankan pemisah ribuan titik.
	return `$${fixed}`;
}

/** Konversi USD → string Rupiah gaya Indonesia (pemisah ribuan titik). */
export function formatIdr(usd: number, rate: number): string {
	if (!Number.isFinite(usd) || !Number.isFinite(rate) || rate <= 0) return "Rp 0";
	const idr = usd * rate;
	const decimals = idr > 0 && idr < 100 ? 2 : 0;
	const s = new Intl.NumberFormat("id-ID", {
		minimumFractionDigits: decimals,
		maximumFractionDigits: decimals,
	}).format(idr);
	return `Rp ${s}`;
}

function formatClock(ms: number): string {
	const d = new Date(ms);
	const hh = String(d.getHours()).padStart(2, "0");
	const mm = String(d.getMinutes()).padStart(2, "0");
	return `${hh}:${mm}`;
}

/** Durasi gaya extension: 42d / 1m 5d / 1j 2m 5d (d=detik, m=menit, j=jam). */
export function formatDuration(ms: number): string {
	if (!Number.isFinite(ms) || ms < 0) return "0d";
	const totalS = Math.floor(ms / 1000);
	const s = totalS % 60;
	const mTotal = Math.floor(totalS / 60);
	const m = mTotal % 60;
	const h = Math.floor(mTotal / 60);
	if (h > 0) return `${h}j ${m}m ${s}d`;
	if (m > 0) return `${m}m ${s}d`;
	return `${s}d`;
}

export interface SessionSummaryInput {
	totals: UsageTotals;
	cost: ModelCost;
	/** Ada minimal satu tarif > 0 pada model aktif. */
	hasTarif: boolean;
	kursInfo: KursInfo | null;
	/** Statistik streaming spinner: { tokens, ms } → avg tok/s sesi. */
	streamStats: { tokens: number; ms: number };
	/** Durasi sesi tercatat (ms) sejak pesan assistant pertama. */
	durationMs: number;
}

/**
 * Susun baris-baris ringkasan sesi (versi IDR + kurs Google). Fungsi murni —
 * gampang dites; tampilan final digabung registerHarga.
 */
export function buildSessionSummaryLines(input: SessionSummaryInput): string[] {
	const { totals, cost, hasTarif, kursInfo, streamStats, durationMs } = input;
	const lines: string[] = [];
	const id = (n: number): string => Math.round(n).toLocaleString("id-ID");
	const modelLabel = cost.name ? ` · model ${cost.name}` : "";
	lines.push(
		`Ringkasan sesi — ${durationMs > 0 ? formatDuration(durationMs) : "0d"} · ${totals.requests} permintaan${modelLabel}`,
	);
	lines.push(
		`• token in ${id(totals.input)} · out ${id(totals.output)} · cache-read ${id(totals.cacheRead)} · cache-write ${id(totals.cacheWrite)}`,
	);
	const avgTps = streamStats.ms > 0 ? (streamStats.tokens / streamStats.ms) * 1000 : 0;
	lines.push(
		`• rata-rata streaming: ${avgTps > 0 ? `${Math.round(avgTps)} tok/s` : "--"}`,
	);
	if (!hasTarif) {
		lines.push("• biaya: tarif katalog model tidak tersedia (--)");
		return lines;
	}
	const c = computeCostUsd(totals, cost);
	lines.push(
		`• biaya USD: ${formatUsd(c.total)} (in ${formatUsd(c.input)} · out ${formatUsd(c.output)} · cache ${formatUsd(c.cacheRead + c.cacheWrite)})`,
	);
	if (kursInfo) {
		lines.push(
			`• biaya IDR: ${formatIdr(c.total, kursInfo.rate)} — kurs Google ${kursInfo.rate.toLocaleString("id-ID", { maximumFractionDigits: 2 })} (USD/IDR, diambil ${formatClock(kursInfo.fetchedAtMs)})`,
		);
	} else {
		lines.push("• biaya IDR: kurs Google tidak tersedia (coba `/harga refresh`)");
	}
	return lines;
}

/**
 * Cache kurs Google Finance. `fetchImpl` dan `nowImpl` bisa disuntik untuk test.
 */
export class KursCache {
	private entry: KursInfo | null = null;
	private inflight: Promise<KursInfo | null> | null = null;
	private readonly fetchImpl: typeof fetch;
	private readonly nowImpl: () => number;
	constructor(
		fetchImpl: typeof fetch = fetch,
		nowImpl: () => number = Date.now,
	) {
		this.fetchImpl = fetchImpl;
		this.nowImpl = nowImpl;
	}

	public peek(): KursInfo | null {
		return this.entry;
	}

	public async get(force = false): Promise<KursInfo | null> {
		const now = this.nowImpl();
		if (
			!force &&
			this.entry !== null &&
			now - this.entry.fetchedAtMs < KURS_TTL_MS
		) {
			return this.entry;
		}
		if (this.inflight) return this.inflight;
		this.inflight = this.download().finally(() => {
			this.inflight = null;
		});
		return this.inflight;
	}

	private async download(): Promise<KursInfo | null> {
		try {
			const ac = new AbortController();
			const timer = setTimeout(() => ac.abort(), KURS_TIMEOUT_MS);
			try {
				const res = await this.fetchImpl(KURS_URL, {
					headers: {
						"User-Agent":
							"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
						"Accept-Language": "en-US,en;q=0.9",
					},
					signal: ac.signal,
				});
				if (!res.ok) return this.entry;
				const html = await res.text();
				const rate = parseGoogleFinanceRate(html);
				if (rate === null) return this.entry;
				this.entry = {
					rate,
					fetchedAtMs: this.nowImpl(),
					source: "Google Finance",
				};
				return this.entry;
			} finally {
				clearTimeout(timer);
			}
		} catch {
			// Jaringan gagal/timeout: pakai kurs cache terakhir (jika ada), tetap berlabel.
			return this.entry;
		}
	}
}

interface CommandCtx {
	model?: unknown;
	ui?: {
		notify: (message: string, level?: "info" | "warning" | "error") => void;
	};
}

export interface HargaOptions {
	/** Sumber statistik streaming spinner untuk avg tok/s sesi. */
	streamStatsProvider?: () => { tokens: number; ms: number };
}

export function registerHarga(
	pi: ExtensionAPI,
	opts: HargaOptions = {},
): HargaController {
	const totals = emptyUsageTotals();
	const kurs = new KursCache();
	let startedAtMs: number | null = null;
	let model: ModelCost = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };

	const setModelFromCtx = (m: unknown): void => {
		if (!m || typeof m !== "object") return;
		const rec = m as Record<string, unknown>;
		const cost = (
			typeof rec.cost === "object" && rec.cost !== null
				? (rec.cost as Record<string, unknown>)
				: {}
		);
		const num = (k: string): number => {
			const v = cost[k];
			return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0;
		};
		model = {
			name:
				typeof rec.name === "string" && rec.name
					? rec.name
					: typeof rec.id === "string"
						? rec.id
						: model.name,
			input: num("input"),
			output: num("output"),
			cacheRead: num("cacheRead"),
			cacheWrite: num("cacheWrite"),
		};
	};

	const hasTarif = (): boolean =>
		model.input > 0 ||
		model.output > 0 ||
		model.cacheRead > 0 ||
		model.cacheWrite > 0;

	const buildLines = (kursInfo: KursInfo | null): string[] =>
		buildSessionSummaryLines({
			totals,
			cost: model,
			hasTarif: hasTarif(),
			kursInfo,
			streamStats: opts.streamStatsProvider
				? opts.streamStatsProvider()
				: { tokens: 0, ms: 0 },
			durationMs:
				startedAtMs !== null ? Math.max(0, Date.now() - startedAtMs) : 0,
		});

	pi.on("message_end", async (event, ctx) => {
		const msg = (event as { message?: { usage?: unknown } })?.message;
		if (msg && typeof msg === "object" && "usage" in msg) {
			addUsage(totals, msg.usage);
			if (startedAtMs === null) startedAtMs = Date.now();
		}
		if (ctx && typeof ctx === "object" && "model" in ctx) {
			setModelFromCtx((ctx as unknown as { model?: unknown }).model);
		}
	});

	pi.on("model_select", async (event) => {
		const m = (event as { model?: unknown })?.model;
		setModelFromCtx(m);
	});

	// Ringkasan akhir sesi — otomatis saat session shutdown/quit.
	pi.on("session_shutdown", async (_event, ctx) => {
		try {
			const ui = (ctx as CommandCtx | undefined)?.ui;
			if (!ui?.notify) return;
			const kursInfo = await kurs.get();
			ui.notify(buildLines(kursInfo).join("\n"), "info");
		} catch {
			/* ringkasan terbaik-usaha; jangan pernah menggagalkan shutdown */
		}
	});

	pi.registerCommand("harga", {
		description:
			"Ringkasan pemakaian sesi (in/out, avg tok/s, USD → Rupiah via kurs Google) — harga, harga refresh, harga reset",
		handler: async (args: unknown, ctx: CommandCtx) => {
			const clean =
				(typeof args === "string" ? args : "").trim().toLowerCase();
			if (clean === "reset") {
				Object.assign(totals, emptyUsageTotals());
				startedAtMs = null;
				ctx.ui?.notify("Penghitung ringkasan sesi direset.", "info");
				return;
			}
			const force = clean === "refresh";
			if (ctx?.model) setModelFromCtx(ctx.model);
			const kursInfo = await kurs.get(force);
			ctx.ui?.notify(buildLines(kursInfo).join("\n"), "info");
		},
	});

	return new HargaController(totals, kurs, {
		getStartedAt: () => startedAtMs,
		setStartedAt: (v: number | null) => {
			startedAtMs = v;
		},
		getModel: () => model,
		buildLines,
	});
}

/** Handle ringan untuk test/introspeksi (totals, kurs, model bisa dibaca). */
export class HargaController {
	private readonly totals: UsageTotals;
	private readonly kurs: KursCache;
	private readonly hooks: {
		getStartedAt: () => number | null;
		setStartedAt: (v: number | null) => void;
		getModel: () => ModelCost;
		buildLines: (kursInfo: KursInfo | null) => string[];
	};
	constructor(
		totals: UsageTotals,
		kurs: KursCache,
		hooks: {
			getStartedAt: () => number | null;
			setStartedAt: (v: number | null) => void;
			getModel: () => ModelCost;
			buildLines: (kursInfo: KursInfo | null) => string[];
		},
	) {
		this.totals = totals;
		this.kurs = kurs;
		this.hooks = hooks;
	}
	public getTotals(): UsageTotals {
		return { ...this.totals };
	}
	public peekKurs(): KursInfo | null {
		return this.kurs.peek();
	}
	public getModel(): ModelCost {
		return this.hooks.getModel();
	}
	public getStartedAt(): number | null {
		return this.hooks.getStartedAt();
	}
	public setStartedAt(v: number | null): void {
		this.hooks.setStartedAt(v);
	}
	public buildSummaryLines(kursInfo: KursInfo | null): string[] {
		return this.hooks.buildLines(kursInfo);
	}
}
