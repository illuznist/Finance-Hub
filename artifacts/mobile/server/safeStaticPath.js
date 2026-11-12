const fs = require("fs");
const path = require("path");

function isInside(root, target) {
  const relative = path.relative(root, target);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function resolveStaticPath(rootPath, requestPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(requestPath);
  } catch {
    return null;
  }
  if (decoded.includes("\0")) return null;

  let root;
  try {
    root = fs.realpathSync(path.resolve(rootPath));
  } catch {
    return null;
  }
  const relativeRequest = decoded.replace(/\\/g, "/").replace(/^\/+/, "");
  const candidate = path.resolve(root, relativeRequest);
  if (!isInside(root, candidate)) return null;

  let existingAncestor = candidate;
  while (!fs.existsSync(existingAncestor)) {
    const parent = path.dirname(existingAncestor);
    if (parent === existingAncestor) return null;
    existingAncestor = parent;
  }
  let realAncestor;
  try {
    realAncestor = fs.realpathSync(existingAncestor);
  } catch {
    return null;
  }
  if (!isInside(root, realAncestor)) return null;

  try {
    const realFile = fs.realpathSync(candidate);
    return isInside(root, realFile) ? realFile : null;
  } catch {
    return candidate;
  }
}

function readStaticFile(rootPath, requestPath, encoding) {
  const filePath = resolveStaticPath(rootPath, requestPath);
  if (!filePath) return { status: "forbidden" };

  let descriptor;
  try {
    const flags = fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0);
    descriptor = fs.openSync(filePath, flags);
    if (!fs.fstatSync(descriptor).isFile()) return { status: "not-found" };
    return { status: "ok", filePath, content: fs.readFileSync(descriptor, encoding) };
  } catch (error) {
    if (error && ["ENOENT", "ENOTDIR", "ELOOP", "EACCES"].includes(error.code)) {
      return { status: error.code === "EACCES" ? "forbidden" : "not-found" };
    }
    throw error;
  } finally {
    if (descriptor !== undefined) fs.closeSync(descriptor);
  }
}

module.exports = { resolveStaticPath, readStaticFile };
