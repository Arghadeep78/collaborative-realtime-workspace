import { Tldraw, DefaultColorStyle, createShapeId } from '@tldraw/tldraw';
try {
  DefaultColorStyle.validate("#123456");
  console.log("Validated!");
} catch (e) {
  console.log("Validation failed:", e.message);
}
