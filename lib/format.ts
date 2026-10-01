// ตัด tag เชื่อมโยงภายใน เช่น [T1788228843658] (โอนเงิน) หรือ [B4:2026-09] (ชำระบิล) ออกจาก Note ก่อนแสดงผล
export function cleanNote(note: string): string {
  return note.replace(/\s*\[[A-Z][^[\]]*\]\s*/g, ' ').replace(/\s{2,}/g, ' ').trim()
}
