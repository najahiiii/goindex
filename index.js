var authConfig = {
	"siteName": "",
	"hash" : "",
	"client_id": "",
	"client_secret": "",
	"refresh_token": "",
	"root": "",
	"gh_user": "",
	"repo_name": "",
	"favicon": "//ssl.gstatic.com/docs/doclist/images/drive_2022q3_32dp.png"
};

let gd;

const html = `
	<!DOCTYPE html>
	<html>
	<head>
		<link rel="icon" href="${authConfig.favicon}">
		<title>${authConfig.siteName}</title>
		<script src="//cdn.jsdelivr.net/combine/gh/jquery/jquery/dist/jquery.min.js,gh/${authConfig.gh_user}/${authConfig.repo_name}@${authConfig.hash}/themes/classic/app.js"></script>
	</head>
	<body>
	</body>
	</html>
	`;

addEventListener('fetch', (event) => {
	event.respondWith(handleRequest(event.request));
});

/**
* Fetch a request
* @param {Request} request
*/
async function handleRequest(request) {
	if (gd == undefined) {
		gd = new googleDrive(authConfig);
	}

	if (request.method == 'POST') {
		return apiRequest(request);
	}

	const url = new URL(request.url);
	const path = url.pathname;
	const action = url.searchParams.get('a');

	if (path.substr(-1) == '/' || action != null) {
		return new Response(html, {
			status: 200, headers: {'Content-Type': 'text/html; charset=utf-8'}
		});
	} else {
		const file = await gd.file(path);
		const range = request.headers.get('Range');
		return gd.down(file.id, range);
	}
}

async function apiRequest(request) {
	const url = new URL(request.url);
	const path = url.pathname;

	const option = {status: 200, headers: {'Access-Control-Allow-Origin': '*'}};

	if (path.substr(-1) == '/') {
		const list = await gd.list(path);
		return new Response(JSON.stringify(list), option);
	} else {
		const file = await gd.file(path);
		const range = request.headers.get('Range');
		return new Response(JSON.stringify(file));
	}
}

class googleDrive {
	constructor(authConfig) {
		this.authConfig = authConfig;
		this.paths = [];
		this.files = [];
		this.passwords = [];
		this.paths['/'] = authConfig.root;
		this.accessToken();
	}

	async down(id, range = '') {
		const url = `https://www.googleapis.com/drive/v3/files/${id}?alt=media&acknowledgeAbuse=true`;
		const requestOption = await this.requestOption();
		requestOption.headers['Range'] = range;
		return await fetch(url, requestOption);
	}

	async file(path) {
		if (typeof this.files[path] == 'undefined') {
		this.files[path] = await this._file(path);
		}
		return this.files[path];
	}

	async _file(path) {
		const arr = path.split('/');
		let name = arr.pop();
		name = decodeURIComponent(name).replace(/\'/g, '\\\'');
		const dir = arr.join('/') + '/';
		const parent = await this.findPathId(dir);
		let url = 'https://www.googleapis.com/drive/v3/files';
		const params = {'includeItemsFromAllDrives': true, 'supportsAllDrives': true};
		params.q = `'${parent}' in parents and name = '${name}' and trashed = false and mimeType != 'application/vnd.google-apps.shortcut'`;
		params.fields = 'files(id, name, mimeType, size , createdTime, modifiedTime)';
		url += '?' + this.enQuery(params);
		const requestOption = await this.requestOption();
		const response = await fetch(url, requestOption);
		const obj = await response.json();
		return obj.files[0];
	}

	async list(path) {
		if (gd.cache == undefined) {
			gd.cache = {};
		}

		if (gd.cache[path]) {
			return gd.cache[path];
		}

		const id = await this.findPathId(path);
		const obj = await this._ls(id);
		if (obj.files && obj.files.length > 1000) {
			gd.cache[path] = obj;
		}
		return obj;
	}

