"use client";

import { useId, useState, type FormEvent } from "react";
import { GHOST_BUTTON_CLASS, INPUT_CLASS, PRIMARY_BUTTON_CLASS } from "@/components/classes";
import { Field } from "@/components/field";
import { ModalDialog, useModalDialog } from "@/components/modal-dialog";
import {
  COLOR_PRESETS,
  PRODUCT_CATEGORIES,
  PRODUCT_TYPES,
  type ProductColor,
  type ProductRecord,
} from "@/lib/shop";
import type { ProductError, ProductField, ProductValues } from "@/lib/storefront";

/*
 * The one Add / Edit product dialog: name, description, category and type
 * (the shop's nav), a picture link, price, colours, sizes, the most one
 * order may ask for, and whether the shop lists it. The Storefront page
 * opens it from Add product and a row's Edit.
 *
 * Colours are picked, not typed: a grid of the preset colours (lib/shop.ts)
 * where one click adds a colour and another removes it, with a small row for
 * a custom colour the grid lacks. Sizes are a comma list.
 *
 * The view passes `onSave`, which calls the saveProduct server action
 * (./actions.ts) and updates its own state from the saved record. The API
 * checks the name against other products and needs at least one colour and
 * one size.
 */

/** Which dialog is open. Edit holds the product as it was when the dialog opened. */
export type ProductEditor = { mode: "add" } | { mode: "edit"; product: ProductRecord };

export type { ProductError, ProductValues } from "@/lib/storefront";

/** Also the order changes are listed in on a note. */
export const PRODUCT_FIELD_LABELS: Record<ProductField, string> = {
  name: "Name",
  description: "Description",
  category: "Category",
  productType: "Type",
  imageUrl: "Picture link",
  price: "Price",
  colors: "Colours",
  sizes: "Sizes",
  maxQuantity: "Max per order",
  status: "Status",
};

/** "Forest Green" -> "forest-green": a custom colour's id from its label. */
const slug = (label: string) => label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

type ProductDialogProps = {
  /** Null keeps the dialog closed. */
  editor: ProductEditor | null;
  /** Saves the values; resolves with the errors to show instead of closing. */
  onSave: (values: ProductValues) => Promise<ProductError[]>;
  /** Runs for every close: Cancel, Escape, backdrop click, or a save. */
  onClose: () => void;
};

export function ProductDialog({ editor, onSave, onClose }: ProductDialogProps) {
  const { dialogRef, close } = useModalDialog(editor !== null);
  const id = useId();

  // Clearing the editor unmounts the form, which resets it.
  return (
    <ModalDialog dialogRef={dialogRef} labelledBy={`${id}-title`} onClose={onClose}>
      {editor ? <ProductForm id={id} editor={editor} onSave={onSave} close={close} /> : null}
    </ModalDialog>
  );
}

type ColorPickerProps = {
  id: string;
  colors: ProductColor[];
  onChange: (colors: ProductColor[]) => void;
  error: string | null;
};

/**
 * A grid of every preset colour: click one to add it, click again to remove
 * it. A custom colour the presets don't have is added from the small row
 * under the grid and then sits in the grid like the others.
 */
