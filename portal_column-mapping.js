/* Schema-driven mapping review. All recognition and final checks live on the server. */
window.ColumnMapping = (() => {
  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));

  function modal(markup) {
    const dialog = document.createElement('dialog');
    dialog.className = 'mapping-dialog';
    dialog.setAttribute('aria-labelledby', 'mapping-title');
    dialog.innerHTML = markup;
    document.body.append(dialog);
    dialog.showModal();
    return dialog;
  }

  function review(file, kind, preview, submit, options = {}) {
    return new Promise((resolve) => {
      const fields = new Map(preview.fields.map((f) => [f.canonical, f]));
      let current = preview;
      let choices;
      let busy = false;
      let done = false;
      let dateFormat = 'auto';
      const resetChoices = () => {
        choices = current.columns.map((c) => ({
          source_index: c.source_index, target: c.proposed_target,
          source_unit: c.source_unit, reviewed: c.status === 'automatic' || !c.proposed_target, manual: false,
        }));
      };
      resetChoices();
      const dataset = preview.dataset_context;
      const datasetInfo = dataset?.start && dataset?.end ? `<details class="mapping-dataset" open><summary>${escape(dataset.source || 'Published VFM inputs')}: ${escape(dataset.start)} → ${escape(dataset.end)}</summary><p>Use one prediction per well per ${dataset.cadence === 'daily' ? 'day' : 'hour'}. Well IDs: ${escape((dataset.well_ids || []).join(', '))}. The matching dataset is selected by the well IDs.</p></details>` : '';
      const dialog = modal(`
        <header class="mapping-heading"><div><span class="eyebrow">UPLOAD · COLUMN REVIEW</span>
          <h2 id="mapping-title">${escape(options.title || 'Match your columns')}</h2>
          <p>${escape(file.name)} · ${preview.row_count.toLocaleString()} rows · ${preview.columns.length} columns</p></div>
          <button type="button" class="action" data-close aria-label="Cancel column mapping">✕</button></header>
        <p class="mapping-intro">Review the detected features and source units. Strong matches are accepted automatically. Confirm suggestions or choose a different feature. Unused columns stay in the original file.</p>
        ${datasetInfo}
        <label class="mapping-date-format">Date format in this file
          <select name="date_format" aria-label="Date format in this file">
            <option value="auto">Auto · detect date order from this file</option>
            <option value="day_first">Day/month/year · DD/MM/YYYY</option>
            <option value="month_first">Month/day/year · MM/DD/YYYY</option>
            <option value="excel_1900">Excel serial date · 1900 system</option>
            <option value="excel_1904">Excel serial date · 1904 system</option>
            <option value="unix_seconds">Unix timestamp · seconds</option>
            <option value="unix_milliseconds">Unix timestamp · milliseconds</option>
          </select>
          <small class="mapping-date-guidance"></small>
        </label>
        <div class="mapping-summary" role="status" aria-live="polite"></div>
        <div class="mapping-table-wrap"><table class="mapping-table"><thead><tr>
          <th scope="col">Your column / sample values</th><th scope="col">Expected feature</th>
          <th scope="col">Source units</th><th scope="col">Confidence / review</th>
        </tr></thead><tbody></tbody></table></div>
        <p class="mapping-footnote">Confidence is a rule-based match score, not a probability. Unitless rate aliases use the phase's expected units unless you select another source unit. Volume rates must use matching reference conditions.</p>
        <div class="mapping-error" role="alert" hidden></div>
        <footer class="mapping-footer"><div><label class="mapping-remember"><input type="checkbox" name="remember"> Remember these mappings for my team</label>
          <button type="button" class="mapping-forget" ${preview.saved_mapping_count ? '' : 'hidden'}>Forget saved mappings for this phase</button></div>
          <div class="mapping-actions"><button type="button" class="action" data-close>Cancel</button>
          <button type="button" class="primary mapping-submit">${escape(options.submitLabel || 'Confirm and submit')}</button></div></footer>`);
      if (options.comparison) {
        dialog.querySelector('.mapping-remember').hidden = true;
        dialog.querySelector('.mapping-forget').hidden = true;
        dialog.querySelector('.mapping-intro').textContent = 'Map the reference columns to the result features. Alignment keys and at least one comparable feature are required. Other result features may be omitted. This comparison does not affect official scores.';
      }
      const body = dialog.querySelector('tbody');
      const errorBox = dialog.querySelector('.mapping-error');
      const submitButton = dialog.querySelector('.mapping-submit');
      const finish = (result) => {
        if (done) return;
        done = true;
        dialog.close();
        dialog.remove();
        resolve(result);
      };
      const showError = (error) => {
        errorBox.hidden = false;
        const validation = error.details?.validation;
        if (!validation) {
          errorBox.textContent = error.message || String(error);
          return;
        }
        const source = validation.dataset;
        const context = source?.start && source?.end
          ? `<p><b>Published input period:</b> ${escape(source.start)} → ${escape(source.end)}<br><b>Published well IDs:</b> ${escape((source.well_ids || []).join(', '))}</p>` : '';
        const examples = (validation.examples || []).map((row) => `<li><b>Data row ${escape(row.row)}:</b> well <code>${escape(row.well_name || '(missing)')}</code>, timestamp <code>${escape(row.timestamp || '(missing)')}</code><br>${escape((row.issues || []).join(' '))}</li>`).join('');
        errorBox.innerHTML = `<p><b>${escape(error.message)}</b></p>${context}
          <ul class="mapping-alignment-examples">${examples}</ul><p>${escape(validation.guidance || '')}</p>
          <button type="button" class="action" data-replace-file>Choose another CSV</button>`;
      };
      errorBox.addEventListener('click', (event) => {
        if (busy || !event.target.closest('[data-replace-file]')) return;
        finish(null);
        document.getElementById(`file-${kind}`)?.click();
      });
      function problems() {
        const counts = new Map();
        choices.forEach((c) => { if (c.target) counts.set(c.target, (counts.get(c.target) || 0) + 1); });
        const missing = preview.fields.filter((f) => f.required !== false && !counts.has(f.canonical));
        if (options.comparison && !choices.some((c) => c.target && !preview.join_keys.includes(c.target))) missing.push({label:'At least one comparable result feature'});
        if (preview.one_of && !preview.one_of.some(key => counts.has(key))) missing.push({label:'Test ID or shut-in start time'});
        const duplicate = [...counts].filter(([, n]) => n > 1).map(([key]) => key);
        const pending = choices.filter((c) => c.target && !c.reviewed);
        const invalid = choices.filter((c) => {
          if (!c.target) return false;
          const field = fields.get(c.target);
          const column = current.columns[c.source_index];
          return column.blocked_targets[c.target]
            || (field.units.length && !field.units.some((u) => u.id === c.source_unit))
            || (field.type === 'number' && column.profile.nonempty && column.profile.numeric_fraction === 0)
            || (field.type === 'datetime' && column.profile.nonempty && (column.profile.datetime_fractions?.[dateFormat] ?? column.profile.datetime_fraction) === 0);
        });
        return { missing, duplicate, pending, invalid };
      }
      dialog.querySelector('[name="date_format"]').addEventListener('change', event => {
        if (busy) return;
        dateFormat = event.target.value;
        errorBox.hidden = true;
        paint();
      });
      function paint() {
        const focus = document.activeElement?.dataset;
        const restore = focus?.index !== undefined && focus?.control
          ? `[data-index="${focus.index}"][data-control="${focus.control}"]` : null;
        const issues = problems();
        const formats = {day_first:'Day/month/year (DD/MM/YYYY)',month_first:'Month/day/year (MM/DD/YYYY)',excel_1900:'Excel serial date (1900 system)',excel_1904:'Excel serial date (1904 system)',unix_seconds:'Unix timestamp (seconds)',unix_milliseconds:'Unix timestamp (milliseconds)'};
        const detections = choices.filter(choice => fields.get(choice.target)?.type === 'datetime')
          .map(choice => ({column:current.columns[choice.source_index],detection:current.columns[choice.source_index].profile.date_detection}));
        const guidance = dialog.querySelector('.mapping-date-guidance');
        guidance.textContent = dateFormat !== 'auto'
          ? `Using ${formats[dateFormat]} consistently. ISO dates and English month names are also accepted.`
          : detections.some(({detection}) => detection?.status === 'conflicting')
            ? 'Mixed date orders detected. Use one consistent date order in each date column.'
            : detections.some(({detection}) => detection?.status === 'ambiguous')
              ? 'These dates do not establish day/month order. Select Day/month/year or Month/day/year above.'
              : detections.some(({detection}) => detection?.format)
                ? detections.filter(({detection}) => detection?.format).map(({column,detection}) => `Detected ${formats[detection.format]} for ${column.original_name} from ${detection.examples[detection.format]}.`).join(' ')
                : 'Auto accepts ISO, slash/dash/dot dates, YYYYMMDD and English month names, with optional times. For numeric serial dates or Unix timestamps, choose their format above.';
        const ignored = choices.filter((c) => !c.target).length;
        dialog.querySelector('.mapping-summary').innerHTML = [
          issues.missing.length ? `<span class="mapping-problem">Missing: ${issues.missing.map((f) => escape(f.label)).join(', ')}</span>` : '<span class="mapping-good">All required features selected</span>',
          issues.duplicate.length ? `<span class="mapping-problem">Duplicate: ${issues.duplicate.map(escape).join(', ')}</span>` : '',
          issues.pending.length ? `<span class="mapping-review">${issues.pending.length} mapping(s) need confirmation</span>` : '',
          issues.invalid.length ? `<span class="mapping-problem">Check units or data types in ${issues.invalid.length} column(s)</span>` : '',
          ignored ? `<span>${ignored} unused / unrecognized column(s) will be ignored</span>` : '',
        ].join('');
        body.innerHTML = choices.map((choice) => {
          const column = current.columns[choice.source_index];
          const field = fields.get(choice.target);
          const duplicate = issues.duplicate.includes(choice.target);
          const invalid = issues.invalid.includes(choice);
          const pending = choice.target && !choice.reviewed;
          const state = duplicate || invalid ? 'problem' : pending ? 'review' : !choice.target ? 'ignored' : 'accepted';
          const options = ['<option value="">Ignore this column</option>', ...preview.fields.map((f) => {
            const blocked = column.blocked_targets[f.canonical];
            return `<option value="${escape(f.canonical)}" ${choice.target === f.canonical ? 'selected' : ''} ${blocked ? 'disabled' : ''}>${escape(f.label)}${blocked ? ' (different quantity)' : ''}</option>`;
          })].join('');
          const units = field?.units.length ? `<select aria-label="Source unit for column ${choice.source_index + 1}" data-index="${choice.source_index}" data-control="unit">
            <option value="">Choose source unit</option>${field.units.map((u) => `<option value="${escape(u.id)}" ${u.id === choice.source_unit ? 'selected' : ''}>${escape(u.label)}</option>`).join('')}</select>
            <small>Processed as ${escape(field.unit)}</small>` : `<span>${field ? 'No measurement unit' : '—'}</span>`;
          let label = !choice.target ? 'Unrecognized / ignored' : duplicate ? 'Duplicate mapping' : invalid ? 'Check units / data' : pending ? 'Needs confirmation' : choice.manual ? 'Selected by you' : column.method === 'saved' ? 'Saved mapping' : 'Auto accepted';
          if (!choice.target && column.proposed_target) label = 'Ignored by you';
          const confidence = choice.target && !choice.manual ? `${Math.round(column.confidence * 100)}% · ` : '';
          const warnings = column.warnings.map(escape).join(' ');
          return `<tr class="mapping-row mapping-${state}">
            <th scope="row"><b>${escape(column.original_name || '(blank header)')}</b><small>Column ${choice.source_index + 1} · ${escape(column.profile.samples.join(' · ').slice(0, 150) || 'No non-empty sample')}</small></th>
            <td data-label="Expected feature"><select aria-label="Feature for column ${choice.source_index + 1}" data-index="${choice.source_index}" data-control="target" aria-invalid="${duplicate || invalid}">${options}</select>
              <small>${escape(choice.manual ? 'Selected by you' : column.reason)} ${escape(column.blocked_targets[choice.target] || '')}</small></td>
            <td data-label="Source units">${units}${warnings ? `<small class="mapping-warning">${warnings}</small>` : ''}</td>
            <td data-label="Confidence / review"><span class="mapping-badge">${confidence}${label}</span>${choice.target ? `<label class="mapping-review-check"><input type="checkbox" data-index="${choice.source_index}" data-control="reviewed" ${choice.reviewed ? 'checked' : ''}> ${pending ? 'Confirm proposal' : 'Confirmed'}</label>` : ''}</td>
          </tr>`;
        }).join('');
        submitButton.disabled = busy || issues.missing.length > 0 || issues.duplicate.length > 0 || issues.pending.length > 0 || issues.invalid.length > 0;
        if (restore) body.querySelector(restore)?.focus();
        window.enhanceTables?.(dialog);
      }
      body.addEventListener('change', (event) => {
        const { index, control } = event.target.dataset;
        if (index === undefined || busy) return;
        const choice = choices[Number(index)];
        if (control === 'target') {
          choice.target = event.target.value || null;
          const field = fields.get(choice.target);
          const detected = current.columns[Number(index)].detected_unit;
          choice.source_unit = field?.units.some((u) => u.id === detected) ? detected : field?.unit || null;
          choice.reviewed = true;
          choice.manual = true;
        } else if (control === 'unit') {
          choice.source_unit = event.target.value || null;
          choice.reviewed = true;
          choice.manual = true;
        } else if (control === 'reviewed') {
          choice.reviewed = event.target.checked;
        }
        errorBox.hidden = true;
        paint();
      });
      dialog.querySelectorAll('[data-close]').forEach((button) => button.addEventListener('click', () => {
        if (!busy) finish(null);
      }));
      dialog.addEventListener('cancel', (event) => { if (busy) event.preventDefault(); });
      dialog.addEventListener('close', () => { if (!done) finish(null); });
      dialog.querySelector('.mapping-forget').addEventListener('click', async (event) => {
        if (busy) return;
        busy = true;
        event.target.disabled = true;
        paint();
        try {
          await api('./api/column-mappings/reset', { method: 'POST', body: { kind } });
          current = await api('./api/upload/preview', { method: 'POST', body: file, headers: { 'X-Upload-Kind': kind } });
          resetChoices();
          event.target.hidden = true;
        } catch (error) { showError(error); }
        finally { busy = false; event.target.disabled = false; paint(); }
      });
      submitButton.addEventListener('click', async () => {
        const issues = problems();
        if (busy || issues.missing.length || issues.duplicate.length || issues.pending.length || issues.invalid.length) return;
        busy = true;
        dialog.querySelectorAll('button,input,select').forEach((element) => { element.disabled = true; });
        submitButton.textContent = 'Submitting…';
        errorBox.hidden = true;
        try {
          const result = await submit({
            digest: current.digest, confirmed: true, date_format: dateFormat,
            remember: dialog.querySelector('[name="remember"]').checked,
            columns: choices.map(({ source_index, target, source_unit }) => ({ source_index, target, source_unit: target ? source_unit : null })),
          });
          finish(result);
        } catch (error) {
          showError(error);
          busy = false;
          dialog.querySelectorAll('button,input,select').forEach((element) => { element.disabled = false; });
          submitButton.textContent = options.submitLabel || 'Confirm and submit';
          paint();
        }
      });
      paint();
    });
  }

  async function audit(uploadId) {
    try {
      const result = await api(`./api/upload/mapping/${uploadId}`);
      const trace = result.mapping;
      const rows = trace ? trace.columns.map((c) => `<tr><td>${c.source_index + 1}. ${escape(c.original_name)}</td><td>${escape(c.target || 'Ignored')}</td>
        <td>${escape(c.source_unit || '—')} → ${escape(c.target_unit || '—')}</td><td>${escape(c.method)} · ${escape(c.status)}${c.confidence ? ` · ${Math.round(c.confidence * 100)}%` : ''}</td></tr>`).join('') : '';
      const dialog = modal(`<header class="mapping-heading"><div><span class="eyebrow">UPLOAD TRACEABILITY</span><h2 id="mapping-title">Column mapping</h2><p>${escape(result.filename)}</p></div><button type="button" class="action" data-close>Close</button></header>
        ${trace ? `<div class="mapping-table-wrap"><table><thead><tr><th>Original column</th><th>Processed feature</th><th>Units</th><th>Recognition / confirmation</th></tr></thead><tbody>${rows}</tbody></table></div><p class="mapping-footnote">Date format: ${escape(({auto:'Auto / detected from file',day_first:'Day/month/year',month_first:'Month/day/year',excel_1900:'Excel serial date (1900 system)',excel_1904:'Excel serial date (1904 system)',unix_seconds:'Unix timestamp (seconds)',unix_milliseconds:'Unix timestamp (milliseconds)'})[trace.date_format || 'auto'] || trace.date_format)}. ${Object.entries(trace.detected_date_formats || {}).map(([field,format]) => `${escape(field)}: ${escape(({day_first:'Day/month/year',month_first:'Month/day/year'})[format] || format)}.`).join(' ')} Original file preserved unchanged. Rule dictionary version ${escape(trace.config_version)}. File SHA-256: <code>${escape(trace.digest)}</code></p>` : '<p>This file predates column-mapping records. Its original upload is unchanged.</p>'}`);
      dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
      dialog.addEventListener('close', () => { dialog.remove(); window.flushLiveRender?.(); });
    } catch (error) { alertUser(error.message); }
  }
  return { review, audit };
})();
