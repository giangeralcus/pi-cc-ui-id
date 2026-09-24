import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
	formatTokenCount,
	formatElapsed,
	thinkingWording,
	thinkingGlowPaint,
	glimmerMessage,
	buildSpinnerLine,
	effortSuffixFor,
	sampleVerb,
	currentWorkingVerb,
	registerSpinner,
	SpinnerController,
	type SpinnerPaint,
	type SpinnerFrameState,
} from "../spinner.ts";
import { visibleWidth, stripAnsi } from "../palette.ts";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const mockPaint: SpinnerPaint = {
	accent: (s) => `\x1b[38;2;215;119;87m${s}\x1b[39m`,
	shimmer: (s) => `\x1b[38;2;235;159;127m${s}\x1b[39m`,
	dim: (s) => `\x1b[2m${s}\x1b[22m`,
};

describe("spinner", () => {
	describe("formatTokenCount", () => {
		it("formats small numbers as plain strings", () => {
			assert.equal(formatTokenCount(0), "0");
			assert.equal(formatTokenCount(150), "150");
			assert.equal(formatTokenCount(999), "999");
		});

		it("formats thousands with decimal k notation", () => {
			assert.equal(formatTokenCount(1000), "1k");
			assert.equal(formatTokenCount(1200), "1.2k");
			assert.equal(formatTokenCount(1250), "1.3k");
			assert.equal(formatTokenCount(9900), "9.9k");
		});

		it("formats large numbers as rounded k", () => {
			assert.equal(formatTokenCount(10000), "10k");
			assert.equal(formatTokenCount(25600), "26k");
			assert.equal(formatTokenCount(120000), "120k");
		});

		it("formats millions with M notation", () => {
			assert.equal(formatTokenCount(1000000), "1M");
			assert.equal(formatTokenCount(1500000), "1.5M");
			assert.equal(formatTokenCount(12300000), "12.3M");
		});

		it("safely handles edge cases like NaN, Infinity, negative values", () => {
			assert.equal(formatTokenCount(Number.NaN), "0");
			assert.equal(formatTokenCount(Number.POSITIVE_INFINITY), "0");
			assert.equal(formatTokenCount(Number.NEGATIVE_INFINITY), "0");
			assert.equal(formatTokenCount(-50), "0");
			assert.equal(formatTokenCount(-1000), "0");
		});
	});

	describe("formatElapsed", () => {
		it("formats seconds", () => {
			assert.equal(formatElapsed(0), "0d");
			assert.equal(formatElapsed(5400), "5d");
			assert.equal(formatElapsed(45000), "45d");
		});

		it("formats minutes and seconds", () => {
			assert.equal(formatElapsed(65000), "1m 5d");
			assert.equal(formatElapsed(125000), "2m 5d");
		});

		it("formats hours, minutes, and seconds", () => {
			assert.equal(formatElapsed(3665000), "1j 1m 5d");
		});

		it("safely handles edge cases like NaN, negative numbers, Infinity", () => {
			assert.equal(formatElapsed(Number.NaN), "0d");
			assert.equal(formatElapsed(-1000), "0d");
			assert.equal(formatElapsed(Number.POSITIVE_INFINITY), "0d");
		});
	});

	describe("thinkingWording", () => {
		it("returns escalating wording based on elapsed time", () => {
			assert.equal(thinkingWording(0), "berpikir");
			assert.equal(thinkingWording(29000), "berpikir");
			assert.equal(thinkingWording(30000), "berpikir lebih dalam");
			assert.equal(thinkingWording(59000), "berpikir lebih dalam");
			assert.equal(thinkingWording(60000), "masih berpikir");
			assert.equal(thinkingWording(119000), "masih berpikir");
			assert.equal(thinkingWording(120000), "hampir selesai berpikir");
			assert.equal(thinkingWording(300000), "hampir selesai berpikir");
		});

		it("safely handles negative numbers and NaN", () => {
			assert.equal(thinkingWording(-5000), "berpikir");
			assert.equal(thinkingWording(Number.NaN), "berpikir");
		});
	});

	describe("thinkingGlowPaint", () => {
		it("renders dark scheme glowing text with correct ANSI truecolor sequences", () => {
			const paintDark0 = thinkingGlowPaint(0, "dark");
			const res0 = paintDark0("berpikir");
			assert.ok(res0.includes("berpikir"));
			assert.ok(res0.startsWith("\x1b[38;2;153;153;153m"));
			assert.ok(res0.endsWith("\x1b[39m"));

			const paintDark4000 = thinkingGlowPaint(4000, "dark");
			const res4000 = paintDark4000("berpikir");
			assert.ok(res4000.includes("berpikir"));
			assert.ok(res4000.endsWith("\x1b[39m"));
		});

		it("renders light scheme glowing text with high contrast grays", () => {
			const paintLight0 = thinkingGlowPaint(0, "light");
			const res0 = paintLight0("berpikir");
			assert.ok(res0.includes("berpikir"));
			assert.ok(res0.startsWith("\x1b[38;2;105;105;105m"));
			assert.ok(res0.endsWith("\x1b[39m"));
		});
	});

	describe("effortSuffixFor", () => {
		it("returns empty string for none, off, or undefined", () => {
			assert.equal(effortSuffixFor(undefined), "");
			assert.equal(effortSuffixFor(""), "");
			assert.equal(effortSuffixFor("none"), "");
			assert.equal(effortSuffixFor("off"), "");
		});

		it("translates effort levels to Turkish", () => {
			assert.equal(effortSuffixFor("high"), " (effort tinggi)");
			assert.equal(effortSuffixFor("medium"), " (effort sedang)");
			assert.equal(effortSuffixFor("low"), " (effort rendah)");
			assert.equal(effortSuffixFor("minimal"), " (effort minimal)");
			assert.equal(effortSuffixFor("xhigh"), " (effort maksimal)");
			assert.equal(effortSuffixFor("max"), " (effort maksimal)");
			assert.equal(effortSuffixFor("custom"), " (custom effort)");
		});
	});

	describe("glimmerMessage", () => {
		it("returns empty string for empty input", () => {
			assert.equal(glimmerMessage("", 0, mockPaint), "");
		});

		it("returns accent message when glimmer is completely off-screen", () => {
			const res = glimmerMessage("Memproses…", 999, mockPaint);
			assert.equal(stripAnsi(res), "Memproses…");
			assert.ok(res.endsWith("\x1b[39m"));
		});

		it("returns accent message when glimmerIndex is NaN", () => {
			const res = glimmerMessage("Memproses…", Number.NaN, mockPaint);
			assert.equal(stripAnsi(res), "Memproses…");
			assert.ok(res.endsWith("\x1b[39m"));
		});

		it("applies shimmer color to characters around glimmerIndex", () => {
			const res = glimmerMessage("Berpikir…", 4, mockPaint);
			assert.ok(res.includes("\x1b[38;2;235;159;127m"));
			assert.ok(res.includes("\x1b[38;2;215;119;87m"));
			assert.equal(visibleWidth(res), visibleWidth("Berpikir…"));
		});

		it("maintains ANSI integrity at all boundary sweep positions", () => {
			const verb = "Memperkaya…";
			const width = visibleWidth(verb);

			// Sweep from offscreen left (-5) to offscreen right (+30)
			for (let idx = -5; idx <= width + 10; idx++) {
				const rendered = glimmerMessage(verb, idx, mockPaint);
				assert.equal(visibleWidth(rendered), width);
				assert.equal(stripAnsi(rendered), verb);
				// Verify all ANSI color escapes are terminated with \x1b[39m
				assert.ok(rendered.endsWith("\x1b[39m"));
			}
		});
	});

	describe("buildSpinnerLine", () => {
		it("builds a basic line with glyph and verb", () => {
			const state: SpinnerFrameState = {
				verb: "Mengodekan",
				timeMs: 120,
				columns: 13, // tight width so byline is omitted
			};
			const line = buildSpinnerLine(state, mockPaint);
			assert.ok(stripAnsi(line).includes("Mengodekan…"));
			assert.equal(visibleWidth(line), 13); // glyph (1) + space (1) + Mengodekan… (11)
		});

		it("falls back to default verb when empty verb is provided", () => {
			const state: SpinnerFrameState = {
				verb: "",
				timeMs: 120,
				columns: 120,
			};
			const line = buildSpinnerLine(state, mockPaint);
			assert.ok(stripAnsi(line).includes("Memproses…"));
		});

		it("includes tokens and timer when space is available", () => {
			const state: SpinnerFrameState = {
				verb: "Memproses",
				timeMs: 15000,
				columns: 120,
				tokens: 1500,
			};
			const line = buildSpinnerLine(state, mockPaint);
			const stripped = stripAnsi(line);
			assert.ok(stripped.includes("15d"));
			assert.ok(stripped.includes("↓ 1.5k token"));
		});

		it("includes live tokensPerSecond when space allows and drops it when tight", () => {
			const wideState: SpinnerFrameState = {
				verb: "Memproses",
				timeMs: 15000,
				columns: 120,
				tokens: 1500,
				tokensPerSecond: 48.4,
			};
			const wideLine = buildSpinnerLine(wideState, mockPaint);
			const wideStripped = stripAnsi(wideLine);
			assert.ok(wideStripped.includes("15d"));
			assert.ok(wideStripped.includes("↓ 1.5k token"));
			assert.ok(wideStripped.includes("48 tok/s"));

			// When constrained to 36 columns: drops tok/s but keeps tokens and timer
			const mediumState: SpinnerFrameState = {
				...wideState,
				columns: 38,
			};
			const mediumLine = buildSpinnerLine(mediumState, mockPaint);
			const mediumStripped = stripAnsi(mediumLine);
			assert.ok(visibleWidth(mediumLine) <= 38);
			assert.ok(!mediumStripped.includes("tok/s"));
			assert.ok(mediumStripped.includes("↓ 1.5k token"));
		});

		it("tracks live tokensPerSecond during message_update and message_end", () => {
			const controller = new SpinnerController();
			const mockCtx = {
				hasUI: true,
				ui: {
					setWorkingMessage: () => {},
					setWorkingIndicator: () => {},
					setTitle: () => {},
				},
			};

			controller.handleAgentStart(mockCtx as any);
			assert.equal(controller.getTokensPerSecond(), null);

			// First delta establishes start time and baseline
			controller.handleMessageUpdate(
				{
					assistantMessageEvent: {
						type: "text_delta",
						delta: "Merhaba! ",
					},
				} as any,
				mockCtx as any,
			);

			// Artificially simulate 500ms elapsed with another chunk
			// Use setTokensPerSecond to test direct setter and getter
			controller.setTokensPerSecond(42);
			assert.equal(controller.getTokensPerSecond(), 42);
			assert.equal(controller.getState().tokensPerSecond, 42);

			controller.handleAgentSettled(mockCtx as any);
			assert.equal(controller.getTokensPerSecond(), null);
		});

		it("includes thinking status and effort suffix", () => {
			const state: SpinnerFrameState = {
				verb: "Berpikir",
				timeMs: 5000,
				columns: 120,
				thinkingStatus: "thinking",
				effortSuffix: " (effort tinggi)",
				thinkingElapsedMs: 4000,
			};
			const line = buildSpinnerLine(state, mockPaint);
			const stripped = stripAnsi(line);
			assert.ok(stripped.includes("berpikir (effort tinggi)"));
		});

		it("formats completed thinking duration when status is a number", () => {
			const state: SpinnerFrameState = {
				verb: "Memproses",
				timeMs: 10000,
				columns: 120,
				thinkingStatus: 3400,
			};
			const line = buildSpinnerLine(state, mockPaint);
			const stripped = stripAnsi(line);
			assert.ok(stripped.includes("3d berpikir"));
		});

		it("drops tokens and timer progressively when terminal width is tight", () => {
			const wideState: SpinnerFrameState = {
				verb: "Memproses",
				timeMs: 15000,
				columns: 120,
				tokens: 1500,
				thinkingStatus: "thinking",
			};
			const wideLine = buildSpinnerLine(wideState, mockPaint);
			assert.ok(stripAnsi(wideLine).includes("15d"));
			assert.ok(stripAnsi(wideLine).includes("↓ 1.5k token"));

			const tightState: SpinnerFrameState = {
				verb: "Memproses",
				timeMs: 15000,
				columns: 32,
				tokens: 1500,
				thinkingStatus: "thinking",
			};
			const tightLine = buildSpinnerLine(tightState, mockPaint);
			assert.ok(stripAnsi(tightLine).includes("berpikir"));
			assert.ok(visibleWidth(tightLine) <= 32);
		});

		it("safely handles extreme edge cases in frame state", () => {
			const edgeState: SpinnerFrameState = {
				verb: "Test",
				timeMs: Number.NaN,
				columns: 0,
				tokens: -500,
				thinkingStatus: Number.NaN as any,
				thinkingElapsedMs: Number.NaN,
			};
			const line = buildSpinnerLine(edgeState, mockPaint);
			assert.ok(stripAnsi(line).includes("Test…"));
		});
	});

	describe("layout responsiveness and viewport handling", () => {
		const fullState: SpinnerFrameState = {
			verb: "Memperkaya",
			timeMs: 25000,
			tokens: 4500,
			thinkingStatus: "thinking",
			effortSuffix: " (effort tinggi)",
			thinkingElapsedMs: 15000,
			columns: 120,
		};

		it("never exceeds terminal columns for any column width from 1 to 200", () => {
			for (let cols = 1; cols <= 200; cols++) {
				const line = buildSpinnerLine({ ...fullState, columns: cols }, mockPaint);
				const width = visibleWidth(line);
				assert.ok(
					width <= cols,
					`Visible width ${width} exceeded terminal columns ${cols} for line [${stripAnsi(line)}]`,
				);
			}
		});

		it("progressively collapses layout through defined responsive breakpoints", () => {
			// 1. Ultra narrow (cols = 1): single glyph
			const line1 = buildSpinnerLine({ ...fullState, columns: 1 }, mockPaint);
			assert.equal(visibleWidth(line1), 1);
			assert.equal(stripAnsi(line1), "✻");

			// 2. Ultra narrow (cols = 3): glyph + ellipsis
			const line3 = buildSpinnerLine({ ...fullState, columns: 3 }, mockPaint);
			assert.equal(visibleWidth(line3), 3);
			assert.equal(stripAnsi(line3), "✻ …");

			// 3. Ultra narrow (cols = 8): truncated verb stem
			const line8 = buildSpinnerLine({ ...fullState, columns: 8 }, mockPaint);
			assert.ok(visibleWidth(line8) <= 8);
			assert.ok(stripAnsi(line8).startsWith("✻ M"));
			assert.ok(stripAnsi(line8).endsWith("…"));

			// 4. Narrow (cols = 14): full verb without byline
			const line22 = buildSpinnerLine({ ...fullState, columns: 14 }, mockPaint);
			assert.ok(visibleWidth(line22) <= 14);
			assert.equal(stripAnsi(line22), "✻ Memperkaya…");

			// 5. Medium narrow (cols = 35): single byline item (thinking or timer)
			const line35 = buildSpinnerLine({ ...fullState, columns: 35 }, mockPaint);
			assert.ok(visibleWidth(line35) <= 35);
			const stripped35 = stripAnsi(line35);
			assert.ok(stripped35.includes("✻ Memperkaya…"));
			assert.ok(stripped35.includes("(") && stripped35.includes(")"));

			// 6. Medium width (cols = 65): timer + tokens + short thinking
			const line65 = buildSpinnerLine({ ...fullState, columns: 65 }, mockPaint);
			assert.ok(visibleWidth(line65) <= 65);
			const stripped65 = stripAnsi(line65);
			assert.ok(stripped65.includes("25d"));
			assert.ok(stripped65.includes("↓ 4.5k token"));

			// 7. Full width (cols = 120): timer + tokens + thinking with full effort suffix
			const line120 = buildSpinnerLine({ ...fullState, columns: 120 }, mockPaint);
			assert.ok(visibleWidth(line120) <= 120);
			const stripped120 = stripAnsi(line120);
			assert.ok(stripped120.includes("25d"));
			assert.ok(stripped120.includes("↓ 4.5k token"));
			assert.ok(stripped120.includes("berpikir (effort tinggi)"));
		});

		it("safely truncates Turkish multi-byte characters without corruption", () => {
			const turkishVerbs = [
				"Membedahkan",
				"Memformat",
				"Menganalisis",
				"Mengevaluasi",
				"Berpikir",
				"Memperluas",
				"Menguatkan",
				"Mengoptimalkan",
				"Membentuk",
				"Memperkaya",
			];

			const validGlyphs = new Set(["·", "✢", "✳", "✶", "✻", "✽", "*"]);

			for (const verb of turkishVerbs) {
				for (let cols = 4; cols <= 30; cols++) {
					const line = buildSpinnerLine(
						{
							verb,
							timeMs: 1000,
							columns: cols,
						},
						mockPaint,
					);
					const stripped = stripAnsi(line);
					assert.ok(visibleWidth(line) <= cols);
					const firstGlyph = [...stripped][0];
					assert.ok(validGlyphs.has(firstGlyph!));
					assert.equal([...stripped][1], " ");
					// Verify no replacement character (\uFFFD) or malformed UTF-8
					assert.ok(!stripped.includes("\uFFFD"));
				}
			}
		});
	});

	describe("verbs", () => {
		it("sampleVerb returns a non-empty Indonesian verb", () => {
			const verb = sampleVerb();
			assert.equal(typeof verb, "string");
			assert.ok(verb.length > 0);
		});

		it("currentWorkingVerb returns the active verb", () => {
			const verb = currentWorkingVerb();
			assert.equal(typeof verb, "string");
			assert.ok(verb.length > 0);
		});
	});

	describe("registerSpinner", () => {
		it("registers event handlers on pi ExtensionAPI and returns controller", () => {
			const handlers: Record<string, Function> = {};
			const mockPi = {
				on(event: string, handler: Function) {
					handlers[event] = handler;
				},
			} as unknown as ExtensionAPI;

			const controller = registerSpinner(mockPi);
			assert.ok(controller);
			assert.equal(typeof handlers["session_start"], "function");
			assert.equal(typeof handlers["agent_start"], "function");
			assert.equal(typeof handlers["message_update"], "function");
			assert.equal(typeof handlers["message_end"], "function");
			assert.equal(typeof handlers["agent_end"], "function");
			assert.equal(typeof handlers["agent_settled"], "function");
			assert.equal(typeof handlers["session_shutdown"], "function");
		});
	});
});