function ColorPicker({ id, colors, onChange, error }: ColorPickerProps) {
  const [customLabel, setCustomLabel] = useState("");
  const [customHex, setCustomHex] = useState("#37b38f");
  const [customError, setCustomError] = useState<string | null>(null);

  const has = (colorId: string) => colors.some((color) => color.id === colorId);
  const toggle = (color: ProductColor) =>
    onChange(has(color.id) ? colors.filter((chosen) => chosen.id !== color.id) : [...colors, color]);

  // The presets, plus any chosen colour that isn't one (a custom one), so it shows too.
  const options = [...COLOR_PRESETS, ...colors.filter((color) => !COLOR_PRESETS.some((preset) => preset.id === color.id))];

  const addCustom = () => {
    const label = customLabel.trim();
    if (!label) {
      setCustomError("Name the colour first.");
      return;
    }
    const colorId = slug(label);
    if (!colorId || has(colorId) || COLOR_PRESETS.some((preset) => preset.id === colorId)) {
      setCustomError(colorId && has(colorId) ? "That colour is already chosen." : colorId ? "That colour is in the grid; click it there." : "Use letters or numbers in the name.");
      return;
    }
    onChange([...colors, { id: colorId, label, hex: customHex.toLowerCase() }]);
    setCustomLabel("");
    setCustomError(null);
  };

  return (
    <fieldset className="min-w-0 sm:col-span-2">
      <legend className="text-sm font-medium text-fg">Colours</legend>
      <p className="mt-1 text-xs text-fg-subtle">
        Click a colour to offer it, click again to take it off.{" "}
        {colors.length === 0 ? "None chosen yet." : `Chosen: ${colors.map((color) => color.label).join(", ")}.`}
      </p>

      <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
        {options.map((color) => {
          const chosen = has(color.id);
          return (
            <button
              key={color.id}
              type="button"
              aria-pressed={chosen}
              onClick={() => toggle(color)}
              className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                chosen ? "border-brand-strong bg-brand-soft text-brand-ink" : "border-line text-fg-muted hover:bg-surface-hover hover:text-fg"
              }`}
            >
              <span
                aria-hidden="true"
                style={{ backgroundColor: color.hex }}
                className="inline-block size-5 shrink-0 rounded-full border border-line-strong"
              />
              <span className="min-w-0 truncate">{color.label}</span>
              {chosen ? (
                <span aria-hidden="true" className="ml-auto text-xs">
                  ✓
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* A colour the grid doesn't have. */}
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <Field
          label="Need another colour?"
          htmlFor={`${id}-custom-label`}
          hint={customError ?? "Name it, pick the shade, press Add."}
          hintId={`${id}-custom-hint`}
          error={customError !== null}
          className="min-w-48 flex-1"
        >
          <div className="mt-1 flex items-stretch gap-2">
            <input
              id={`${id}-custom-label`}
              type="text"
              value={customLabel}
              placeholder="e.g. Sage"
              autoComplete="off"
              aria-invalid={customError ? true : undefined}
              aria-describedby={`${id}-custom-hint`}
              onChange={(event) => {
                setCustomLabel(event.target.value);
                setCustomError(null);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addCustom();
                }
              }}
              className={`${INPUT_CLASS} mt-0! min-w-0 flex-1`}
            />
            <input
              type="color"
              value={customHex}
              aria-label="Shade of the new colour"
              title="Pick the shade"
              onChange={(event) => setCustomHex(event.target.value)}
              className="h-9 w-11 shrink-0 cursor-pointer rounded-md border border-line-strong bg-surface p-0.5"
            />
            <button type="button" onClick={addCustom} className={`${GHOST_BUTTON_CLASS} shrink-0 border border-line-strong`}>
              Add
            </button>
          </div>
        </Field>
      </div>

      {error ? (
        <p id={`${id}-colors-error`} className="mt-1 text-xs text-danger">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

type ProductFormProps = Omit<ProductDialogProps, "editor" | "onClose"> & {
  id: string;
  editor: ProductEditor;
  close: () => void;
};

/** The dialog's form. Mounted per open, so its errors start clear each time. */
function ProductForm({ id, editor, onSave, close }: ProductFormProps) {
  const editing = editor.mode === "edit" ? editor.product : undefined;
  const [errors, setErrors] = useState<ProductError[]>([]);
  const [saving, setSaving] = useState(false);
  const [colors, setColors] = useState<ProductColor[]>(editing?.colors ?? []);
  const [imageUrl, setImageUrl] = useState(editing?.imageUrl ?? "");

  const messageFor = (field: ProductError["field"]) =>
    errors.find((error) => error.field === field)?.message ?? null;
  const clear = (field: ProductError["field"]) =>
    setErrors((current) => current.filter((error) => error.field !== field));

  const formError = messageFor("form") ?? messageFor("status");

  /** Label, input and error wiring for one field. */
  const fieldProps = (field: ProductField, fallbackHint?: string) => {
    const message = messageFor(field);
    return {
      field: {
        hint: message ?? fallbackHint,
        hintId: `${id}-${field}-hint`,
        error: message !== null,
      },
      input: {
        "aria-invalid": message ? (true as const) : undefined,
        "aria-describedby": message || fallbackHint ? `${id}-${field}-hint` : undefined,
        onChange: () => clear(field),
      },
    };
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    const data = new FormData(event.currentTarget);
    const text = (field: string) => String(data.get(field) ?? "").trim();

    if (colors.length === 0) {
      setErrors([{ field: "colors", message: "Add at least one colour." }]);
      return;
    }
    const price = Number(text("price"));
    if (!Number.isFinite(price) || price < 0) {
      setErrors([{ field: "price", message: "Enter a price in dollars." }]);
      return;
    }
    const values: ProductValues = {
      name: text("name"),
      description: text("description"),
      category: text("category"),
      productType: text("productType"),
      imageUrl: text("imageUrl"),
      price,
      colors,
      sizes: text("sizes")
        .split(",")
        .map((size) => size.trim())
        .filter(Boolean),
      maxQuantity: Math.max(1, Number(text("maxQuantity")) || 1),
      status: text("status") === "inactive" ? "inactive" : "active",
    };
    setSaving(true);
    try {
      const saveErrors = await onSave(values);
      if (saveErrors.length > 0) {
        setErrors(saveErrors);
        return;
      }
      close();
    } finally {
      setSaving(false);
    }
  };

  const name = fieldProps("name");
  const description = fieldProps("description");
  const category = fieldProps("category", "The section of the shop it is listed under.");
  const productType = fieldProps("productType");
  const image = fieldProps("imageUrl", "A link to a picture (https://…). Left blank, the shop draws a tee.");
  const price = fieldProps("price", "Dollars, e.g. 28 or 28.50.");
  const sizes = fieldProps("sizes", "Separated by commas, in the order the shop shows them.");
  const maxQuantity = fieldProps("maxQuantity", "The most one order may ask for.");

  return (
    <form onSubmit={handleSubmit} className="p-6">
      <h2 id={`${id}-title`} className="text-base font-semibold text-fg">
        {editing ? `Edit ${editing.name}` : "Add product"}
      </h2>
      <p className="mt-1 text-sm text-fg-muted">
        {editing
          ? "Saving records a note of what changed. The shop shows the change at once."
          : "The product is added for everyone and listed in the shop while active."}
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor={`${id}-name`} className="sm:col-span-2" {...name.field}>
          <input
            id={`${id}-name`}
            name="name"
            type="text"
            required
            pattern=".*\S.*"
            autoComplete="off"
            defaultValue={editing?.name}
            className={INPUT_CLASS}
            {...name.input}
          />
        </Field>
        <Field label="Description" optional htmlFor={`${id}-description`} className="sm:col-span-2" {...description.field}>
          <textarea
            id={`${id}-description`}
            name="description"
            rows={3}
            defaultValue={editing?.description}
            className={`${INPUT_CLASS} resize-y`}
            {...description.input}
          />
        </Field>

        <Field label="Category" optional htmlFor={`${id}-category`} {...category.field}>
          <select id={`${id}-category`} name="category" defaultValue={editing?.category ?? ""} className={INPUT_CLASS} {...category.input}>
            <option value="">No section (All products only)</option>
            {PRODUCT_CATEGORIES.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Type" optional htmlFor={`${id}-type`} {...productType.field}>
          <select id={`${id}-type`} name="productType" defaultValue={editing?.productType ?? ""} className={INPUT_CLASS} {...productType.input}>
            <option value="">No type</option>
            {PRODUCT_TYPES.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Picture link" optional htmlFor={`${id}-image`} className="sm:col-span-2" {...image.field}>
          <div className="mt-1 flex items-start gap-3">
            <input
              id={`${id}-image`}
              name="imageUrl"
              type="url"
              autoComplete="off"
              placeholder="https://…/tee.jpg"
              value={imageUrl}
              className={`${INPUT_CLASS} mt-0! min-w-0 flex-1`}
              {...image.input}
              onChange={(event) => {
                setImageUrl(event.target.value);
                clear("imageUrl");
              }}
            />
            {/* A live look at the link, so a wrong one shows before saving. */}
            {imageUrl.trim() ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl.trim()}
                alt=""
                className="size-16 shrink-0 rounded-md border border-line bg-surface-muted object-cover"
              />
            ) : null}
          </div>
        </Field>

        <Field label="Price" htmlFor={`${id}-price`} {...price.field}>
          <input
            id={`${id}-price`}
            name="price"
            type="number"
            required
            min={0}
            step="0.01"
            inputMode="decimal"
            defaultValue={editing?.price}
            className={INPUT_CLASS}
            {...price.input}
          />
        </Field>
        <Field label="Max per order" htmlFor={`${id}-max`} {...maxQuantity.field}>
          <input
            id={`${id}-max`}
            name="maxQuantity"
            type="number"
            required
            min={1}
            max={999}
            inputMode="numeric"
            defaultValue={editing?.maxQuantity ?? 10}
            className={INPUT_CLASS}
            {...maxQuantity.input}
          />
        </Field>

        <ColorPicker
          id={id}
          colors={colors}
          onChange={(next) => {
            setColors(next);
            clear("colors");
          }}
          error={messageFor("colors")}
        />

        <Field label="Sizes" htmlFor={`${id}-sizes`} className="sm:col-span-2" {...sizes.field}>
          <input
            id={`${id}-sizes`}
            name="sizes"
            type="text"
            required
            autoComplete="off"
            placeholder="S, M, L, XL"
            defaultValue={editing?.sizes.join(", ")}
            className={INPUT_CLASS}
            {...sizes.input}
          />
        </Field>
        <Field label="Status" htmlFor={`${id}-status`} hint="Only active products are listed in the shop." hintId={`${id}-status-hint`}>
          <select
            id={`${id}-status`}
            name="status"
            defaultValue={editing?.status ?? "active"}
            aria-describedby={`${id}-status-hint`}
            className={INPUT_CLASS}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </Field>
      </div>

      {/* Errors about the attempt itself (no permission, API down), not one field. */}
      <div role="alert" className="mt-4">
        {formError ? <p className="text-sm text-danger">{formError}</p> : null}
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={close} disabled={saving} className={GHOST_BUTTON_CLASS}>
          Cancel
        </button>
        <button type="submit" disabled={saving} className={`${PRIMARY_BUTTON_CLASS} disabled:opacity-60`}>
          {saving ? "Saving…" : editing ? "Save changes" : "Add product"}
        </button>
      </div>
    </form>
  );
}
