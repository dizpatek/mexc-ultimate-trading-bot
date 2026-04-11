# MexC AutoResearch Kurulum Scripti (Windows PowerShell)
# RTX 3080 (10GB VRAM) için optimize edilmiş
#
# Çalıştırma:
#   PowerShell -ExecutionPolicy Bypass -File scripts\setup-autoresearch.ps1

Write-Host "`n==================================================================" -ForegroundColor Cyan
Write-Host "  MexC + NanoGPT AutoResearch Kurulum Scripti" -ForegroundColor Cyan
Write-Host "  RTX 3080 (10GB VRAM) | Windows 10/11" -ForegroundColor Cyan
Write-Host "==================================================================`n" -ForegroundColor Cyan

$AutoResearchDir = "C:\Users\$env:USERNAME\Desktop\AutoResearch"

# ─── Adım 1: Python kontrolü ───────────────────────────────────────────────
Write-Host "[1/7] Python kontrol ediliyor..." -ForegroundColor Yellow
try {
    $pyVer = python --version 2>&1
    if ($pyVer -match "3\.(10|11|12)") {
        Write-Host "  ✅ $pyVer bulundu" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  Python 3.10+ gerekli. Bulundu: $pyVer" -ForegroundColor Red
        Write-Host "     https://www.python.org/downloads/ adresinden indirin" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "  ❌ Python bulunamadı! https://www.python.org/downloads/ adresinden indirin" -ForegroundColor Red
    exit 1
}

# ─── Adım 2: CUDA kontrolü ─────────────────────────────────────────────────
Write-Host "[2/7] NVIDIA CUDA kontrol ediliyor..." -ForegroundColor Yellow
try {
    $nvidiaSmi = nvidia-smi --query-gpu=name,memory.total --format=csv,noheader 2>&1
    Write-Host "  ✅ GPU: $nvidiaSmi" -ForegroundColor Green
} catch {
    Write-Host "  ⚠️  nvidia-smi bulunamadı. NVIDIA sürücüleriniz güncel mi?" -ForegroundColor Red
}

# ─── Adım 3: uv paket yöneticisi ───────────────────────────────────────────
Write-Host "[3/7] uv paket yöneticisi kuruluyor..." -ForegroundColor Yellow
try {
    $uvVersion = uv --version 2>&1
    Write-Host "  ✅ uv zaten kurulu: $uvVersion" -ForegroundColor Green
} catch {
    Write-Host "  📦 uv kuruluyor..." -ForegroundColor Cyan
    pip install uv --quiet
    Write-Host "  ✅ uv kuruldu" -ForegroundColor Green
}

# ─── Adım 4: nanochat-autoresearch klonla ──────────────────────────────────
Write-Host "[4/7] NanoGPT AutoResearch repo'su klonlanıyor..." -ForegroundColor Yellow
if (Test-Path $AutoResearchDir) {
    Write-Host "  ℹ️  Klasör zaten var: $AutoResearchDir — güncelleniyor..." -ForegroundColor Cyan
    Set-Location $AutoResearchDir
    git pull --quiet
} else {
    # Karpathy'nin nanochat-autoresearch repo'su
    # Not: Repo adı değişmişse aşağıdaki URL'yi güncelleyin
    $repoUrl = "https://github.com/karpathy/nanochat-autoresearch"
    Write-Host "  🌐 Klonlanıyor: $repoUrl" -ForegroundColor Cyan
    
    # Önce resmi repo'yu dene, yoksa fork'u al
    git clone $repoUrl $AutoResearchDir 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ⚠️  Resmi repo bulunamadı, nanoGPT kullanılıyor..." -ForegroundColor Yellow
        git clone "https://github.com/karpathy/nanoGPT" $AutoResearchDir
    }
    Set-Location $AutoResearchDir
}

Write-Host "  ✅ Repo hazır: $AutoResearchDir" -ForegroundColor Green

# ─── Adım 5: Bağımlılıkları kur ────────────────────────────────────────────
Write-Host "[5/7] Python bağımlılıkları kuruluyor (RTX 3080 / CUDA 12)..." -ForegroundColor Yellow
Set-Location $AutoResearchDir

# PyTorch CUDA 12.1 için RTX 3080
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu121 --quiet

