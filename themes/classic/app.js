document.write(`
<style>
body {-webkit-user-select: none; -ms-user-select: none; user-select: none;}
.div-container {overflow-x:auto;}
h1, footer, table {font-family: "Lucida Console", "Courier New", monospace; white-space: nowrap;}
h1 {border-bottom: 1px solid silver; margin-top: 10px; margin-bottom: 10px; padding-bottom: 10px;}
footer {border-top: 1px solid silver; margin-top: 10px; padding-top: 10px;}
table {border-collapse: collapse;}
.table-container {max-height: 85vh; overflow-y: auto;}
.number, .file-name, .file-size, .date {padding-right: 15px;}
.file-name {text-align: left;}
.file-size, .date {text-align: right;}
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
    </tr>`;

	if (path !== '/') {
		const up = path.split('/').slice(0, -2).join('/') + '/';
		content += `
		<tr>
			<td class="number"></td>
			<td class="file-name"><a href="${up}" class="re">..</a></td>
			<td class="file-size"></td>
			<td class="date"></td>
        </tr>`;
	}

	$('#table').html(`
		<tr>
			<th colspan="4" class="loading">
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
		item.modifiedTime = localtime(item.modifiedTime);
		if (item['size'] == undefined) {
			item['size'] = null;
		} else {
			totalSize += parseInt(item['size'], 10);
		}
		item['size'] = formatFileSize(item['size']);

		if (item.mimeType === 'application/vnd.google-apps.folder') {
			const p = path + item.name + '/';
			html += `
                <tr>
					<td class="number">${number++}.</td>
                    <td class="file-name"><a href="${p}" class="re">${
				item.name
			}/</a></td>
                    <td class="file-size">${item.size}</td>
                    <td class="date">${item.modifiedTime}</td>
                </tr>`;
		} else {
			const p = path + item.name;
			html += `
                <tr>
					<td class="number">${number++}.</td>
                    <td class="file-name"><a href="${p}">${item.name}</a></td>
                    <td class="file-size">${item.size}</td>
                    <td class="date">${item.modifiedTime}</td>
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
				result = new Date(valA).getTime() - new Date(valB).getTime();
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

		return `${hour}:${minute}:${second} ${year}-${month}-${date}`;
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

function formatName(f) {
	var length = 20;
	var f =
		f.length > length
			? f.substring(0, length - 3) + ' ... ' + f.substring(f.length - 5)
			: f;
	return f;
}

window.onpopstate = function () {
	var path = window.location.pathname;
	render(path);
};

$(function () {
	init();
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
