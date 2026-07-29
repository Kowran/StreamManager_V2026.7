export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 60);
}

export function buildProductUrl(name: string, id: string): string {
  const slug = slugify(name);
  if (!slug) return `/product/${id}`;
  return `/product/${slug}-${id}`;
}

export function parseProductIdFromUrl(path: string): string | null {
  const rest = path.replace(/^product\//, '');
  if (!rest) return null;
  const uuidMatch = rest.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i);
  if (uuidMatch) return uuidMatch[1];
  return rest;
}
