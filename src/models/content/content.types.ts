// A content section is described ONCE by a spec. The API validates saves against it,
// the admin generates its edit form from it, and the website reads the merged result.
// Adding a new editable block = adding a spec; no new endpoint, form or table.

export interface TextField {
  type: 'text' | 'textarea';
  key: string;
  label: string;
  hint?: string;
  /** Max characters. Defaults: text 200, textarea 2000. */
  max?: number;
  required?: boolean;
}
interface ImageField {
  type: 'image';
  key: string;
  label: string;
  hint?: string;
}
interface ListField {
  type: 'list';
  key: string;
  label: string;
  hint?: string;
  /** What one entry is called in the UI: "Add <itemLabel>". */
  itemLabel: string;
  max: number;
  fields: Field[];
}
export type Field = TextField | ImageField | ListField;

export interface SectionSpec {
  key: string;
  title: string;
  description?: string;
  fields: Field[];
  /** What the website shows until the owner edits the section. Same wording as the design prototype. */
  defaults: Record<string, unknown>;
}
export interface PageSpec {
  key: string;
  title: string;
  sections: SectionSpec[];
}
