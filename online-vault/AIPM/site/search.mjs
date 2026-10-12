export function searchDocuments(documents, query, {category = '', localOnly = false} = {}) {
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return documents.filter(d => (!category || d.category === category) && (!localOnly || d.local)).map(doc => {
    const title = doc.title.toLocaleLowerCase();
    const aliases = (doc.aliases || []).join(' ').toLocaleLowerCase();
    const body = (doc.text || '').toLocaleLowerCase();
    const haystack = `${title} ${aliases} ${body}`;
    if (!terms.every(term => haystack.includes(term))) return null;
    const score = terms.reduce((sum,term)=>sum+(title.includes(term)?12:0)+(aliases.includes(term)?5:0)+(body.includes(term)?1:0),0);
    const index = Math.max(0,body.indexOf(terms[0]));
    const start = Math.max(0,index-45);
    const snippet = (start ? '…' : '') + (doc.text || '').slice(start,start+160).replace(/\s+/g,' ');
    return {doc,score,snippet};
  }).filter(Boolean).sort((a,b)=>b.score-a.score || a.doc.order-b.doc.order);
}
