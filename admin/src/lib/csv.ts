/** CSV compatible avec Excel ; les champs texte ne peuvent pas devenir des formules. */
export function csv(rows: (string | number | null)[][]) {
  return '\uFEFF' + rows.map(row=>row.map(value=>{
    let text = value === null ? '' : String(value);
    if(typeof value==='string' && /^[\s]*[=+@-]|^[\t\r\n]/.test(text)) text="'"+text;
    return '"'+text.replace(/"/g,'""')+'"';
  }).join(';')).join('\r\n');
}