describe("sliding-window token rate (tok/s)", () => {
	class ClockSpinner extends SpinnerController {
		public clock = 1_000_000;
		protected override timeNow(): number {
			return this.clock;
		}
		public tick(ms: number): void {
			this.clock += ms;
		}
	}
	const mockCtx = {
		hasUI: true,
		ui: {
			setWorkingMessage: () => {},
			setWorkingIndicator: () => {},
			setTitle: () => {},
		},
	};
	const usageUpdate = (out: number) =>
		({
			assistantMessageEvent: { type: "text_delta", delta: "x", partial: { usage: { output: out } } },
		}) as any;

	it("computes rate from windowed usage deltas, not cumulative elapsed", () => {
		const c = new ClockSpinner();
		c.handleAgentStart(mockCtx as any);
		// Lambat di awal (TTFT panjang): 10 token pada detik ke-0.
		c.handleMessageUpdate(usageUpdate(10), mockCtx as any);
		c.tick(1000);
		// Burst cepat: +50 token dalam 1 detik → laju jendela = 50 tok/s,
		// bukan menunggu rata-rata kumulatif turun/naik perlahan.
		c.handleMessageUpdate(usageUpdate(60), mockCtx as any);
		assert.equal(c.getTokensPerSecond(), 50);
	});

	it("recomputes over the sliding window when speed changes mid-stream", () => {
		const c = new ClockSpinner();
		c.handleAgentStart(mockCtx as any);
		c.handleMessageUpdate(usageUpdate(10), mockCtx as any);
		c.tick(1000);
		c.handleMessageUpdate(usageUpdate(60), mockCtx as any); // 50 tok/s
		assert.equal(c.getTokensPerSecond(), 50);
		c.tick(1000);
		// Jendela penuh 2 dtk: (160-10)/2s = 75 tok/s — rata-rata jendela,
		// tetap jauh lebih responsif daripada rata-rata kumulatif.
		c.handleMessageUpdate(usageUpdate(160), mockCtx as any);
		assert.equal(c.getTokensPerSecond(), 75);
	});

	it("hides stale rate after RATE window silence and resets on settle", () => {
		const c = new ClockSpinner();
		c.handleAgentStart(mockCtx as any);
		c.handleMessageUpdate(usageUpdate(10), mockCtx as any);
		c.tick(1000);
		c.handleMessageUpdate(usageUpdate(60), mockCtx as any);
		assert.ok(c.getState().tokensPerSecond !== null);
		// Diam > RATE_FRESH_MS tanpa sampel baru → laju disembunyikan.
		c.tick(3500);
		assert.equal(c.getState().tokensPerSecond, null);
		// Settle mereset penuh.
		c.handleAgentSettled(mockCtx as any);
		assert.equal(c.getTokensPerSecond(), null);
	});

	it("falls back to chars/4 estimate sampling when usage is absent", () => {
		const c = new ClockSpinner();
		c.handleAgentStart(mockCtx as any);
		c.handleMessageUpdate(
			{ assistantMessageEvent: { type: "text_delta", delta: "a".repeat(120) } } as any,
			mockCtx as any,
		);
		c.tick(500);
		c.handleMessageUpdate(
			{ assistantMessageEvent: { type: "text_delta", delta: "b".repeat(120) } } as any,
			mockCtx as any,
		);
		// 240 chars ≈ 60 token estimasi dalam 0,5 dtk → ~120 tok/s.
		const tps = c.getTokensPerSecond();
		assert.ok(tps !== null && tps >= 60 && tps <= 240, `tps=${tps}`);
	});
});
