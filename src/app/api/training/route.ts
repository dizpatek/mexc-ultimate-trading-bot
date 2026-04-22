/**
 * API Route: /api/training
 * GET  → Eğitim durumu, son loglar, GPU metrikleri
 * POST → start_training | stop_training | generate_dataset | set_power_limit | start_monitor
 */

import { NextRequest, NextResponse } from "next/server";
import { spawn, exec } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export const dynamic = "force-dynamic";

// ─── Sabitler ────────────────────────────────────────────────────────────────

const AUTORESEARCH_DIR = path.join("C:", "Users", "SNTRK", "Desktop", "AutoResearch");
const MEXCBRAIN_DIR    = path.join("C:", "Users", "SNTRK", "Desktop", "MexCBrain");
const HW_LOG_FILE      = path.join(AUTORESEARCH_DIR, "hardware_log.txt");
const TRAIN_LOG_FILE   = path.join(AUTORESEARCH_DIR, "training_live.log");
const STATUS_FILE      = path.join(os.tmpdir(), "mexcbrain_training_status.json");

// ─── State ───────────────────────────────────────────────────────────────────

interface TrainingStatus {
  isTraining: boolean;
  isGenerating: boolean;
  trainPid: number | null;
  generatePid: number | null;
  startedAt: number | null;
  powerLimit: number;
  lastTopic: string;
}

function readStatus(): TrainingStatus {
  try {
    if (fs.existsSync(STATUS_FILE)) {
      return JSON.parse(fs.readFileSync(STATUS_FILE, "utf-8"));
    }
  } catch {}
  return {
    isTraining: false,
    isGenerating: false,
    trainPid: null,
    generatePid: null,
    startedAt: null,
    powerLimit: 250,
    lastTopic: "—",
  };
}

function writeStatus(status: Partial<TrainingStatus>) {
  const current = readStatus();
  fs.writeFileSync(STATUS_FILE, JSON.stringify({ ...current, ...status }, null, 2));
}

function isProcessRunning(pid: number | null): boolean {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function tailLog(filePath: string, lines = 80): string[] {
  if (!fs.existsSync(filePath)) return [];
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return content.split("\n").filter(Boolean).slice(-lines);
  } catch {
    return [];
  }
}

