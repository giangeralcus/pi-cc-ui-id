# pi-cc-ui-id 🇮🇩

**Spinner Claude Code dengan laju token live, penghitung TTL prompt cache 5 menit dengan status git & peringatan audio, dan tool renderer kompak — versi Bahasa Indonesia untuk [Pi coding agent](https://github.com/badlogic/pi-mono).**

> Fork berbahasa Indonesia dari [pi-cc-ui](https://github.com/ArdaYILDIZ-DEV/pi-cc-ui) karya [Arda YILDIZ](https://github.com/ArdaYILDIZ-DEV) (versi asli memakai kata kerja Turki). Proyek ini menerjemahkan seluruh UI ke Bahasa Indonesia — 191/191 test lulus.

`cc-ui-id` adalah extension UI terminal untuk Pi yang mengganti indikator kerja bawaan dengan spinner Claude Code 20fps plus kecepatan generasi streaming live (`tok/s`), menambahkan status git ganda dan penghitung TTL prompt cache di bawah editor, serta merender setiap tool call dalam gaya Claude yang kompak (`● Label(detail)` / `└ summary`).

## Instalasi

Sebagai pi package:

```
pi install git:github.com/giangeralcus/pi-cc-ui-id
```

Atau clone manual ke folder extensions (Pi otomatis menemukan extension di `~/.pi/agent/extensions/`):

```
git clone https://github.com/giangeralcus/pi-cc-ui-id.git ~/.pi/agent/extensions/cc-ui-id
```

Extension aktif pada start/reload berikutnya.

## Fitur

* **Baris spinner Claude Code:** loop glyph ping-pong 20fps (`· ✢ ✳ ✶ ✻ ✽`) dengan sapuan glimmer kanan→kiri melintasi kata kerja aksi Bahasa Indonesia yang dinamis, penghitung token, kecepatan generasi streaming live (`tok/s`, dihitung atas jendela bergulir 4 detik dari sampel usage/estimasi — responsif terhadap perubahan kecepatan, tidak terdrag TTFT/thinking seperti rata-rata kumulatif; laju usang >3 dtk otomatis disembunyikan), waktu turn berjalan, dan glow berpikir bergelombang sinus.

  Contoh kata kerja (dipilih acak setiap turn): `Memeriksa…`, `Berpikir…`, `Menganalisis…`, `Menyusun…`, `Memvalidasi…`, `Mengompilasi…`, `Memindai…` (±90 kata).
* **Status git & bar TTL prompt cache:** menampilkan branch git, jumlah file berubah, dan PR terbuka di kiri (`main* · 3 file`), bersama penghitung TTL `36d / 5m` rata kanan tepat di bawah editor.
* **Pergeseran warna berdasarkan kedekatan:** penghitung berinterpolasi mulus dari hijau segar (`#4EBA65`) melalui kuning dan oranye, menggelap menjadi merah tua (`RGB 140, 18, 18`) saat mendekati 5 menit.
* **Peringatan audio:** memutar notifikasi audio non-blocking saat milestone TTL cache terlewati:
  + Menit ke-3: `3.mp3` (1x)
  + Menit ke-4: `4.mp3` (1x)
  + Menit ke-4.30: `4.mp3` (2x)
* **Slash command:** `/cache` menampilkan waktu berlalu/sisa persis; `/cache toggle` menampilkan/menyembunyikan penghitung; `/cache sound` mengaktifkan/mematikan suara; `/cache sound test` memutar suara uji.
* **Perintah git:** `/git` menampilkan status repositori, branch, dan PR terbuka; `/git refresh` memaksa pembaruan latar belakang.
* **Tool renderer kompak & diff Claude:** setiap tool dirender sebagai `● Label(detail)` dengan ringkasan satu baris `└ summary`. Tool `edit` memiliki styling diff penuh gaya Claude Code dengan latar hijau/merah selebar baris, intra-line word diff tingkat token, tata letak gutter `<lineNum> <sign> <code>`, dan syntax highlighting. Toggle dinamis dengan `/cc-tools`.

## Format waktu

Singkatan Bahasa Indonesia: `d` = detik, `m` = menit, `j` = jam. Contoh: `45d`, `1m 15d`, `1j 2m 5d`.

## Perintah

| Perintah | Aksi |
| --- | --- |
| `/cache` | Menampilkan waktu berlalu, sisa detik TTL prompt cache, dan notifikasi status |
| `/cache toggle` | Menampilkan atau menyembunyikan widget penghitung sub-editor |
| `/cache sound` | Mengaktifkan/mematikan peringatan audio (`sound on` / `sound off`) |
| `/cache sound test` | Segera memutar suara peringatan menit ke-3 untuk menguji output audio |
| `/git` | Menampilkan branch repositori git saat ini, jumlah file berubah, dan PR terbuka |
| `/git refresh` | Memaksa pembaruan status git & PR di latar belakang |
| `/cc-tools` | Menampilkan status tool renderer kompak |
| `/cc-tools on` / `/cc-tools off` / `/cc-tools toggle` | Mengaktifkan/menonaktifkan tool renderer kompak secara dinamis |

## Struktur proyek

```
.
├── cache-timer.ts          # widget TTL prompt cache 5 menit dengan integrasi status git (di bawah editor)
├── claude-diff.ts          # parser diff, syntax highlighter, dan komponen TUI gaya Claude Code
├── git-info.ts             # pelacak repositori git & pull request tanpa dependensi
├── index.ts                # entry point extension: spinner, git info, cache timer, tool renderers
├── package.json            # konfigurasi package & skrip test
├── palette.ts              # warna palet Claude Code, ANSI truecolor, dan sanitasi
├── README.md               # dokumentasi proyek
├── sounds                  # file audio peringatan cache (3.mp3, 4.mp3)
├── spinner.ts              # loop spinner CC 20fps, sapuan glimmer, kata kerja Indonesia, tok/s live
├── tests                   # 191 unit, lifecycle, performance, dan security tests
├── tool-renderers.ts       # renderer kompak gaya Claude untuk builtin + custom tools (`/cc-tools`)
└── tsconfig.json           # konfigurasi TypeScript
```

## Testing

```
npm install
npm run typecheck
npm test
```

Catatan: `npm run typecheck` membutuhkan peer deps ter-resolve (jalankan `npm install` dulu). Test suite lulus penuh di Windows (fork ini memperbaiki asersi path `sounds/` yang sebelumnya gagal di Windows).

## Kredit & Lisensi

- **Author asli:** [Arda YILDIZ](https://github.com/ArdaYILDIZ-DEV) — [pi-cc-ui](https://github.com/ArdaYILDIZ-DEV/pi-cc-ui) (MIT)
- **Terjemahan Bahasa Indonesia & perbaikan Windows:** [giangeralcus](https://github.com/giangeralcus)

Lisensi MIT — lihat [LICENSE](LICENSE).
