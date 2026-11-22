window.ResultComparison = (() => {
  const safe = (s) => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number = (n) => n == null || !Number.isFinite(n) ? 'N/A' : Number(n).toLocaleString(undefined,{maximumFractionDigits:4});
  async function open(uploadId) {
    let dialog;
    try {
      const info=await api(`./api/comparison/info/${uploadId}`);
      dialog=document.createElement('dialog');
      dialog.className='mapping-dialog comparison-dialog';
      dialog.setAttribute('aria-labelledby','comparison-title');
      dialog.innerHTML=`<header class="mapping-heading"><div><span class="eyebrow">REFERENCE COMPARISON</span><h2 id="comparison-title">How closely do your results match?</h2><p>Processed result: ${safe(info.filename)} · ${info.rows} records</p></div><button type="button" class="action" data-close>Close</button></header>
        <p class="mapping-intro">Choose your reference CSV, review its column mappings, then compare. Reference files stay separate from official judging and are not retained on the server.</p>
        <input type="file" accept=".csv,text/csv" aria-label="Reference result CSV" hidden>
        <button type="button" class="action" data-choose>Upload reference CSV</button>
        <p class="comparison-feedback" role="status" aria-live="polite"></p><div class="comparison-output"></div>`;
      document.body.append(dialog);dialog.showModal();
      let busy=false, currentFile=null,currentMapping=null;
      const choose=dialog.querySelector('[data-choose]'), input=dialog.querySelector('input');
      const feedback=dialog.querySelector('.comparison-feedback');
      dialog.querySelector('[data-close]').onclick=()=>{if(!busy)dialog.close();};
      dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
      dialog.addEventListener('close',()=>{dialog.remove();window.flushLiveRender?.();});
      choose.onclick=()=>input.click();
      function draw(report) {
        const output=dialog.querySelector('.comparison-output');
        const fields=Object.keys(report.metrics);
        const rows=fields.map(field=>{
          const m=report.metrics[field];
          return `<tr><th scope="row">${safe(field)}<small>${safe(m.unit||'')}</small></th><td>${m.compared}</td><td>${m.missing_or_invalid}</td><td>${number(m.mae)}</td><td>${number(m.rmse)}</td><td>${number(m.bias)}</td><td>${number(m.wape_pct)}</td><td>${number(m.mape_pct)}</td><td>${number(m.r2)}</td><td>${number(m.accuracy_pct)}</td></tr>`;
        }).join('');
        output.innerHTML=`<div class="comparison-counts"><span><b>${report.matched_rows}</b> matched records</span><span><b>${report.result_only}</b> result-only</span><span><b>${report.reference_only}</b> reference-only</span><span><b>${number(report.reference_coverage_pct)}%</b> reference records aligned</span></div>
          <p>${safe(report.notice)}</p><p>Aligned by <b>${safe(report.join_keys.join(' + '))}</b> (${safe(report.cadence)}). Numeric errors use only finite paired values. Lower MAE, RMSE, MAPE and WAPE mean smaller error. R² can be negative; it is undefined for constant references. Accuracy applies to categorical fields.</p>
          ${!report.matched_rows?'<p class="mapping-error">No records align. Check the dataset, well IDs, dates and cadence. Metrics are N/A because no reference values were paired.</p>':''}
          <div class="mapping-table-wrap"><table class="comparison-metrics"><thead><tr><th>Feature / unit</th><th>Compared</th><th>Invalid / missing pairs</th><th>MAE</th><th>RMSE</th><th>Bias</th><th>WAPE %</th><th>MAPE %</th><th>R²</th><th>Accuracy %</th></tr></thead><tbody>${rows}</tbody></table></div>
          <p class="mapping-footnote">Zero reference values are excluded from MAPE, included in MAE/RMSE, and counted in each feature's details. N/A does not mean zero error. Unmatched records are excluded from metrics and listed separately.</p>
          <label class="comparison-field-label">Inspect feature<select class="comparison-field">${fields.map(f=>`<option value="${safe(f)}">${safe(f)}</option>`).join('')}</select></label>
          <div class="comparison-chart"></div><p class="comparison-feature-note"></p>
          <div class="mapping-table-wrap"><table><thead><tr><th>Alignment key</th><th>Result</th><th>Reference</th><th>Difference</th><th>Absolute error</th><th>Error %</th><th>Status</th></tr></thead><tbody class="comparison-differences"></tbody></table></div>
          <p class="mapping-footnote">Showing up to ${report.detail_limit_per_feature} matched rows per feature. The CSV export includes every compared row and all unmatched records.</p>
          <details><summary>Unmatched record examples</summary><pre class="comparison-unmatched"></pre></details>
          <button type="button" class="action" data-export>Download full comparison CSV</button>`;
        output.querySelector('.comparison-unmatched').textContent=JSON.stringify(report.unmatched_examples,null,2);
        const select=output.querySelector('.comparison-field');
        function inspect() {
          const field=select.value,m=report.metrics[field];
          output.querySelector('.comparison-feature-note').textContent=m.type==='numeric'
            ? `MAPE compared ${m.mape_compared||0} nonzero reference pairs; ${m.zero_reference_pairs||0} reference pairs were zero. Bias is result minus reference.`
            : `Categorical accuracy: ${m.correct||0} correct of ${m.compared} comparable labels. Case and separators are normalized.`;
          output.querySelector('.comparison-differences').innerHTML=report.details.filter(d=>d.feature===field).map(d=>`<tr><td>${safe(Object.values(d.keys).join(' / '))}</td><td>${safe(d.result)}</td><td>${safe(d.reference)}</td><td>${number(d.difference)}</td><td>${number(d.absolute_error)}</td><td>${number(d.percentage_error)}</td><td>${safe(d.status)}</td></tr>`).join('');
          const points=report.series[field]||[];
          const chart=output.querySelector('.comparison-chart');
          if(!points.length){chart.textContent='No numeric pairs to plot.';return;}
          const values=points.flatMap(p=>[p.result,p.reference]),lo=Math.min(...values),hi=Math.max(...values);
          const valueScale=Math.max(Math.abs(lo),Math.abs(hi),1);
          const low=lo/valueScale,high=hi/valueScale;
          const path=(key)=>points.map((p,i)=>`${points.length===1?400:40+720*i/(points.length-1)},${220-180*((p[key]/valueScale-low)/(high-low||1))}`).join(' ');
          chart.innerHTML=`<p><span class="comparison-result-key">● Result</span> <span class="comparison-reference-key">● Reference</span> · first ${points.length} numeric pairs · x-axis: aligned record order · y-range: ${number(lo)} to ${number(hi)}</p><svg role="img" aria-label="Selected feature: result and reference values across aligned records" viewBox="0 0 800 250"><path d="M40 20V220H770" fill="none" stroke="#73808b"/><polyline points="${path('reference')}" fill="none" stroke="#c8ff3d" stroke-width="3"/><polyline points="${path('result')}" fill="none" stroke="#52f2ff" stroke-width="2"/>${points.length===1?['reference','result'].map(key=>`<circle cx="400" cy="${220-180*((points[0][key]/valueScale-low)/(high-low||1))}" r="4" fill="${key==='result'?'#52f2ff':'#c8ff3d'}"/>`).join(''):''}</svg>`;
        }
        select.onchange=inspect;inspect();
        window.enhanceTables?.(dialog);
        output.querySelector('[data-export]').onclick=async(event)=>{
          const button=event.target;button.disabled=true;
          try {
            const response=await authenticatedFetch(`./api/comparison/run/${uploadId}?format=csv`,{method:'POST',credentials:'same-origin',body:currentFile,headers:{'X-CSRF-Token':me.csrf,'X-Column-Mapping':JSON.stringify(currentMapping)}});
            if(!response.ok){const error=await response.json();throw Error(error.error||'Export failed');}
            const blob=await response.blob(),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='reference-comparison.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
          }catch(e){feedback.textContent=e.message;}finally{button.disabled=false;}
        };
      }
      input.onchange=async()=>{
        const file=input.files?.[0];input.value='';if(!file||busy)return;
        if(!file.name.toLowerCase().endsWith('.csv')||file.size>32*1024*1024||!file.size){feedback.textContent='Choose a nonempty CSV up to 32 MB.';return;}
        busy=true;choose.disabled=true;feedback.textContent='Recognizing reference columns…';
        try {
          const preview=await api(`./api/comparison/preview/${uploadId}`,{method:'POST',body:file});
          const report=await ColumnMapping.review(file,info.kind,preview,async mapping=>{
            const result=await api(`./api/comparison/run/${uploadId}`,{method:'POST',body:file,headers:{'X-Column-Mapping':JSON.stringify(mapping)}});
            currentFile=file;currentMapping=mapping;return result;
          },{comparison:true,title:'Match reference columns',submitLabel:'Confirm and compare'});
          if(report){draw(report);feedback.textContent=`Compared with ${file.name}. Official scores were not changed.`;}else feedback.textContent='Reference selection cancelled. Choose a CSV to compare.';
        }catch(e){feedback.textContent=e.message;}finally{busy=false;choose.disabled=false;}
      };
    }catch(e){if(dialog)dialog.remove();alertUser(e.message);}
  }
  return {open};
})();
