var authConfig = {
	siteName: '',
	hash: '',
	client_id: '',
	client_secret: '',
	refresh_token: '',
	root: '',
	gh_user: '',
	repo_name: '',
	js_cdn:
		'//cdn.jsdelivr.net/combine/gh/jquery/jquery/dist/jquery.min.js,gh' /** <- DO NOT EDIT !!! */,
};

var sitesConfig = {
	type: '',
	title: '',
	url: '',
	descs: '',
	image: '',
	favicon: '',
};

/**
 *
 * DO NOT EDIT BELOW THIS COMMENT !!!
 */

let gd;

const html = `
    <!DOCTYPE html>
    <html>
    <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="light dark">
    <meta content="${sitesConfig.type}" property="og:type"/>
    <meta content="${sitesConfig.title}" property="og:title"/>
    <meta content="${sitesConfig.url}" property="og:url"/>
    <meta content="${sitesConfig.image}" property="og:image"/>
    <meta content="${sitesConfig.descs}" property="og:description"/>
    <title>${authConfig.siteName}</title>
    <script src="${authConfig.js_cdn}/${authConfig.gh_user}/${authConfig.repo_name}@${authConfig.hash}/themes/classic/app.js"></script>
    <link rel="icon" type="image/x-icon" href="${sitesConfig.favicon}"/>
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

	if (path.substring(path.length - 1) == '/' || action != null) {
		try {
			const list = await gd.list(path);
			if (!list || !list.files) {
				throw new Error('Invalid path or directory is empty');
			}

			return new Response(html, {
				status: 200,
				headers: { 'Content-Type': 'text/html; charset=utf-8' },
			});
		} catch (error) {
			return createErrorResponse(
				404,
				'Path Not Found',
				`The path you are trying to access is invalid or empty. Please check the URL.`,
				'/'
			);
		}
	} else {
		try {
			const file = await gd.file(path);
			if (!file || !file.id) {
				throw new Error('File not found or invalid file ID');
			}

			const range = request.headers.get('Range');
			const response = await gd.down(file.id, range);

			// Check if the response contains the specific error JSON
			if (response.status === 403) {
				const responseBody = await response.json();
				if (
					responseBody.error &&
					responseBody.error.message.includes(
						'Only files with binary content can be downloaded'
					)
				) {
					// Redirect or inform the user about the proper URL format
					return createErrorResponse(
						403,
						'Invalid URL',
						`The file or folder you are trying to access cannot be downloaded directly. 
						Please use the correct URL format ending with <code>/</code>.`,
						`${path + '/'}`
					);
				}
			}

			return response;
		} catch (error) {
			return createErrorResponse(
				404,
				'File Not Found',
				`The file you are looking for could not be found or the file ID is invalid.`,
				'/'
			);
		}
	}
}

function createErrorResponse(status, title, message, redirectUrl) {
	const errorMessage = `
		<!DOCTYPE html>
		<html>
		<head>
			<title>Error</title>
			<meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
			<meta name="color-scheme" content="light dark">
            <meta content="${sitesConfig.type}" property="og:type"/>
            <meta content="${sitesConfig.title}" property="og:title"/>
            <meta content="${sitesConfig.url}" property="og:url"/>
            <meta content="${sitesConfig.image}" property="og:image"/>
            <meta content="${sitesConfig.descs}" property="og:description"/>
            <link rel="icon" type="image/x-icon" href="${sitesConfig.favicon}"/>
			<style>
				body { font-family: monospace; text-align: center; padding: 50px; }
				h1 { color: #FF0000; }
				p { font-size: 18px; }
				a { color: #0000FF; text-decoration: none; }
				a:hover { text-decoration: underline; }
			</style>
		</head>
		<body>
			<h1>Error: ${title}</h1>
			<p>${message}</p>
			<p><a href="${redirectUrl}">Go to the correct URL</a></p>
		</body>
		</html>
	`;
	return new Response(errorMessage, {
		status: status,
		headers: { 'Content-Type': 'text/html; charset=utf-8' },
	});
}

async function apiRequest(request) {
	const url = new URL(request.url);
	const path = url.pathname;

	const origin = request.headers.get('Origin');
	const host = request.headers.get('Host');
	const allowedOrigin = `https://${host}`;

	if (origin !== allowedOrigin) {
		return new Response('Forbidden: Cross-origin requests are not allowed.', {
			status: 403,
			headers: { 'Content-Type': 'text/plain' },
		});
	}

	const option = {
		status: 200,
		headers: { 'Access-Control-Allow-Origin': allowedOrigin },
	};

	try {
		let responseData;

		if (path.endsWith('/')) {
			const list = await gd.list(path);
			if (!list || !list.files) {
				throw new Error('Invalid path or directory is empty');
			}
			responseData = JSON.stringify(list);
		} else {
			const file = await gd.file(path);
			if (!file || !file.id) {
				throw new Error('File not found or invalid file ID');
			}
			responseData = JSON.stringify(file);
		}

		const encryptedData = caesarCipherEncrypt(responseData, 3);
		return new Response(encryptedData, option);
	} catch (error) {
		return createErrorResponse(
			500,
			'Internal Server Error',
			`An unexpected error occurred: ${error.message}.`,
			'/'
		);
	}
}

function caesarCipherEncrypt(text, shift) {
	return text.replace(/[a-zA-Z]/g, function (char) {
		let code = char.charCodeAt(0);
		if (code >= 65 && code <= 90) {
			return String.fromCharCode(((code - 65 + shift) % 26) + 65);
		} else if (code >= 97 && code <= 122) {
			return String.fromCharCode(((code - 97 + shift) % 26) + 97);
		}
		return char;
	});
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
		name = decodeURIComponent(name).replace(/\'/g, "\\'");
		const dir = arr.join('/') + '/';
		const parent = await this.findPathId(dir);
		let url = 'https://www.googleapis.com/drive/v3/files';
		const params = {
			includeItemsFromAllDrives: true,
			supportsAllDrives: true,
		};
		params.q = `'${parent}' in parents and name = '${name}' and trashed = false and mimeType != 'application/vnd.google-apps.shortcut'`;
		params.fields =
			'files(id, name, mimeType, size , createdTime, modifiedTime)';
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
		if (!id) {
			return { files: [] }; // Return an empty list if path ID is not found
		}

		const obj = await this._ls(id);
		if (!obj || !obj.files) {
			return { files: [] }; // Ensure that 'files' is always an array
		}

		if (obj.files.length > 1000) {
			gd.cache[path] = obj;
		}
		return obj;
	}

	async _ls(parent) {
		if (!parent) {
			return { files: [] }; // Return an empty list if parent is undefined or null
		}
		const files = [];
		let pageToken;
		let obj;
		const params = {
			includeItemsFromAllDrives: true,
			supportsAllDrives: true,
		};
		params.q = `'${parent}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.shortcut'`;
		params.orderBy = 'folder,name,modifiedTime desc';
		params.fields =
			'nextPageToken, files(id, name, mimeType, size , modifiedTime)';
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
			files.push(...(obj.files || [])); // Ensure 'files' is always an array
			pageToken = obj.nextPageToken;
		} while (pageToken);

		return { files: files };
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
		name = decodeURIComponent(name).replace(/\'/g, "\\'");

		if (parent == undefined) {
			return null;
		}

		let url = 'https://www.googleapis.com/drive/v3/files';
		const params = {
			includeItemsFromAllDrives: true,
			supportsAllDrives: true,
		};
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
		if (
			this.authConfig.expires == undefined ||
			this.authConfig.expires < Date.now()
		) {
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
			client_id: this.authConfig.client_id,
			client_secret: this.authConfig.client_secret,
			refresh_token: this.authConfig.refresh_token,
			grant_type: 'refresh_token',
		};
		const requestOption = {
			method: 'POST',
			headers: headers,
			body: this.enQuery(post_data),
		};
		const response = await fetch(url, requestOption);
		return await response.json();
	}

	async requestOption(headers = {}, method = 'GET') {
		const accessToken = await this.accessToken();
		headers['authorization'] = 'Bearer ' + accessToken;
		return { method: method, headers: headers };
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
		return this.replace(
			new RegExp('^\\' + char + '+|\\' + char + '+$', 'g'),
			''
		);
	}
	return this.replace(/^\s+|\s+$/g, '');
};
