import "server-only";
import { randomInt } from "node:crypto";
const characterGroups = [
  "ABCDEFGHJKLMNPQRSTUVWXYZ",
  "abcdefghijkmnopqrstuvwxyz",
  "23456789",
  "!@#$%^&*_-+",
];

function choose(group: string): string {
  return group[randomInt(group.length)];
}

export function generateTemporaryPassword(length = 20): string {
  const all = characterGroups.join("");
  const values = characterGroups.map(choose);
  while (values.length < length) values.push(choose(all));
  for (let index = values.length - 1; index > 0; index -= 1) {
    const target = randomInt(index + 1);
    [values[index], values[target]] = [values[target], values[index]];
  }
  return values.join("");
}
