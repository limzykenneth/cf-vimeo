/* globals VIMEO_TOKEN */

const Router = require("./router");
const _ = {
	find: require("lodash.find")
};
const responseCache = new Map();

addEventListener("fetch", event => {
	event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
	const r = new Router();
	r.get("/vimeo_thumbnail/.*", (request) => getThumbnail(request));
	r.get("/", () => new Response("Vimeo API Private Proxy"));

	const resp = await r.route(request);
	return resp;
}

async function getThumbnail(request) {
	const url = new URL(request.url);
	const idRegex = /^\/vimeo_thumbnail\/(.+?)$/i;
	const id = idRegex.exec(url.pathname)[1];
	const height = parseInt(url.searchParams.get("height")) || 360;

	if(id === null){
		// If no ID is provided
		return new Response("Not Found", {
			status: 404,
			statusText: "Not Found"
		});

	}else if(responseCache.has(id) && responseCache.get(id).has(height)){
		// If ID is already cached
		return fetch(responseCache.get(id).get(height));

	}else{
		// If ID is not cached
		const resp = await vimeoVideoRequest(id);

		if(resp.pictures){
			const picture = _.find(resp.pictures.sizes, (picture) => {
				return picture.height === height;
			});

			if(!picture){
				return new Response("Not Found", {
					status: 404,
					statusText: "Not Found"
				});
			}

			// Limit cache size to 100, deleting oldest one if exceeded
			if(responseCache.size > 100){
				responseCache.delete(responseCache.entries().next().value[0]);
			}

			// Set cache for this request
			if(responseCache.has(id)){
				responseCache.get(id).set(height, picture.link);
			}else{
				responseCache.set(id, new Map([[height, picture.link]]));
			}

			return fetch(picture.link);

		}else{
			// If request to vimeo didn't return valid video object
			return new Response("Not Found", {
				status: 404,
				statusText: "Not Found"
			});
		}
	}
}

async function vimeoVideoRequest(id){
	const vimeoRequest = new Request(`https://api.vimeo.com/videos/${id}`, {
		headers: {
			"Authorization": `Bearer ${VIMEO_TOKEN}`
		}
	});

	return fetch(vimeoRequest, {
		cf: {
			cacheTtl: 60 * 60 * 24,
			cacheEverything: true
		}
	}).then((res) => res.json());
}