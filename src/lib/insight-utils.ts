/**
 * Matrix V5 Insight Utils
 * Generates human-readable explanations (💡) for both Scanner and AI signals.
 */

export function buildInsight(signalType: string | null | undefined, indicators: any): string | undefined {
  if (!indicators) return undefined;

  // Normalize signal type (Handle both SCANNER_BUY/SELL and direct BUY/SELL)
  let isBuy = signalType === "BUY" || signalType === "SCANNER_BUY" || signalType === "VETOED_BUY";
  let isSell = signalType === "SELL" || signalType === "SCANNER_SELL" || signalType === "VETOED_SELL";
  const isWhale = signalType === "WHALE";
  
  const f4 = Number(indicators.f4Power) || 0;
  const loss = Number(indicators.f4PowerLoss) || 0;
  const aiScore = Number(indicators.aiScore) || 0;

  // If signal type is missing/none but we have high AI score or F4 data, infer the direction
  if (!isBuy && !isSell && !isWhale && (aiScore > 50 || Math.abs(f4) > 5)) {
    if (f4 > 7) isBuy = true; // Still trending up
    else if (f4 < -7) isSell = true; // Still trending down
    // Note: Close to zero or extreme ends should be handled by specific signals, not default inference
  }

  if (!isBuy && !isSell && !isWhale) return undefined;

  const whaleStatus = indicators.whaleStatus; // Usually "BULLISH" or "BEARISH"

  if (isWhale) {
    const direction = whaleStatus === "BULLISH" ? "YUKARI" : "AŞAĞI";
    const emoji = whaleStatus === "BULLISH" ? "📈" : "📉";
    const prefix = whaleStatus === "BULLISH" ? "🟢 AL: " : "🔴 SAT: ";
    return `${prefix}🐳 BALİNA HAREKETİ: Piyasa genelinden bağımsız, yüksek hacimli bir giriş/çıkış saptandı. Motor bu hareketi ${direction} ${emoji} yönlü bir fırsat olarak görüyor. F4 Gücü: %${Math.round(f4)}.`;
  }

  if (isBuy) {
    if (f4 < 0) {
      return `🟢 AL: DİP YAKALAMA (Reversal Buy): F4 yönü eksi/aşağı gözüküyor (${Math.round(f4)}%) ancak satıcılar yorulduğu için düşüş trendi %${Math.round(loss)} güç kaybetti. Motor dönüşü sezip YUKARI fırsatı görüyor. Otopilot onayı bekleniyor.`;
    } else {
      if (loss >= 85) {
        return `🟢 AL: YÜKSELİŞ DOYUMU: F4 pozitif bölgede (${Math.round(f4)}%) ancak yükseliş trendi %${Math.round(loss)} gibi çok yüksek bir güç kaybına ulaştı. Yeni alım (Long) riskli olabilir, düzeltme bekliyor.`;
      }
      return `🟢 AL: TREND TAKİBİ: F4 zaten güçlü pozitif bölgede (${Math.round(f4)}%). Motor, mevcut yükselişin YUKARI devamını öngörüyor. Otopilot onayı bekleniyor.`;
    }
  } else if (isSell) {
    if (f4 > 0) {
      return `🔴 SAT: ZİRVE DÜZELTMESİ (Reversal Sell): F4 artıda/yukarıda (${Math.round(f4)}%) ancak alıcılar tükendiği için yükseliş trendi %${Math.round(loss)} güç kaybetti. Motor düzeltme sezip AŞAĞI fırsat görüyor. Otopilot onayı bekleniyor.`;
    } else {
      if (loss >= 85) {
        return `🔴 SAT: DÜŞÜŞ DOYUMU: F4 negatif bölgede (${Math.round(f4)}%) ancak düşüş trendi %${Math.round(loss)} gibi çok yüksek bir güç kaybına ulaştı. Açığa satış (Short) için çok geç olabilir, tepki bekliyor.`;
      }
      return `🔴 SAT: DÜŞÜŞ TRENDİ: F4 halihazırda negatif bölgede (${Math.round(f4)}%). Motor düşüşün AŞAĞI devamını öngörüyor. Otopilot onayı bekleniyor.`;
    }
  }

  return undefined;
}
