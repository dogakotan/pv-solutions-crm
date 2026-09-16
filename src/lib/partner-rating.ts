/**
 * set_partner_rating admin'in serbestçe girdiği bir 0-5 sayısı; acceptance_rate/
 * avg_response_hours/sales_count gibi hesaplanan metriklerle hiçbir matematiksel
 * bağı yok (3.6). Bu fonksiyon o metriklerden salt-görüntüleme amaçlı bir "hesaplanan
 * puan" türetir — set_partner_rating'i veya rating alanını hiçbir şekilde değiştirmez,
 * sadece manuel puanın yanında karşılaştırma referansı olarak gösterilir.
 */
export function computeSuggestedPartnerRating(input: {
  acceptanceRate: number;
  avgResponseHours: number | null;
  salesCount: number;
  referralCount: number;
}): number | null {
  if (input.referralCount === 0) return null;

  const acceptanceScore = (input.acceptanceRate / 100) * 5;
  const conversionScore = Math.min(input.salesCount / input.referralCount, 1) * 5;
  const responseScore =
    input.avgResponseHours == null ? 2.5 : Math.max(0, 5 - (input.avgResponseHours / 48) * 5);

  const weighted = acceptanceScore * 0.5 + conversionScore * 0.3 + responseScore * 0.2;
  return Math.round(weighted * 10) / 10;
}
