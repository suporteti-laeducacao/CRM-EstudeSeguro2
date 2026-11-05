// Feriados nacionais brasileiros (fixos + móveis baseados na Páscoa)

// Algoritmo de Meeus/Jones/Butcher para calcular o domingo de Páscoa
const calcEasterSunday = (year: number): Date => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
};

const addDays = (d: Date, days: number): Date => {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
};

const toKey = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const holidaysCache = new Map<number, Set<string>>();

const getHolidaysForYear = (year: number): Set<string> => {
  const cached = holidaysCache.get(year);
  if (cached) return cached;

  const easter = calcEasterSunday(year);
  const set = new Set<string>([
    // Fixos
    `${year}-01-01`, // Confraternização Universal
    `${year}-04-21`, // Tiradentes
    `${year}-05-01`, // Dia do Trabalho
    `${year}-09-07`, // Independência
    `${year}-10-12`, // Nossa Senhora Aparecida
    `${year}-11-02`, // Finados
    `${year}-11-15`, // Proclamação da República
    `${year}-11-20`, // Consciência Negra
    `${year}-12-25`, // Natal
    // Móveis
    toKey(addDays(easter, -48)), // Carnaval (segunda)
    toKey(addDays(easter, -47)), // Carnaval (terça)
    toKey(addDays(easter, -2)),  // Sexta-feira Santa
    toKey(addDays(easter, 60)),  // Corpus Christi
  ]);

  holidaysCache.set(year, set);
  return set;
};

export const isBrazilianHoliday = (d: Date): boolean => {
  return getHolidaysForYear(d.getFullYear()).has(toKey(d));
};
