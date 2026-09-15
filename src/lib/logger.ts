import "server-only";

/**
 * Yapılandırılmamış console.error/console.log çağrıları arasında korelasyon
 * yoktu (yol haritası 5.7) — aynı isteğe ait birden fazla log satırı
 * birbirine bağlanamıyordu. Bu, tek bir isteğe ait tüm log satırlarını aynı
 * correlationId ile JSON olarak (grep/log toplama araçlarıyla ayrıştırılabilir
 * biçimde) yazan minimal bir logger. Kapsam bilinçli olarak public webhook
 * route'larıyla (en riskli, harici tetiklenen giriş noktaları) sınırlı —
 * uygulamanın geri kalanındaki console.log/error çağrılarına dokunulmadı.
 */

type LogLevel = "info" | "warn" | "error";
type LogMeta = Record<string, unknown>;

function write(level: LogLevel, correlationId: string, message: string, meta?: LogMeta) {
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    correlationId,
    message,
    ...meta,
  });

  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export type Logger = {
  correlationId: string;
  info: (message: string, meta?: LogMeta) => void;
  warn: (message: string, meta?: LogMeta) => void;
  error: (message: string, meta?: LogMeta) => void;
};

export function createLogger(correlationId: string): Logger {
  return {
    correlationId,
    info: (message, meta) => write("info", correlationId, message, meta),
    warn: (message, meta) => write("warn", correlationId, message, meta),
    error: (message, meta) => write("error", correlationId, message, meta),
  };
}

/**
 * Gelen isteğin kendi correlation id'si varsa (örn. bir proxy/yük dengeleyici
 * tarafından eklenmiş) onu korur — yoksa yeni bir tane üretir.
 */
export function correlationIdFromRequest(request: Request): string {
  return request.headers.get("x-correlation-id") ?? crypto.randomUUID();
}
