export default {
  async fetch(request, env) {
    try {
      const response = await env.ASSETS.fetch(request);
      if (response.status === 404) {
        return env.ASSETS.fetch(new Request(new URL('/index.html', request.url), request));
      }
      return response;
    } catch (e) {
      return env.ASSETS.fetch(new Request(new URL('/index.html', request.url), request));
    }
  },
};
