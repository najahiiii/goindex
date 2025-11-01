document.write(`
<style>
body {-webkit-user-select: none; -ms-user-select: none; user-select: none;}
.div-container {overflow-x:auto;}
h1, footer, table {font-family: "Lucida Console", "Courier New", monospace; white-space: nowrap;}
h1 {border-bottom: 1px solid silver; margin-top: 10px; margin-bottom: 10px; padding-bottom: 10px;}
footer {border-top: 1px solid silver; margin-top: 10px; padding-top: 10px;}
table {border-collapse: collapse;}
.table-container {max-height: 85vh; overflow-y: auto;}
.number, .file-name, .file-size, .date, .options {padding-right: 15px;}
.file-name {text-align: left;}
.file-size, .date {text-align: right;}
.options {text-align: right; white-space: nowrap;}
.option-icon {display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; background: none; border: none; color: #1e90ff; cursor: pointer; transition: color 0.2s ease;}
.option-icon + .option-icon {margin-left: 1px;}
.option-icon:hover {color: #63b3ff;}
.option-icon.copied {color: #32cd32;}
a.option-icon {text-decoration: none;}
button.option-icon {padding: 0;}
th {position: sticky; top: 0; z-index: 10;}
th:hover, td:hover {text-decoration: underline;}
p, a, li {color: #e0e0e0;}
a {color: #1e90ff; text-decoration: none;}
a:hover {text-decoration: unset;}
th.sortable {cursor: pointer; position: relative;}
th.sortable.asc::after {content: '  ▲'; position: absolute; right: 5px;}
th.sortable.desc::after {content: '  ▼'; position: absolute; right: 5px;}
.loading {text-align: center; font-weight: bold; color: #fff; text-shadow: 0 0 5px #00cc00;}
.loading span {animation: glowCycle 1.5s infinite alternate; display: inline-block;}
.loading span:nth-child(1) {animation-delay: 0s;}
.loading span:nth-child(2) {animation-delay: 0.3s;}
.loading span:nth-child(3) {animation-delay: 0.6s;}
@keyframes glowCycle {
    0% { text-shadow: 0 0 5px #99ff99; }
    50% { text-shadow: 0 0 20px #99ff99, 0 0 30px #99ff99; }
    100% { text-shadow: 0 0 5px #99ff99; }
}
</style>
`);

let lucideReadyPromise;

function init() {
	document.siteName = $('title').html();
	const hostname = window.location.hostname;
	var html = `
	<div class="div-container">
		<h1 id="heading"></h1>
		<div class="table-container">
			<table id="table">
			</table>
		</div>
		<footer>&copy; ${new Date().getFullYear()} <i class="host">${hostname}</i>.</footer>
	</div>
	`;
	$('body').html(html);
}

function render(path) {
	if (path.indexOf('?') > 0) {
		path = path.substring(0, path.indexOf('?'));
	}
	parseInfo(path);
	if (path.substring(path.length - 1) == '/') {
		list(path);
	} else {
		file(path);
	}
}

function parseInfo(path) {
	path = decodeURI(path);
	if (path == '/') {
		$('title').html('Index of ' + window.location.hostname);
		$('#heading').html('Index of ' + window.location.hostname);
	} else {
		var segment = '';
		var lastSegment = '';
		var sep = '';

		var segment = path.split('/');
		var lastSegment = segment.pop() || segment.pop();
		segment.forEach((segment) => (sep += '../'));
		$('title').html(document.siteName + ' > ' + lastSegment);
		$('#heading').html('Index of ' + sep + formatName(lastSegment));
	}
}

