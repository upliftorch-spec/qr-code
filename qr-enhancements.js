(function () {
  'use strict';

  const isZh = document.documentElement.lang === 'zh-TW';
  const copy = isZh ? {
    typeLabel: '快速類型',
    types: {
      url: '網址', wifi: 'Wi-Fi', vcard: '聯絡人名片', phone: '電話',
      sms: '簡訊', email: '電子郵件', geo: '地理位置', event: '行事曆活動', text: '純文字'
    },
    fields: {
      url: '網址', ssid: 'Wi-Fi 名稱', password: '密碼', security: '安全性', hidden: '隱藏網路',
      name: '姓名', organization: '公司／組織', phone: '電話號碼', email: '電子郵件',
      website: '網站', message: '訊息', subject: '主旨', body: '內文', latitude: '緯度',
      longitude: '經度', summary: '活動名稱', start: '開始時間', end: '結束時間',
      location: '地點', description: '活動說明', text: '文字內容'
    },
    yes: '是',
    no: '否',
    required: '請填寫必要欄位。',
    invalidValue: '請確認欄位格式是否正確。',
    invalidTime: '結束時間必須晚於開始時間。',
    csvImported: count => `已匯入 ${count} 筆資料，可直接產生 QR Code。`,
    csvLimited: 'CSV 超過 50 筆，只匯入前 50 筆。',
    csvInvalid: 'CSV 格式不正確，第一列必須是 name,content。',
    csvEmpty: 'CSV 沒有可匯入的內容。',
    csvReadError: 'CSV 讀取失敗，請確認檔案後再試一次。',
    csvNothingToDownload: '請先輸入或匯入批次資料，再下載 CSV。'
  } : {
    typeLabel: 'Quick type',
    types: {
      url: 'URL', wifi: 'Wi-Fi', vcard: 'Contact card', phone: 'Phone',
      sms: 'SMS', email: 'Email', geo: 'Location', event: 'Calendar event', text: 'Plain text'
    },
    fields: {
      url: 'URL', ssid: 'Wi-Fi name', password: 'Password', security: 'Security', hidden: 'Hidden network',
      name: 'Name', organization: 'Company / organization', phone: 'Phone number', email: 'Email',
      website: 'Website', message: 'Message', subject: 'Subject', body: 'Body', latitude: 'Latitude',
      longitude: 'Longitude', summary: 'Event name', start: 'Start time', end: 'End time',
      location: 'Location', description: 'Description', text: 'Text content'
    },
    yes: 'Yes',
    no: 'No',
    required: 'Please complete the required fields.',
    invalidValue: 'Please check that each field uses a valid format.',
    invalidTime: 'The end time must be later than the start time.',
    csvImported: count => `${count} rows imported. You can generate the QR codes now.`,
    csvLimited: 'The CSV contains more than 50 rows. Only the first 50 were imported.',
    csvInvalid: 'Invalid CSV. The first row must be name,content.',
    csvEmpty: 'The CSV does not contain any importable content.',
    csvReadError: 'The CSV could not be read. Please check the file and try again.',
    csvNothingToDownload: 'Enter or import batch data before downloading the CSV.'
  };

  const fieldSets = {
    url: [
      { id: 'url', type: 'url', required: true, wide: true, value: 'https://upliftorch.com' }
    ],
    wifi: [
      { id: 'ssid', type: 'text', required: true },
      { id: 'password', type: 'text' },
      { id: 'security', type: 'select', options: [['WPA', 'WPA / WPA2'], ['WEP', 'WEP'], ['nopass', isZh ? '無密碼' : 'No password']] },
      { id: 'hidden', type: 'select', options: [['false', copy.no], ['true', copy.yes]] }
    ],
    vcard: [
      { id: 'name', type: 'text', required: true },
      { id: 'organization', type: 'text' },
      { id: 'phone', type: 'tel' },
      { id: 'email', type: 'email' },
      { id: 'website', type: 'url', wide: true }
    ],
    phone: [
      { id: 'phone', type: 'tel', required: true, wide: true }
    ],
    sms: [
      { id: 'phone', type: 'tel', required: true },
      { id: 'message', type: 'text', wide: true }
    ],
    email: [
      { id: 'email', type: 'email', required: true },
      { id: 'subject', type: 'text' },
      { id: 'body', type: 'textarea', wide: true }
    ],
    geo: [
      { id: 'latitude', type: 'number', required: true, step: 'any', min: '-90', max: '90' },
      { id: 'longitude', type: 'number', required: true, step: 'any', min: '-180', max: '180' }
    ],
    event: [
      { id: 'summary', type: 'text', required: true, wide: true },
      { id: 'start', type: 'datetime-local', required: true },
      { id: 'end', type: 'datetime-local', required: true },
      { id: 'location', type: 'text', wide: true },
      { id: 'description', type: 'textarea', wide: true }
    ],
    text: [
      { id: 'text', type: 'textarea', required: true, wide: true }
    ]
  };

  let importedRows = [];

  function escapeWifi(value) {
    return value.replace(/([\\;,:"'])/g, '\\$1');
  }

  function escapeVcard(value) {
    return value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([;,])/g, '\\$1');
  }

  function formatCalendarDate(value) {
    const compact = value.replace(/[-:]/g, '').replace('.', '');
    return compact.length === 13 ? `${compact}00` : compact;
  }

  function sanitizeFileName(name, index) {
    let result = String(name || '').trim()
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
      .replace(/\s+/g, '-')
      .replace(/[.-]+$/g, '')
      .slice(0, 80);
    if (!result) {
      result = `qrcode_${index}`;
    }
    return result;
  }

  function parseCsv(csvText) {
    const text = String(csvText || '').replace(/^\uFEFF/, '');
    const rows = [];
    let row = [];
    let field = '';
    let quoted = false;

    for (let i = 0; i < text.length; i += 1) {
      const character = text[i];
      if (quoted) {
        if (character === '"' && text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else if (character === '"') {
          quoted = false;
        } else {
          field += character;
        }
      } else if (character === '"') {
        quoted = true;
      } else if (character === ',') {
        row.push(field);
        field = '';
      } else if (character === '\n' || character === '\r') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
        if (character === '\r' && text[i + 1] === '\n') {
          i += 1;
        }
      } else {
        field += character;
      }
    }

    if (field || row.length) {
      row.push(field);
      rows.push(row);
    }
    return rows;
  }

  function serializeCsv(items) {
    const escapeCsv = value => `"${String(value).replace(/"/g, '""')}"`;
    const rows = items.map(item => `${escapeCsv(item.name)},${escapeCsv(item.content)}`);
    return `\uFEFFname,content\r\n${rows.join('\r\n')}\r\n`;
  }

  function setStatus(elementId, message, error) {
    const element = document.getElementById(elementId);
    element.textContent = message;
    element.classList.toggle('error', Boolean(error));
  }

  function renderTypeFields() {
    const type = document.getElementById('qrType').value;
    const container = document.getElementById('typeFields');
    container.innerHTML = '';

    fieldSets[type].forEach(field => {
      const group = document.createElement('div');
      group.className = `field-group${field.wide ? ' field-wide' : ''}`;
      const label = document.createElement('label');
      label.htmlFor = `qrField-${field.id}`;
      label.textContent = `${copy.fields[field.id]}${field.required ? ' *' : ''}`;
      group.appendChild(label);

      let input;
      if (field.type === 'select') {
        input = document.createElement('select');
        field.options.forEach(option => {
          const optionElement = document.createElement('option');
          optionElement.value = option[0];
          optionElement.textContent = option[1];
          input.appendChild(optionElement);
        });
      } else if (field.type === 'textarea') {
        input = document.createElement('textarea');
        input.rows = 3;
      } else {
        input = document.createElement('input');
        input.type = field.type;
        if (field.step) {
          input.step = field.step;
        }
        if (field.min) {
          input.min = field.min;
        }
        if (field.max) {
          input.max = field.max;
        }
      }
      input.id = `qrField-${field.id}`;
      input.dataset.field = field.id;
      input.required = Boolean(field.required);
      if (field.value) {
        input.value = field.value;
      }
      group.appendChild(input);
      container.appendChild(group);
    });
    setStatus('singleInputStatus', '', false);
  }

  function fieldValue(id) {
    const field = document.querySelector(`[data-field="${id}"]`);
    return field ? field.value.trim() : '';
  }

  function buildSingleContent() {
    const type = document.getElementById('qrType').value;
    const missingRequired = fieldSets[type].some(field => field.required && !fieldValue(field.id));
    const invalidValue = fieldSets[type].some(field => {
      const input = document.getElementById(`qrField-${field.id}`);
      return input && !input.checkValidity();
    });
    let content = '';
    let status = '';

    if (missingRequired) {
      status = copy.required;
    } else if (invalidValue) {
      status = copy.invalidValue;
    } else if (type === 'url') {
      content = fieldValue('url');
    } else if (type === 'wifi') {
      const security = fieldValue('security');
      const password = security === 'nopass' ? '' : fieldValue('password');
      content = `WIFI:T:${security};S:${escapeWifi(fieldValue('ssid'))};P:${escapeWifi(password)};H:${fieldValue('hidden')};;`;
    } else if (type === 'vcard') {
      const parts = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${escapeVcard(fieldValue('name'))}`];
      if (fieldValue('organization')) parts.push(`ORG:${escapeVcard(fieldValue('organization'))}`);
      if (fieldValue('phone')) parts.push(`TEL:${escapeVcard(fieldValue('phone'))}`);
      if (fieldValue('email')) parts.push(`EMAIL:${escapeVcard(fieldValue('email'))}`);
      if (fieldValue('website')) parts.push(`URL:${escapeVcard(fieldValue('website'))}`);
      parts.push('END:VCARD');
      content = parts.join('\n');
    } else if (type === 'phone') {
      content = `tel:${fieldValue('phone')}`;
    } else if (type === 'sms') {
      content = `SMSTO:${fieldValue('phone')}:${fieldValue('message')}`;
    } else if (type === 'email') {
      const params = new URLSearchParams();
      if (fieldValue('subject')) params.set('subject', fieldValue('subject'));
      if (fieldValue('body')) params.set('body', fieldValue('body'));
      content = `mailto:${fieldValue('email')}${params.toString() ? `?${params.toString()}` : ''}`;
    } else if (type === 'geo') {
      content = `geo:${fieldValue('latitude')},${fieldValue('longitude')}`;
    } else if (type === 'event') {
      if (new Date(fieldValue('end')) <= new Date(fieldValue('start'))) {
        status = copy.invalidTime;
      } else {
        const parts = [
          'BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT',
          `SUMMARY:${escapeVcard(fieldValue('summary'))}`,
          `DTSTART:${formatCalendarDate(fieldValue('start'))}`,
          `DTEND:${formatCalendarDate(fieldValue('end'))}`
        ];
        if (fieldValue('location')) parts.push(`LOCATION:${escapeVcard(fieldValue('location'))}`);
        if (fieldValue('description')) parts.push(`DESCRIPTION:${escapeVcard(fieldValue('description'))}`);
        parts.push('END:VEVENT', 'END:VCALENDAR');
        content = parts.join('\n');
      }
    } else {
      content = fieldValue('text');
    }

    setStatus('singleInputStatus', status, Boolean(status));
    return content ? { name: type, content } : null;
  }

  function getBatchItems() {
    let items;
    if (importedRows.length) {
      items = importedRows;
    } else {
      items = document.getElementById('qrBatchText').value
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean)
        .slice(0, 50)
        .map((content, index) => ({ name: `qrcode_${index + 1}`, content }));
    }
    return items;
  }

  function importCsv(file) {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      const rows = parseCsv(reader.result);
      const headers = rows.length ? rows[0].map(value => value.trim().toLowerCase()) : [];
      const nameIndex = headers.indexOf('name');
      const contentIndex = headers.indexOf('content');

      if (nameIndex < 0 || contentIndex < 0) {
        importedRows = [];
        setStatus('csvStatus', copy.csvInvalid, true);
      } else {
        const parsedRows = rows.slice(1)
          .map((row, index) => ({
            name: sanitizeFileName(row[nameIndex], index + 1),
            content: String(row[contentIndex] || '').trim()
          }))
          .filter(row => row.content);
        importedRows = parsedRows.slice(0, 50);

        if (!importedRows.length) {
          setStatus('csvStatus', copy.csvEmpty, true);
        } else {
          document.getElementById('qrBatchText').value = importedRows
            .map(row => `${row.name}: ${row.content.replace(/\s+/g, ' ')}`)
            .join('\n');
          const message = parsedRows.length > 50 ? `${copy.csvImported(50)} ${copy.csvLimited}` : copy.csvImported(importedRows.length);
          setStatus('csvStatus', message, false);
        }
      }
    });
    reader.addEventListener('error', () => {
      importedRows = [];
      setStatus('csvStatus', copy.csvReadError, true);
    });
    reader.readAsText(file, 'UTF-8');
  }

  function downloadCsv() {
    const items = getBatchItems();
    if (items.length) {
      const csv = serializeCsv(items);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      link.download = 'qr-codes.csv';
      link.click();
      URL.revokeObjectURL(link.href);
      setStatus('csvStatus', '', false);
    } else {
      setStatus('csvStatus', copy.csvNothingToDownload, true);
    }
  }

  function init() {
    const typeSelect = document.getElementById('qrType');
    Object.keys(copy.types).forEach(type => {
      const option = document.createElement('option');
      option.value = type;
      option.textContent = copy.types[type];
      typeSelect.appendChild(option);
    });
    typeSelect.addEventListener('change', renderTypeFields);
    renderTypeFields();

    document.getElementById('csvFileInput').addEventListener('change', event => {
      if (event.target.files.length) {
        importCsv(event.target.files[0]);
      }
      event.target.value = '';
    });
    document.getElementById('downloadCsv').addEventListener('click', downloadCsv);
    document.getElementById('qrBatchText').addEventListener('input', () => {
      importedRows = [];
      setStatus('csvStatus', '', false);
    });
  }

  window.qrEnhancements = {
    init,
    getSingleItem: buildSingleContent,
    getBatchItems,
    sanitizeFileName,
    parseCsv,
    serializeCsv
  };
}());