# requirements.txt varsa kur
if (Test-Path "requirements.txt") {
    pip install -r requirements.txt --quiet
}
# pyproject.toml varsa uv sync dene
if (Test-Path "pyproject.toml") {
    uv sync 2>&1
}

Write-Host "  ✅ Bağımlılıklar kuruldu" -ForegroundColor Green

# ─── Adım 6: program.md RTX 3080 için özelleştir ───────────────────────────
Write-Host "[6/7] program.md RTX 3080 için özelleştiriliyor..." -ForegroundColor Yellow

$programMd = @"
# AutoResearch Program — RTX 3080 (10GB VRAM) Konfigürasyonu

## Platform Bilgisi
- GPU: NVIDIA RTX 3080 (10GB GDDR6X)
- OS: Windows 11
- CUDA: 12.1

## Hedef Metrik
val_bpb (validation bits per byte) — DÜŞÜK = DAHA İYİ

## RTX 3080 İçin Optimize Parametreler

```python
DEPTH = 6                    # 8 yerine (10GB VRAM için)
TOTAL_BATCH_SIZE = 2**17     # ~131K tokens per step
MAX_SEQ_LEN = 512            # 1024 yerine (VRAM tasarrufu)
WINDOW_PATTERN = 'L'         # Banded attention DEVRE DIŞI (Windows uyumluluğu)
DEVICE_BATCH_SIZE = 16       # RTX 3080 optimal micro-batch
```

## Windows Uyumluluk Notları
- torch.compile: TORCH_COMPILE=0 env var ile devre dışı (Windows'ta sorunlu)
- Flash Attention 3: Desteklenmiyor. FA2 veya vanilla attention kullan.
- bf16: RTX 3080 desteklemez. float16 kullan.

## Ajan Talimatları
1. train.py dosyasını DÜZENLEYEBİLİRSİN (model, optimizer, hiperparams)
2. prepare.py dosyasına DOKUNMA
3. Her deney 5 dakika sürer (sabit)
4. val_bpb düşerse → değişikliği KORUR
5. val_bpb artarsa → değişikliği ATAR
6. Deney logu experiments/ klasörüne kaydedilir

## Keşfedilecek Alanlar (Öneri)
- DEPTH: 4 vs 6 vs 8
- Learning rate schedules
- Muon optimizer ayarları (beta1, beta2)
- Attention window patterns
- Weight decay

## Başlangıç Komutu
```bash
uv run prepare.py  # İlk defa çalıştır
uv run train.py    # Test et
```
"@

$programMd | Out-File -FilePath "$AutoResearchDir\program.md" -Encoding UTF8
Write-Host "  ✅ program.md oluşturuldu (RTX 3080 optimizasyonlu)" -ForegroundColor Green

# ─── Adım 7: GPU testi ─────────────────────────────────────────────────────
Write-Host "[7/7] GPU testi yapılıyor..." -ForegroundColor Yellow

$gpuTest = @"
import torch
if torch.cuda.is_available():
    gpu = torch.cuda.get_device_name(0)
    mem = torch.cuda.get_device_properties(0).total_memory / 1024**3
    print(f"✅ GPU: {gpu} | VRAM: {mem:.1f}GB")
    x = torch.randn(1000, 1000, device='cuda')
    y = x @ x.T
    print(f"✅ CUDA matmul test başarılı: {y.shape}")
else:
    print("❌ CUDA kullanılamıyor!")
"@

python -c $gpuTest

Write-Host "`n==================================================================" -ForegroundColor Green
Write-Host "  ✅ KURULUM TAMAMLANDI!" -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Green
Write-Host "`n📁 AutoResearch dizini: $AutoResearchDir" -ForegroundColor Cyan
Write-Host "`n🚀 Başlatmak için:" -ForegroundColor White
Write-Host "   cd $AutoResearchDir" -ForegroundColor Yellow
Write-Host "   uv run prepare.py   # Bir kez çalıştır (~2 dakika)" -ForegroundColor Yellow
Write-Host "   uv run train.py     # Test eğitimi (~5 dakika)" -ForegroundColor Yellow
Write-Host ""
Write-Host "🤖 Otonom mod için (gece çalıştır):" -ForegroundColor White
Write-Host "   Antigravity/Claude'a 'program.md' dosyasını göster ve 'başlayalım' de" -ForegroundColor Yellow
Write-Host ""