function list(path) {
	let content = `
    <tr>
		<th class="sortable number" data-sort="number">#</th>
        <th class="sortable file-name" data-sort="file-name">Name</th>
        <th class="sortable file-size" data-sort="file-size">Size</th>
        <th class="sortable date" data-sort="date">Date Modified</th>
        <th class="options">Opsi</th>
    </tr>`;

	if (path !== '/') {
		const up = path.split('/').slice(0, -2).join('/') + '/';
		const safeUp = escapeAttribute(up);
		content += `
		<tr>
			<td class="number"></td>
			<td class="file-name"><a href="${safeUp}" class="re">..</a></td>
			<td class="file-size"></td>
			<td class="date"></td>
			<td class="options"></td>
        </tr>`;
	}

	$('#table').html(`
		<tr>
			<th colspan="5" class="loading">
				<span>L</span><span>o</span><span>a</span><span>d</span><span>i</span><span>n</span><span>g</span> 
				<span>D</span><span>i</span><span>s</span><span>k</span><span>.</span><span>.</span><span>.</span>
			</th>
		</tr>
	`);

	$.post(path, function (data) {
		const obj = jQuery.parseJSON(decodeURIComponent(atob(data)));
		$('#table').find('.loading').remove();
		$('#table').html(content);
		$('#table')
			.off('click', 'th.sortable')
			.on('click', 'th.sortable', function () {
				const sortBy = $(this).data('sort');
				const order = $(this).hasClass('asc') ? 'desc' : 'asc';
				$('th.sortable').removeClass('asc desc');
				$(this).addClass(order);
				sortTable(sortBy, order);
			})
			.off('click', '.option-icon[data-action="copy"]')
			.on('click', '.option-icon[data-action="copy"]', function (event) {
				handleCopyClick(event, this);
			});
		obj ? list_files(path, obj.files) : list(path);
	});
}

function list_files(path, files) {
	files.sort((a, b) => {
		return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
	});
	let html = '';
	let totalSize = 0;
	let fileCount = 0;
	let number = 1;

	for (const item of files) {
		const isoModifiedTime = item.modifiedTime || '';
		const displayModifiedTime = isoModifiedTime
			? localtime(isoModifiedTime)
			: 'Unknown';
		if (item['size'] == undefined) {
			item['size'] = null;
		} else {
			totalSize += parseInt(item['size'], 10);
		}
		item['size'] = formatFileSize(item['size']);

		const isFolder = item.mimeType === 'application/vnd.google-apps.folder';
		const itemPath = path + item.name + (isFolder ? '/' : '');
		const safeItemPath = escapeAttribute(itemPath);
		const safeItemName = escapeHtml(item.name);
		const optionsCell = buildOptionsCell(itemPath, isFolder, item.name);
		const dateCell =
			`<td class="date" data-modified="${escapeAttribute(isoModifiedTime)}">` +
			`${escapeHtml(displayModifiedTime)}</td>`;

		if (isFolder) {
			html += `
                <tr>
					<td class="number">${number++}.</td>
					<td class="file-name"><a href="${safeItemPath}" class="re">${safeItemName}/</a></td>
                    <td class="file-size">${item.size}</td>
                    ${dateCell}
                    ${optionsCell}
                </tr>`;
		} else {
			html += `
                <tr>
					<td class="number">${number++}.</td>
					<td class="file-name"><a href="${safeItemPath}">${safeItemName}</a></td>
                    <td class="file-size">${item.size}</td>
                    ${dateCell}
                    ${optionsCell}
                </tr>`;
		}

		fileCount++;
	}

	const usage =
		totalSize > 0
			? `Disk used: ${formatFileSize(totalSize)} | Total files: ${fileCount} | `
			: '';
	const hostname = window.location.hostname;
	$('footer').html(
		`${usage}&copy; ${new Date().getFullYear()} <i class="host">${hostname}</i>.`
	);
	$('#table').append(html);
	refreshIcons();
}

