// word.js：名字形状与保留字判定（只依赖原生 API）
export function shapeOk(name) {
  return typeof name === "string" && /^[a-z][a-z0-9]*$/.test(name);
}

export function isReserved(words, name) {
  return Array.isArray(words) && words.indexOf(name) !== -1;
}
