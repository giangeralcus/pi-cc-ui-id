import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
	addUsage,
	computeCostUsd,
	emptyUsageTotals,
	parseGoogleFinanceRate,
	formatUsd,
	formatIdr,
	formatDuration,
	buildSessionSummaryLines,
	KursCache,
	KURS_MIN,
	KURS_MAX,
	type KursInfo,
} from "../harga.ts";

describe("usage totals", () => {
	it("accumulates usage and counts requests", () => {
		const t = emptyUsageTotals();
		addUsage(t, { input: 100, output: 50, cacheRead: 10, cacheWrite: 5 });
		addUsage(t, { input: 1, output: 2, cacheRead: 3, cacheWrite: 4 });
		assert.equal(t.input, 101);
		assert.equal(t.output, 52);
		assert.equal(t.cacheRead, 13);
		assert.equal(t.cacheWrite, 9);
		assert.equal(t.requests, 2);
	});
	it("guards against invalid or missing usage fields", () => {
		const t = emptyUsageTotals();
		addUsage(t, undefined);
		addUsage(t, { input: -5, output: "banyak", cacheRead: NaN });
		addUsage(t, {});
		assert.deepEqual(t, {
			input: 0,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0,
			requests: 2,
		});
	});
});

describe("cost computation", () => {
	it("computes per-category and total USD from per-million rates", () => {
		const usd = computeCostUsd(
			{ input: 1_000_000, output: 500_000, cacheRead: 2_000_000, cacheWrite: 0, requests: 1 },
			{ input: 2, output: 8, cacheRead: 0.4, cacheWrite: 1 },
		);
		assert.equal(usd.input, 2);
		assert.equal(usd.output, 4);
		assert.equal(usd.cacheRead, 0.8);
		assert.equal(usd.cacheWrite, 0);
		assert.ok(Math.abs(usd.total - 6.8) < 1e-9);
	});
	it("zero rates yield zero cost", () => {
		const usd = computeCostUsd(emptyUsageTotals(), {
			input: 0,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0,
		});
		assert.equal(usd.total, 0);
	});
});

describe("Google Finance rate parsing", () => {
	it("parses data-last-price with thousands separators", () => {
		const html = '<div data-last-price="16,543" ...>USD-IDR</div>';
		assert.equal(parseGoogleFinanceRate(html), 16543);
	});
	it("parses decimal prices", () => {
		assert.equal(parseGoogleFinanceRate('data-last-price="16,543.25"'), 16543.25);
	});
	it("rejects garbage, missing attr, and out-of-range values", () => {
		assert.equal(parseGoogleFinanceRate("<html>no attr</html>"), null);
		assert.equal(parseGoogleFinanceRate('data-last-price="abc"'), null);
		assert.equal(parseGoogleFinanceRate(`data-last-price="${KURS_MIN - 1}"`), null);
		assert.equal(parseGoogleFinanceRate(`data-last-price="${KURS_MAX + 1}"`), null);
		assert.equal(parseGoogleFinanceRate(""), null);
	});
});

describe("formatters", () => {
	it("formats USD with Indonesian decimal comma", () => {
		assert.equal(formatUsd(0), "$0");
		assert.equal(formatUsd(0.004), "<$0,01");
		assert.equal(formatUsd(12.5), "$12.50");
		assert.equal(formatUsd(150.004), "$150");
	});
	it("formats IDR with dot thousands separators", () => {
		assert.equal(formatIdr(1.23, 16000), "Rp 19.680");
		assert.equal(formatIdr(0.0005, 16000), "Rp 8,00");
		assert.equal(formatIdr(1, -5), "Rp 0");
	});
	it("formats duration in d/m/j units", () => {
		assert.equal(formatDuration(42_000), "42d");
		assert.equal(formatDuration(65_000), "1m 5d");
		assert.equal(formatDuration(3_661_000), "1j 1m 1d");
		assert.equal(formatDuration(-1), "0d");
	});
});

describe("session summary lines", () => {
	const kursInfo: KursInfo = {
		rate: 16000,
		fetchedAtMs: 1_000,
		source: "Google Finance",
	};
	it("shows tokens, avg tok/s, USD and IDR with kurs Google label", () => {
		const lines = buildSessionSummaryLines({
			totals: { input: 1_000_000, output: 500_000, cacheRead: 0, cacheWrite: 0, requests: 7 },
			cost: { name: "m", input: 2, output: 8, cacheRead: 0, cacheWrite: 0 },
			hasTarif: true,
			kursInfo,
			streamStats: { tokens: 420, ms: 6000 },
			durationMs: 65_000,
		});
		const joined = lines.join("\n");
		assert.ok(joined.includes("Ringkasan sesi — 1m 5d · 7 permintaan"));
		assert.ok(joined.includes("in 1.000.000 · out 500.000"));
		assert.ok(joined.includes("70 tok/s"));
		assert.ok(joined.includes("$6.00"));
		assert.ok(joined.includes("Rp 96.000"));
		assert.ok(joined.includes("kurs Google 16.000"));
	});
	it("shows -- placeholders without tariff or kurs", () => {
		const lines = buildSessionSummaryLines({
			totals: emptyUsageTotals(),
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			hasTarif: false,
			kursInfo: null,
			streamStats: { tokens: 0, ms: 0 },
			durationMs: 0,
		});
		const joined = lines.join("\n");
		assert.ok(joined.includes("tarif katalog model tidak tersedia"));
		assert.ok(joined.includes("rata-rata streaming: --"));
	});
});

describe("KursCache", () => {
	const makeHtml = (rate: number) => `data-last-price="${rate}"`;
	it("fetches once and serves cached value within TTL", async () => {
		let calls = 0;
		let now = 1_000_000;
		const kc = new KursCache(
			(async () => {
				calls += 1;
				return new Response(makeHtml(16000), { status: 200 });
			}) as typeof fetch,
			() => now,
		);
		const a = await kc.get();
		assert.equal(a?.rate, 16000);
		now += 60_000; // < TTL
		const b = await kc.get();
		assert.equal(b?.rate, 16000);
		assert.equal(calls, 1);
	});
	it("refetches when forced or when TTL expires", async () => {
		let calls = 0;
		let rate = 16000;
		let now = 1_000_000;
		const kc = new KursCache(
			(async () => {
				calls += 1;
				return new Response(makeHtml(rate), { status: 200 });
			}) as typeof fetch,
			() => now,
		);
		await kc.get();
		rate = 16100;
		const forced = await kc.get(true);
		assert.equal(forced?.rate, 16100);
		assert.equal(calls, 2);
		now += 31 * 60_000; // > TTL
		const expired = await kc.get();
		assert.equal(expired?.rate, 16100);
		assert.equal(calls, 3);
	});
	it("keeps last good kurs when the network fails", async () => {
		let fail = false;
		let now = 2_000_000;
		const kc = new KursCache(
			(async () => {
				if (fail) throw new Error("offline");
				return new Response(makeHtml(16500), { status: 200 });
			}) as typeof fetch,
			() => now,
		);
		const good = await kc.get();
		assert.equal(good?.rate, 16500);
		fail = true;
		now += 31 * 60_000;
		const degraded = await kc.get(true);
		assert.equal(degraded?.rate, 16500);
	});
	it("returns null when the page has no parsable rate", async () => {
		const kc = new KursCache(
			(async () => new Response("<html></html>", { status: 200 })) as typeof fetch,
			() => 1,
		);
		assert.equal(await kc.get(true), null);
	});
});