function sortTable(sortBy, order) {
	const rows = $('#table tr').not(':first');
	const sortedRows = rows.toArray().sort((a, b) => {
		const valA = $(a).find(`.${sortBy}`).text().trim();
		const valB = $(b).find(`.${sortBy}`).text().trim();

		let result;
		if (sortBy === 'file-size') {
			result = parseSize(valA) - parseSize(valB);
		} else if (sortBy === 'number') {
			const numberA = parseInt(valA, 10);
			const numberB = parseInt(valB, 10);
			const safeA = Number.isNaN(numberA) ? 0 : numberA;
			const safeB = Number.isNaN(numberB) ? 0 : numberB;
			result = safeA - safeB;
		} else if (sortBy === 'date') {
			const attrA = $(a).find('.date').attr('data-modified');
			const attrB = $(b).find('.date').attr('data-modified');
			const dateA = attrA ? Date.parse(attrA) : 0;
			const dateB = attrB ? Date.parse(attrB) : 0;
			const safeA = Number.isNaN(dateA) ? 0 : dateA;
			const safeB = Number.isNaN(dateB) ? 0 : dateB;
			result = safeA - safeB;
		} else if (sortBy === 'file-name') {
			result = valA.localeCompare(valB, undefined, { sensitivity: 'base' });
		} else {
			result = 0;
		}
		return order === 'asc' ? result : -result;
	});

	$('#table').append(sortedRows);
}

function localtime(utc_datetime) {
	try {
		var T_pos = utc_datetime.indexOf('T');
		var Z_pos = utc_datetime.indexOf('Z');
		if (T_pos === -1 || Z_pos === -1) {
			throw new Error('Invalid UTC datetime format');
		}

		var year_month_day = utc_datetime.substring(0, T_pos);
		var hour_minute_second = utc_datetime.substring(T_pos + 1, Z_pos);

		var new_datetime = year_month_day + ' ' + hour_minute_second;

		var timestamp = new Date(new_datetime).getTime();
		if (isNaN(timestamp)) {
			throw new Error('Invalid date conversion');
		}

		timestamp += 7 * 60 * 60 * 1000;

		var local_date = new Date(timestamp);
		var year = local_date.getFullYear();
		var month = ('0' + (local_date.getMonth() + 1)).slice(-2);
		var date = ('0' + local_date.getDate()).slice(-2);
		var hour = ('0' + local_date.getHours()).slice(-2);
		var minute = ('0' + local_date.getMinutes()).slice(-2);
		var second = ('0' + local_date.getSeconds()).slice(-2);

		return `${year}-${month}-${date}T${hour}:${minute}:${second}`;
	} catch (error) {
		console.error('Error converting UTC to local time:', error);
		return 'Invalid Date';
	}
}

function formatFileSize(bytes) {
	if (bytes === null || bytes === undefined) return '';
	if (bytes <= 0) return '0 Bytes';
	const units = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB'];
	const index = Math.floor(Math.log(bytes) / Math.log(1024));
	const size = (bytes / Math.pow(1024, index)).toFixed(2);
	return `${size} ${units[index]}`;
}

function parseSize(size) {
	if (!size) {
		return 0;
	}
	const units = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB'];
	const parts = size.split(' ');
	if (parts.length < 2) {
		return 0;
	}
	const value = parseFloat(parts[0]);
	const unitIndex = units.indexOf(parts[1]);
	if (isNaN(value) || unitIndex === -1) {
		return 0;
	}
	return value * Math.pow(1024, unitIndex);
}

function buildOptionsCell(itemPath, isFolder, itemName) {
	const safePath = escapeAttribute(itemPath);
	const safeName = escapeAttribute(itemName);
	let cell =
		`<td class="options">` +
		`<button type="button" class="option-icon option-copy" data-action="copy" data-path="${safePath}" title="Copy link" aria-label="Copy link">` +
		`<i data-lucide="copy"></i>` +
		`</button>`;
	if (!isFolder) {
		cell +=
			`<a href="${safePath}" class="option-icon option-download" data-action="download" title="Download" aria-label="Download" download="${safeName}">` +
			`<i data-lucide="download"></i>` +
			`</a>`;
	}
	cell += `</td>`;
	return cell;
}

