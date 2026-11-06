export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
export function validObjectId(value) {
  return /^[a-f\\d]{24}$/i.test(String(value));
}
export function cleanText(value, max = 300) {
  return String(value ?? '').trim().slice(0, max);
}
