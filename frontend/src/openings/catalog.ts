import data from './data.json';
import { buildIndex } from './model';
import type { Opening } from './import';

export const openings: Opening[] = data.openings;
export const source = data.source;
export const openingIndex = buildIndex(openings);

// One catalog entry per confirmed source family; keep every selected continuation.
export const catalog = [...new Set(openings.map(opening => opening.name.split(':')[0]))].map(family => {
  const variants = openings.filter(opening => opening.name.split(':')[0] === family);
  return { family, name: family === "Queen's Gambit Declined" ? "Queen's Gambit (Declined)" : family,
    eco: [...new Set(variants.map(opening => opening.eco))].join(', '), variants };
});
