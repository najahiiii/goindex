document.write(`
<style>
*{box-sizing:border-box}
h1{border-bottom:1px solid silver;margin-bottom:10px;padding-bottom:10px;white-space:nowrap}
footer{border-top:1px solid silver;margin-top:10px;padding-top:10px;white-space:nowrap}
table{border-collapse:collapse;font-family:monospace}
th{font-weight:1000}
.file-name{text-align:left}
th.file-name:hover{text-decoration:underline}
td.file-name:hover{text-decoration:underline}
.file-size{text-align:right}
th.file-size:hover{text-decoration:underline}
td.file-size:hover{text-decoration:underline}
th, td {padding-right:10px}
</style>`)

function init() {
    document.siteName = $('title').html()
    var html = `
	<h1 id="heading"></h1>
	<table id="table">
	</table>
	<footer>&copy; 2023 <i id="host"></i>.</footer>
	`
    $('body').html(html)
    document.getElementById('host').innerHTML = window.location.hostname
}

function render(path) {
    if (path.indexOf('?') > 0) {
        path = path.substring(0, path.indexOf('?'))
    }
    parseInfo(path)
    if (path.substring(path.length - 1) == '/') {
        list(path)
    } else {
        file(path)
    }
}

function parseInfo(path) {
    path = decodeURI(path)
    if (path == '/') {
        $('title').html('Index of ' + window.location.hostname)
        $('#heading').html('Index of ' + window.location.hostname)
    } else {
        var segment = ''
        var lastSegment = ''
        var sep = ''

        var segment = path.split('/')
        var lastSegment = segment.pop() || segment.pop()
        segment.forEach((segment) => (sep += '../'))
        $('title').html(document.siteName + ' > ' + lastSegment)
        $('#heading').html('Index of ' + sep + formatName(lastSegment))
    }
}

function list(path) {
    var content = `<tr><th class="file-name">Name</th><th class="file-size">Size</th></tr>`

    if (path != '/') {
        var up = path.split('/')
        up.pop()
        up.pop()
        up = up.join('/') + '/'
        content += `
		<tr>
		<td class="file-name">
		<a href="${up}">..</a>
		</td>
		<td class="file-size"></td>
		</tr>
		`
    }
    $('#table').html(content)

    $.post(path, function (data) {
        var obj = jQuery.parseJSON(data)
        if (typeof obj != 'null') {
            list_files(path, obj.files)
        } else {
            list(path)
        }
    })
}

function list_files(path, files) {
    html = ''
    for (i in files) {
        var item = files[i]
        item['name'] = item['name']
        item['mimeType'] = item['mimeType']
        /** Handle directory size **/
        if (item['size'] == undefined) {
            item['size'] = null
        }
        item['size'] = formatFileSize(item['size'])
        if (item['mimeType'] == 'application/vnd.google-apps.folder') {
            var p = path + item.name + '/'
            html += `
				<tr>
					<td class="file-name"><a href="${p}">${item['name']}/</a></td>
					<td class="file-size">${item['size']}</td>
				</tr>
			`
        } else {
            var p = path + item.name
            html += `
				<tr>
					<td class="file-name"><a href="${p}">${item['name']}</a></td>
					<td class="file-size">${item['size']}</td>
				</tr>
			`
        }
    }
    $('#table').append(html)
}

function localtime(utc_datetime) {
    var T_pos = utc_datetime.indexOf('T')
    var Z_pos = utc_datetime.indexOf('Z')
    var year_month_day = utc_datetime.substring(0, T_pos)
    var hour_minute_second = utc_datetime.substring(T_pos + 1, Z_pos - T_pos - 1)
    var new_datetime = year_month_day + ' ' + hour_minute_second

    timestamp = new Date(Date.parse(new_datetime))
    timestamp = timestamp.getTime()
    timestamp = timestamp / 1000

    var unixtimestamp = timestamp + 7 * 60 * 60

    var unixtimestamp = new Date(unixtimestamp * 1000)
    var year = 1900 + unixtimestamp.getYear()
    var month = '0' + (unixtimestamp.getMonth() + 1)
    var date = '0' + unixtimestamp.getDate()
    var hour = '0' + unixtimestamp.getHours()
    var minute = '0' + unixtimestamp.getMinutes()
    var second = '0' + unixtimestamp.getSeconds()
    return (
        year +
        '-' +
        month.substring(month.length - 2, month.length) +
        '-' +
        date.substring(date.length - 2, date.length) +
        ' ' +
        hour.substring(hour.length - 2, hour.length) +
        ':' +
        minute.substring(minute.length - 2, minute.length) +
        ':' +
        second.substring(second.length - 2, second.length)
    )
}

function formatFileSize(bytes, decimals = 1) {
    if (!+bytes) return '—'

    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']

    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`
}

function formatName(f) {
    var length = 20
    var f =
        f.length > length
            ? f.substring(0, length - 3) + '...' + f.substring(f.length - 5)
            : f
    return f
}

window.onpopstate = function () {
    var path = window.location.pathname
    render(path)
}

$(function () {
    init()
    var path = window.location.pathname
    $('body').on('click', '.folder', function () {
        var url = $(this).attr('href')
        history.pushState(null, null, url)
        render(url)
        return false
    })

    render(path)
})
