export interface CopticFeast {
  date: Date
  name: string
  nameAr: string
  type: 'major' | 'minor' | 'fast'
}

/** Julian Easter → Gregorian by adding 13 days (21st-century correction) */
function julianEasterToGregorian(year: number): Date {
  const a = year % 4
  const b = year % 7
  const c = year % 19
  const d = (19 * c + 15) % 30
  const e = (2 * a + 4 * b - d + 34) % 7
  const month = Math.floor((d + e + 114) / 31) - 1 // 0-based month
  const day = ((d + e + 114) % 31) + 1
  const julian = new Date(year, month, day)
  julian.setDate(julian.getDate() + 13)
  return julian
}

export function getCopticFeasts(year: number): CopticFeast[] {
  const easter = julianEasterToGregorian(year)
  const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
  const d = (m: number, day: number) => new Date(year, m - 1, day)

  return [
    // ── Fixed feasts ─────────────────────────────────────────────────────────
    { date: d(1, 7),  name: 'Coptic Christmas',        nameAr: '🎄 عيد الميلاد المجيد',          type: 'major' },
    { date: d(1, 19), name: 'Epiphany (Ghitas)',        nameAr: '💧 عيد الغطاس',                  type: 'major' },
    { date: d(2, 22), name: 'Return from Egypt',        nameAr: '✈️ دخول المسيح أرض مصر',        type: 'minor' },
    { date: d(3, 25), name: 'Annunciation (Bibanou)',   nameAr: '🕊️ عيد البشارة',                type: 'major' },
    { date: d(5, 21), name: 'Feast of El-Adra (Zyaret El-Adra)', nameAr: '💒 زيارة العذراء لإليصابات', type: 'minor' },
    { date: d(6, 21), name: 'Feast of Martyrs',        nameAr: '🌹 عيد الشهداء',                 type: 'minor' },
    { date: d(8, 22), name: 'Assumption of El-Adra',   nameAr: '👑 عيد انتقال العذراء',          type: 'major' },
    { date: d(9, 11), name: 'Coptic New Year (Nayruz)', nameAr: '🌸 رأس السنة القبطية (نيروز)',  type: 'major' },
    { date: d(10, 3), name: 'Feast of the Cross',       nameAr: '✝️ عيد الصليب المقدس',          type: 'major' },
    { date: d(11, 4), name: 'Feast of St Michael',      nameAr: '⚔️ عيد الملاك ميخائيل',        type: 'minor' },
    { date: d(11, 25), name: 'Start of Advent (Kiahk)', nameAr: '⛪ بداية شهر كيهك (صوم الميلاد)', type: 'fast' },
    // ── Easter-dependent (moveable) feasts ────────────────────────────────────
    { date: addDays(easter, -55), name: 'Start of Great Lent', nameAr: '🤍 بداية الصوم الكبير',  type: 'fast' },
    { date: addDays(easter, -7),  name: 'Palm Sunday',         nameAr: '🌿 أحد الشعانين',         type: 'major' },
    { date: addDays(easter, -2),  name: 'Good Friday',         nameAr: '✝️ الجمعة العظيمة',       type: 'major' },
    { date: addDays(easter, -1),  name: 'Holy Saturday',       nameAr: '🕯️ سبت النور',            type: 'major' },
    { date: easter,               name: 'Coptic Easter',        nameAr: '🐣 عيد القيامة المجيد',  type: 'major' },
    { date: addDays(easter, 39),  name: 'Ascension',            nameAr: '☁️ عيد الصعود',          type: 'major' },
    { date: addDays(easter, 49),  name: 'Pentecost',            nameAr: '🔥 عيد العنصرة',         type: 'major' },
  ].filter(f => f.date.getFullYear() === year)
}

export function getFeastsForMonth(year: number, month: number): Record<number, CopticFeast[]> {
  const all = getCopticFeasts(year)
  const map: Record<number, CopticFeast[]> = {}
  for (const feast of all) {
    if (feast.date.getMonth() + 1 === month) {
      const day = feast.date.getDate()
      if (!map[day]) map[day] = []
      map[day].push(feast)
    }
  }
  return map
}