async function getGpuMetrics(): Promise<{ power: string; temp: string; vram: string; util: string }> {
  return new Promise((resolve) => {
    // nvidia-smi'den anlık sorgu — monitör başlatmaya gerek yok
    exec(
      "nvidia-smi --query-gpu=power.draw,temperature.gpu,memory.used,memory.total,utilization.gpu --format=csv,noheader,nounits",
      { timeout: 3000 },
      (err, stdout) => {
        if (err || !stdout.trim()) {
          // nvidia-smi yoksa hardware_log.txt'e fallback
          const hwLogs = tailLog(HW_LOG_FILE, 1);
          if (hwLogs.length > 0) {
            const line = hwLogs[0];
            const powerMatch = line.match(/(\d+)W \/ (\d+)W/);
            const tempMatch  = line.match(/(\d+\.\d+)°C/);
            const vramMatch  = line.match(/VRAM: ([\d.]+)\/([\d.]+) GB/);
            const loadMatch  = line.match(/Load: (\d+)%/);
            resolve({
              power: powerMatch ? `${powerMatch[1]}W` : "N/A",
              temp:  tempMatch  ? `${tempMatch[1]}°C` : "N/A",
              vram:  vramMatch  ? `${vramMatch[1]}/${vramMatch[2]} GB` : "N/A",
              util:  loadMatch  ? `${loadMatch[1]}%` : "N/A",
            });
          } else {
            resolve({ power: "N/A", temp: "N/A", vram: "N/A", util: "N/A" });
          }
          return;
        }

        // CSV: power.draw, temperature.gpu, memory.used, memory.total, utilization.gpu
        const parts = stdout.trim().split(",").map(s => s.trim());
        const powerW = parseFloat(parts[0]);
        const tempC  = parseInt(parts[1]);
        const vramUsed  = Math.round(parseInt(parts[2]) / 1024 * 10) / 10; // MB → GB
        const vramTotal = Math.round(parseInt(parts[3]) / 1024 * 10) / 10;
        const gpuUtil   = parseInt(parts[4]);

        resolve({
          power: isNaN(powerW) ? "N/A" : `${powerW.toFixed(0)}W`,
          temp:  isNaN(tempC)  ? "N/A" : `${tempC}°C`,
          vram:  isNaN(vramUsed) ? "N/A" : `${vramUsed}/${vramTotal} GB`,
          util:  isNaN(gpuUtil)  ? "N/A" : `${gpuUtil}%`,
        });
      }
    );
  });
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET() {
  const status = readStatus();

  // Proses hala çalışıyor mu kontrol et
  if (status.isTraining && !isProcessRunning(status.trainPid)) {
    writeStatus({ isTraining: false, trainPid: null });
    status.isTraining = false;
  }
  if (status.isGenerating && !isProcessRunning(status.generatePid)) {
    writeStatus({ isGenerating: false, generatePid: null });
    status.isGenerating = false;
  }

  const [trainLogs, hwMetrics] = await Promise.all([
    Promise.resolve(tailLog(TRAIN_LOG_FILE, 60)),
    getGpuMetrics(),
  ]);

  const datasetSize = (() => {
    const p = path.join(AUTORESEARCH_DIR, "instruction_dataset.md");
    if (!fs.existsSync(p)) return 0;
    return Math.round(fs.statSync(p).size / 1024);
  })();

  const elapsed = status.startedAt
    ? Math.round((Date.now() - status.startedAt) / 1000)
    : 0;

  return NextResponse.json({
    ok: true,
    status: {
      ...status,
      elapsed,
      datasetSizeKB: datasetSize,
    },
    logs: trainLogs,
    gpu: hwMetrics,
  });
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const body = await req.json() as {
    action: string;
    powerLimit?: number;
    topics?: string[];
    epochs?: number;
    batchSize?: number;
  };

  const { action } = body;

  // ─── Start Training ──────────────────────────────────────────────────────
  if (action === "start_training") {
    const status = readStatus();
    if (status.isTraining) {
      return NextResponse.json({ ok: false, error: "Eğitim zaten çalışıyor." });
    }

    // Log dosyasını temizle
    fs.writeFileSync(TRAIN_LOG_FILE, `[${new Date().toLocaleString("tr-TR")}] 🚀 MexCBrain Model Eğitimi Başlatılıyor...\n`);

    const child = spawn("uv", ["run", "train.py"], {
      cwd: AUTORESEARCH_DIR,
      detached: true,
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        USE_LOCAL_ONLY: "1",
        FORCE_CUDA: "1",
      },
    });

    child.stdout?.on("data", (d: Buffer) => {
      fs.appendFileSync(TRAIN_LOG_FILE, d.toString());
    });
    child.stderr?.on("data", (d: Buffer) => {
      fs.appendFileSync(TRAIN_LOG_FILE, `[STDERR] ${d.toString()}`);
    });
    child.on("exit", (code: number | null) => {
      fs.appendFileSync(TRAIN_LOG_FILE, `\n[${new Date().toLocaleString("tr-TR")}] ✅ Eğitim tamamlandı (exit code: ${code})\n`);
      writeStatus({ isTraining: false, trainPid: null });
    });

    child.unref();
    writeStatus({ isTraining: true, trainPid: child.pid ?? null, startedAt: Date.now() });

    return NextResponse.json({ ok: true, message: "✅ Model eğitimi başlatıldı.", pid: child.pid });
  }

  // ─── Stop Training ───────────────────────────────────────────────────────
  if (action === "stop_training") {
    const status = readStatus();
    if (status.trainPid) {
      try {
        if (os.platform() === "win32") {
          exec(`taskkill /PID ${status.trainPid} /T /F`);
        } else {
          process.kill(-status.trainPid, "SIGTERM");
        }
        fs.appendFileSync(TRAIN_LOG_FILE, `\n[${new Date().toLocaleString("tr-TR")}] ⏹️ Eğitim kullanıcı tarafından durduruldu.\n`);
      } catch {}
    }
    writeStatus({ isTraining: false, trainPid: null });
    return NextResponse.json({ ok: true, message: "⏹️ Eğitim durduruldu." });
  }

  // ─── Generate Dataset via Groq ──────────────────────────────────────────
  if (action === "generate_dataset") {
    const status = readStatus();
    if (status.isGenerating) {
      return NextResponse.json({ ok: false, error: "Dataset üretimi zaten devam ediyor." });
    }

    const topics = body.topics ?? ["kripto_bot", "pine_script", "risk_yonetimi"];
    const topicStr = topics.join(",");

    const child = spawn(
      "npx",
      ["tsx", "--import", "dotenv/config", "_tools/system/dataset_generator_ai.ts"],
      {
        cwd: MEXCBRAIN_DIR,
        detached: true,
        shell: true,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, TRAINING_TOPICS: topicStr },
      }
    );

    child.stdout?.on("data", (d: Buffer) => {
      fs.appendFileSync(TRAIN_LOG_FILE, `[AI HUB] ${d.toString()}`);
    });
    child.stderr?.on("data", (d: Buffer) => {
      fs.appendFileSync(TRAIN_LOG_FILE, `[AI HUB ERR] ${d.toString()}`);
    });
    child.on("exit", () => {
      fs.appendFileSync(TRAIN_LOG_FILE, `\n✅ Dataset üretimi tamamlandı.\n`);
      writeStatus({ isGenerating: false, generatePid: null });
    });

    child.unref();
    writeStatus({
      isGenerating: true,
      generatePid: child.pid ?? null,
      lastTopic: topics[0],
    });

    return NextResponse.json({ ok: true, message: `🎲 Dataset üretimi başlatıldı. Konular: ${topicStr}` });
  }

  // ─── Stop Dataset Generation ─────────────────────────────────────────────
  if (action === "stop_generate") {
    const status = readStatus();
    if (status.generatePid) {
      try {
        if (os.platform() === "win32") {
          exec(`taskkill /PID ${status.generatePid} /T /F`);
        } else {
          process.kill(-status.generatePid, "SIGTERM");
        }
      } catch {}
    }
    writeStatus({ isGenerating: false, generatePid: null });
    return NextResponse.json({ ok: true, message: "Dataset üretimi durduruldu." });
  }

  // ─── GPU Power Limit ─────────────────────────────────────────────────────
  if (action === "set_power_limit") {
    const watts = Math.min(Math.max(body.powerLimit ?? 210, 50), 320);
    return new Promise<NextResponse>((resolve) => {
      exec(`nvidia-smi -pl ${watts}`, (err, stdout, stderr) => {
        if (err) {
          // GPU yoksa ya da yetki yoksa sessiz devam et
          resolve(NextResponse.json({
            ok: false,
            error: `GPU limit ayarlanamadı: ${stderr || err.message}`,
          }));
          return;
        }
        writeStatus({ powerLimit: watts });
        resolve(NextResponse.json({
          ok: true,
          message: `⚡ GPU güç limiti ${watts}W olarak ayarlandı.`,
        }));
      });
    });
  }

  // ─── Start Hardware Monitor ──────────────────────────────────────────────
  if (action === "start_monitor") {
    const child = spawn("python", ["hardware_monitor.py"], {
      cwd: AUTORESEARCH_DIR,
      detached: true,
      shell: true,
      stdio: "ignore",
    });
    child.unref();
    return NextResponse.json({ ok: true, message: "🖥️ Donanım izleme başlatıldı.", pid: child.pid });
  }

  return NextResponse.json({ ok: false, error: "Bilinmeyen aksiyon." }, { status: 400 });
}
