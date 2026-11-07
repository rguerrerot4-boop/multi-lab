/** Primera letra en mayúscula y el resto como viene: «viernes, 6 de noviembre» → «Viernes, 6 de noviembre».
 *  (textTransform: 'capitalize' pondría «De» y «Noviembre» en mayúscula, que no se usa en español). */
export const capFirst = (s: string) => (s ? s.charAt(0).toLocaleUpperCase('es') + s.slice(1) : s);
