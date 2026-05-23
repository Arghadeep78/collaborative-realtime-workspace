import { NoteShapeUtil } from 'tldraw';

export class FixedNoteShapeUtil extends NoteShapeUtil {
  // Override to prevent font shrinking — always return fontSizeAdjustment: 1
  // so the note grows vertically instead of shrinking text to fit horizontally.
  measureNoteLabelSize(shape) {
    const result = super.measureNoteLabelSize(shape);
    return { ...result, fontSizeAdjustment: 1 };
  }
}
