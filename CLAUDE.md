# CLAUDE.md — pi-cc-ui-id

## Status Proyek

**INI PROYEK SIDE HOBBY.** Fasilitasan saja, santai. Bukan kerjaan klien, tidak ada deadline, tidak ada SLA. Kalau ada task klien/GPI yang masuk, prioritaskan itu dulu — proyek ini boleh mangkrak.

## Apa ini

Fork **Bahasa Indonesia** dari [pi-cc-ui](https://github.com/ArdaYILDIZ-DEV/pi-cc-ui) (karya Arda YILDIZ, versi Turki) — extension UI spinner gaya Claude Code untuk Pi coding agent: spinner 20fps + tok/s live, penghitung TTL prompt cache 5 menit + peringatan audio, status git, tool renderer kompak.

## Konvensi penting (biar test gak rusak)

- **Kata kerja spinner** ada di `spinner.ts` → array `VERBS` (±90 kata, dipilih acak per turn). Bahasa Indonesia, satu kata, bentuk `me-`.
- **Fallback verb** = `"Memproses"` (3 tempat di `spinner.ts`).
- **Format waktu**: `d` (detik), `m` (menit), `j` (jam) — dipakai di `spinner.ts` (`formatElapsed`) dan `cache-timer.ts` (`formatCacheElapsed`/`formatCacheRemaining`).
- **Beberapa test assert panjang karakter verb & inisial huruf** (mis. `startsWith("✻ M")`, `visibleWidth === 9`). Kalau ganti verb di fixture test, cek assertion lebar/inisial di `tests/spinner.test.ts` (test "layout responsiveness" & "applies shimmer color").
- **Path suara di test** wajib pakai `join("sounds", "3.mp3")` — jangan hardcode `sounds/3.mp3`, bakal fail di Windows.
- Test fixtures Unicode Turki di `tests/palette.test.ts` / `tests/security.test.ts` itu **sengaja** (test lebar karakter & sanitasi) — jangan diterjemahkan.

## Perintah dev

```
npm install        # resolve peer deps (pi-coding-agent dll dari npm registry)
npm test           # node --test — wajib 187/187 sebelum push
npm run typecheck  # butuh npm install dulu
```

## Rilis

Push ke `main` = rilis. Install via `pi install git:github.com/giangeralcus/pi-cc-ui-id`.
