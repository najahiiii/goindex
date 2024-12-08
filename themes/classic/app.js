document.write(`
<style>
body {-webkit-user-select: none; -ms-user-select: none; user-select: none;}
h1, footer, table {font-family: "Lucida Console", "Courier New", monospace; white-space: nowrap;}
h1 {border-bottom: 1px solid silver; margin-bottom: 10px; padding-bottom: 10px;}
footer {border-top: 1px solid silver; margin-top: 10px; padding-top: 10px;}
table {border-collapse: collapse;}
.file-name, .file-size, .date {padding-right: 15px;}
.file-name {text-align: left;}
.file-size, .date {text-align: right;}
th:hover, td:hover {text-decoration: underline;}
p, a, li {color: #e0e0e0;}
a {color: #1e90ff;text-decoration: none;}
a:hover {text-decoration: unset;}
</style>`);

function init() {
	document.siteName = $('title').html();
	hostname = window.location.hostname;
	var html = `
	<div style="overflow-x:auto;">
		<h1 id="heading"></h1>
		<table id="table">
		</table>
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
	var content = `<tr><th class="file-name">Name</th><th class="file-size">Size</th><th class="date">Date Modified</th></tr>`;

	if (path != '/') {
		var up = path.split('/');
		up.pop();
		up.pop();
		up = up.join('/') + '/';
		content += `
		<tr>
			<td class="file-name"><a href="${up}">..</a></td>
			<td class="file-size"></td>
		</tr>
		`;
	}
	$('#table').html(content);

	$.post(path, function (data) {
		var obj = jQuery.parseJSON(decodeURIComponent(atob(data)));
		if (typeof obj != 'null') {
			list_files(path, obj.files);
		} else {
			list(path);
		}
	});
}

function list_files(path, files) {
	html = '';
	totalSize = 0;
	for (i in files) {
		var item = files[i];
		item['name'] = item['name'];
		item['mimeType'] = item['mimeType'];
		item['modifiedTime'] = localtime(item['modifiedTime']);
		/** Handle directory size **/
		if (item['size'] == undefined) {
			item['size'] = null;
		} else {
			totalSize += parseInt(item['size'], 10);
		}
		item['size'] = formatFileSize(item['size']);
		item['modifiedTime'] = item['modifiedTime'];
		if (item['mimeType'] == 'application/vnd.google-apps.folder') {
			var p = path + item.name + '/';
			html += `
				<tr>
					<td class="file-name"><a href="${p}">${item['name']}/</a></td>
					<td class="file-size">${item['size']}</td>
					<td class="date">${item['modifiedTime']}</td>
				</tr>
			`;
		} else {
			var p = path + item.name;
			html += `
				<tr>
					<td class="file-name"><a href="${p}">${item['name']}</a></td>
					<td class="file-size">${item['size']}</td>
					<td class="date">${item['modifiedTime']}</td>
				</tr>
			`;
		}
	}
	usage = totalSize > 0 ? `Disk used: ${formatFileSize(totalSize)} | ` : '';
	hostname = window.location.hostname;
	$('footer').html(
		`${usage}&copy; ${new Date().getFullYear()} <i class="host">${hostname}</i>.`
	);
	$('#table').append(html);
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

		// 03:00:48 2023-07-27
		return `${hour}:${minute}:${second} ${year}-${month}-${date}`;
	} catch (error) {
		console.error('Error converting UTC to local time:', error);
		return 'Invalid Date';
	}
}

function formatFileSize(bytes, decimals = 1) {
	if (!+bytes) return '—';

	const k = 1024;
	const dm = decimals < 0 ? 0 : decimals;
	const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

	const i = Math.floor(Math.log(bytes) / Math.log(k));

	return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
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
	$('body').on('click', '.folder', function () {
		var url = $(this).attr('href');
		history.pushState(null, null, url);
		render(url);
		return false;
	});

	render(path);
});