	async _ls(parent) {
		if (parent == undefined) {
			return null;
		}
		const files = [];
		let pageToken;
		let obj;
		const params = {'includeItemsFromAllDrives': true, 'supportsAllDrives': true};
		params.q = `'${parent}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.shortcut'`;
		params.orderBy = 'folder,name,modifiedTime desc';
		params.fields = 'nextPageToken, files(id, name, mimeType, size , modifiedTime)';
		params.pageSize = 1000;

		do {
			if (pageToken) {
				params.pageToken = pageToken;
			}
			let url = 'https://www.googleapis.com/drive/v3/files';
			url += '?' + this.enQuery(params);
			const requestOption = await this.requestOption();
			const response = await fetch(url, requestOption);
			obj = await response.json();
			files.push(...obj.files);
			pageToken = obj.nextPageToken;
		}
		while (pageToken);

		obj.files = files;
		return obj;
	}

	async findPathId(path) {
		let c_path = '/';
		let c_id = this.paths[c_path];

		const arr = path.trim('/').split('/');
		for (const name of arr) {
			c_path += name + '/';
			if (typeof this.paths[c_path] == 'undefined') {
				const id = await this._findDirId(c_id, name);
				this.paths[c_path] = id;
			}

			c_id = this.paths[c_path];
			if (c_id == undefined || c_id == null) {
				break;
			}
		}
		return this.paths[path];
	}

	async _findDirId(parent, name) {
		name = decodeURIComponent(name).replace(/\'/g, '\\\'');

		if (parent == undefined) {
			return null;
		}

		let url = 'https://www.googleapis.com/drive/v3/files';
		const params = {'includeItemsFromAllDrives': true, 'supportsAllDrives': true};
		params.q = `'${parent}' in parents and mimeType = 'application/vnd.google-apps.folder' and name = '${name}' and trashed = false and mimeType != 'application/vnd.google-apps.shortcut'`;
		params.fields = 'nextPageToken, files(id, name, mimeType)';
		url += '?' + this.enQuery(params);
		const requestOption = await this.requestOption();
		const response = await fetch(url, requestOption);
		const obj = await response.json();
		if (obj.files[0] == undefined) {
			return null;
		}
		return obj.files[0].id;
	}

	async accessToken() {
		if (this.authConfig.expires == undefined || this.authConfig.expires < Date.now()) {
			const obj = await this.fetchAccessToken();
			if (obj.access_token != undefined) {
				this.authConfig.accessToken = obj.access_token;
				this.authConfig.expires = Date.now() + 3500 * 1000;
			}
		}
		return this.authConfig.accessToken;
	}

	async fetchAccessToken() {
		const url = 'https://www.googleapis.com/oauth2/v4/token';
		const headers = {
			'Content-Type': 'application/x-www-form-urlencoded',
		};
		const post_data = {
			'client_id': this.authConfig.client_id,
			'client_secret': this.authConfig.client_secret,
			'refresh_token': this.authConfig.refresh_token,
			'grant_type': 'refresh_token',
		};
		const requestOption = {
			'method': 'POST',
			'headers': headers,
			'body': this.enQuery(post_data),
		};
		const response = await fetch(url, requestOption);
		return await response.json();
	}

	async requestOption(headers = {}, method = 'GET') {
		const accessToken = await this.accessToken();
		headers['authorization'] = 'Bearer ' + accessToken;
		return {'method': method, 'headers': headers};
	}

	enQuery(data) {
		const ret = [];
		for (const d in data) {
			ret.push(encodeURIComponent(d) + '=' + encodeURIComponent(data[d]));
		}
		return ret.join('&');
	}
	
	sleep(ms) {
		return new Promise(function (resolve, reject) {
			let i = 0;
			setTimeout(function () {
				i++;
				if (i >= 2) reject(new Error('i>=2'));
				else resolve(i);
			}, ms);
		});
	}
}

String.prototype.trim = function (char) {
	if (char) {
		return this.replace(new RegExp('^\\' + char + '+|\\' + char + '+$', 'g'), '');
	}
	return this.replace(/^\s+|\s+$/g, '');
};
