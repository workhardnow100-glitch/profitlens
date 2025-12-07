
export function createPageUrl(pageName) {
  if (!pageName || typeof pageName !== "string") return "/";
  const slug = pageName.trim().toLowerCase();
  return `/${slug}`;
}