function escapeAttribute(value) {
	if (value === null || value === undefined) {
		return '';
	}
	return String(value)
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

function escapeHtml(value) {
	if (value === null || value === undefined) {
		return '';
	}
	return String(value)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function formatName(f) {
	var length = 20;
	var f =
		f.length > length
			? f.substring(0, length - 3) + ' ... ' + f.substring(f.length - 5)
			: f;
	return f;
}

function handleCopyClick(event, element) {
	event.preventDefault();
	const $target = $(element);
	const dataPath = $target.attr('data-path');
	if (!dataPath) {
		return;
	}
	const absoluteUrl = buildAbsoluteUrl(dataPath);
	copyToClipboard(absoluteUrl)
		.then(function () {
			showCopyFeedback($target);
		})
		.catch(function (error) {
			console.error('Unable to copy link:', error);
			showCopyFeedback($target, 'Copy failed');
		});
}

function buildAbsoluteUrl(path) {
	try {
		return new URL(path, window.location.origin).toString();
	} catch (error) {
		console.error('Failed to build absolute URL:', error);
		return path;
	}
}

function copyToClipboard(text) {
	if (navigator.clipboard && navigator.clipboard.writeText) {
		return navigator.clipboard.writeText(text);
	}
	return fallbackCopyText(text);
}

function fallbackCopyText(text) {
	return new Promise(function (resolve, reject) {
		const textarea = document.createElement('textarea');
		textarea.value = text;
		textarea.setAttribute('readonly', '');
		textarea.style.position = 'absolute';
		textarea.style.left = '-9999px';
		document.body.appendChild(textarea);

		const selection = document.getSelection();
		const selectedRange =
			selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

		textarea.select();

		try {
			const successful = document.execCommand('copy');
			if (!successful) {
				throw new Error('Copy command unsuccessful');
			}
			resolve();
		} catch (error) {
			reject(error);
		} finally {
			document.body.removeChild(textarea);
			if (selectedRange && selection) {
				selection.removeAllRanges();
				selection.addRange(selectedRange);
			}
		}
	});
}

function showCopyFeedback($element, message) {
	const feedbackMessage = message || 'Copied!';
	const originalTitle =
		$element.data('original-title') !== undefined
			? $element.data('original-title')
			: $element.attr('title');
	if (originalTitle !== undefined) {
		$element.data('original-title', originalTitle);
		$element.attr('title', feedbackMessage);
	} else {
		$element.attr('title', feedbackMessage);
	}
	$element.addClass('copied');

	setTimeout(function () {
		$element.removeClass('copied');
		const storedTitle = $element.data('original-title');
		if (storedTitle !== undefined) {
			$element.attr('title', storedTitle);
			$element.removeData('original-title');
		} else {
			$element.removeAttr('title');
		}
	}, 1500);
}

function loadLucide() {
	if (window.lucide) {
		return Promise.resolve(window.lucide);
	}
	if (lucideReadyPromise) {
		return lucideReadyPromise;
	}
	lucideReadyPromise = new Promise(function (resolve, reject) {
		const script = document.createElement('script');
		script.src = 'https://unpkg.com/lucide@latest';
		script.async = true;
		script.onload = function () {
			resolve(window.lucide);
		};
		script.onerror = function () {
			reject(new Error('Failed to load Lucide icons'));
		};
		document.head.appendChild(script);
	});

	return lucideReadyPromise.catch(function (error) {
		console.error(error);
		lucideReadyPromise = null;
		throw error;
	});
}

function refreshIcons() {
	loadLucide()
		.then(function (lucideLib) {
			if (lucideLib && typeof lucideLib.createIcons === 'function') {
				lucideLib.createIcons();
			}
		})
		.catch(function (error) {
			console.error('Unable to refresh icons:', error);
		});
}

window.onpopstate = function () {
	var path = window.location.pathname;
	render(path);
};

$(function () {
	init();
	loadLucide().catch(function (error) {
		console.error('Lucide preload failed:', error);
	});
	var path = window.location.pathname;
	$('body').on('click', '.re', function (e) {
		e.preventDefault();

		var url = $(this).attr('href');
		history.pushState(null, null, url);
		render(url);
		return false;
	});

	render(path);
});
