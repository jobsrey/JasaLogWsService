# 📁 Assets Folder

Folder ini berisi library frontend yang digunakan oleh `map-viewer.html`.

## Struktur Folder

```
assets/
├── css/
│   └── leaflet.css          # Leaflet CSS untuk styling peta
├── js/
│   ├── leaflet.js           # Leaflet JS library untuk peta interaktif
│   └── jquery-3.7.1.min.js  # jQuery library
└── images/
    ├── marker-icon.png      # Icon marker default
    ├── marker-icon-2x.png   # Icon marker retina display
    ├── marker-shadow.png    # Shadow untuk marker
    ├── layers.png           # Icon untuk layer control
    └── layers-2x.png        # Icon layer retina display
```

## Download Assets

Jika folder ini masih kosong, jalankan script download:

**Windows:**
```powershell
cd ..
powershell -ExecutionPolicy Bypass -File download-assets.ps1
```

**Linux / Git Bash:**
```bash
cd ..
bash download-assets.sh
```

## Versi Library

- **Leaflet:** 1.9.4
- **jQuery:** 3.7.1

## Kenapa Menggunakan File Lokal?

1. ✅ **Tidak bergantung pada internet** - Aplikasi bisa berjalan offline
2. ✅ **Lebih cepat** - Tidak perlu download dari CDN setiap kali
3. ✅ **Lebih aman** - Tidak ada risiko CDN down atau diblokir
4. ✅ **Lebih rapi** - Semua file dalam satu folder project
5. ✅ **Kontrol versi** - Versi library tetap konsisten

## Update Library

Untuk update ke versi terbaru:

1. Hapus file lama di folder ini
2. Edit URL di script `download-assets.ps1` atau `download-assets.sh`
3. Jalankan ulang script download
