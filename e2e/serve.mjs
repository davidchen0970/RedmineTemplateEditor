// Zero-dependency static server used only to host the app for Playwright e2e.
// The app uses <script type="module">, so it must be served over HTTP (a bare
// file:// url is blocked by the browser's module CORS rules).
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";

const PORT = 4173;
const ROOT = process.cwd();

const MIME = {
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".mjs": "text/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".txt": "text/plain; charset=utf-8",
	".png": "image/png",
	".svg": "image/svg+xml",
	".map": "application/json",
};

const server = createServer(async (req, res) => {
	try {
		const pathname = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);
		let filePath = join(ROOT, pathname.replace(/^\/+/, ""));
		let raw;
		try {
			raw = await readFile(filePath);
		} catch {
			// The path points at a directory (e.g. "/") -> serve its index.html.
			filePath = join(filePath, "index.html");
			raw = await readFile(filePath);
		}
		res.writeHead(200, {
			"Content-Type": MIME[extname(filePath)] ?? "application/octet-stream",
		});
		res.end(raw);
	} catch {
		res.writeHead(404);
		res.end("not found");
	}
});

server.listen(PORT, "127.0.0.1", () => {
	console.log(`e2e server on http://127.0.0.1:${PORT}`);
});
