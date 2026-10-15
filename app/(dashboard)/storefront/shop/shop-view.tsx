"use client";

import { useId, useMemo, useState, useTransition } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { INPUT_CLASS, PRIMARY_BUTTON_CLASS } from "@/components/classes";
import { Field } from "@/components/field";
import { ModalDialog, useModalDialog } from "@/components/modal-dialog";
import { useRequestsStore } from "@/components/requests-store";
import {
  PRODUCT_CATEGORIES,
  PRODUCT_TYPES,
  colorLabel,
  validateSelection,
  type ProductRecord,
  type SelectionError,
  type SelectionValues,
} from "@/lib/shop";
import { placeOrder, type PlaceOrderResult } from "./actions";

/*
 * The shop: a catalog, then a choose step. Checkout files a pending merch
 * request and shows a confirmation popup; dismiss it to return to the catalog.
 *
 *   catalog – every active product as a card, with a section nav (All,
 *             Womens, Mens, …) and a type nav (All types, Polos, Shirts, …)
 *             narrowing the grid. Picking a card opens it.
 *   choose  – the product's color, size and quantity, beside its picture
 *             (or the drawn tee). Checkout files a pending merch request
 *             for the office; buyer contact comes from the signed-in user.
 *
 * The selection is state on this component, so going back and forward loses
 * nothing. No payment: the office settles that with the buyer. The page
 * header carries the h1, so the steps head with h2.
 */

type Step = "catalog" | "choose";

type PlacedOrder = {
  product: ProductRecord;
  selection: SelectionValues;
  email: string;
};

/** A product with its first colour and size. */
const defaultSelection = (product: ProductRecord): SelectionValues => ({
  productId: product.id,
  size: product.sizes[0] ?? "",
  color: product.colors[0]?.id ?? "",
  quantity: 1,
});

type ShopViewProps = {
  /** The active products, at least one. */
  products: ProductRecord[];
};

export function ShopView({ products }: ShopViewProps) {
  const [step, setStep] = useState<Step>("catalog");
  const [selection, setSelection] = useState<SelectionValues | null>(null);
  const [placed, setPlaced] = useState<PlacedOrder | null>(null);

  const product = selection ? products.find((candidate) => candidate.id === selection.productId) : undefined;

  const dismissPlaced = () => {
    setPlaced(null);
    setSelection(null);
    setStep("catalog");
  };

  return (
    <>
      {step === "catalog" || !product || !selection ? (
        <Catalog
          products={products}
          onPick={(picked) => {
            setSelection(defaultSelection(picked));
            setStep("choose");
          }}
        />
      ) : (
        <div>
          <button
            type="button"
            onClick={() => setStep("catalog")}
            className="mb-4 text-sm font-medium text-fg-muted hover:text-fg hover:underline"
          >
            <span aria-hidden="true">← </span>All products
          </button>
          <div className="grid gap-8 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:items-start">
            <ProductPicture product={product} color={selection.color} />
            <ChooseStep
              product={product}
              selection={selection}
              onChange={setSelection}
              onPlaced={(email) => setPlaced({ product, selection, email })}
            />
          </div>
        </div>
      )}
      <RequestReceivedDialog placed={placed} onClose={dismissPlaced} />
    </>
  );
}

const NAV_PILL =
  "rounded-full border px-3 py-1 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
const NAV_ON = "border-brand-strong bg-brand-soft text-brand-ink";
const NAV_OFF = "border-line-strong text-fg-muted hover:bg-surface-hover hover:text-fg";

type CatalogProps = {
  products: ProductRecord[];
  onPick: (product: ProductRecord) => void;
};

/** The product grid with its section and type navs. Only sections and types that have products show. */
function Catalog({ products, onPick }: CatalogProps) {
  const [category, setCategory] = useState("");
  const [type, setType] = useState("");

  const categories = useMemo(
    () => PRODUCT_CATEGORIES.filter((option) => products.some((product) => product.category === option.id)),
    [products],
  );
  const types = useMemo(
    () => PRODUCT_TYPES.filter((option) => products.some((product) => product.productType === option.id)),
    [products],
  );
  const shown = products.filter(
    (product) => (!category || product.category === category) && (!type || product.productType === type),
  );

  return (
    <div>
      <h2 className="text-2xl font-semibold text-fg">Catalog</h2>
      <p className="mt-1 text-sm text-fg-muted">
        Pick something, choose its colour and size, and Checkout sends a request to the office.
      </p>

      {categories.length > 0 ? (
        <nav aria-label="Sections" className="mt-5 flex flex-wrap gap-2">
          <button type="button" aria-pressed={category === ""} onClick={() => setCategory("")} className={`${NAV_PILL} ${category === "" ? NAV_ON : NAV_OFF}`}>
            All products
          </button>
          {categories.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={category === option.id}
              onClick={() => setCategory(option.id)}
              className={`${NAV_PILL} ${category === option.id ? NAV_ON : NAV_OFF}`}
            >
              {option.label}
            </button>
          ))}
        </nav>
      ) : null}
      {types.length > 0 ? (
        <nav aria-label="Types" className="mt-3 flex flex-wrap gap-2">
          <button type="button" aria-pressed={type === ""} onClick={() => setType("")} className={`${NAV_PILL} ${type === "" ? NAV_ON : NAV_OFF}`}>
            All types
          </button>
          {types.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={type === option.id}
              onClick={() => setType(option.id)}
              className={`${NAV_PILL} ${type === option.id ? NAV_ON : NAV_OFF}`}
            >
              {option.label}
            </button>
          ))}
        </nav>
      ) : null}

      {shown.length === 0 ? (
        <p className="mt-8 text-sm text-fg-subtle">Nothing here yet. Try another section.</p>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((product) => (
            <li key={product.id}>
              <button
                type="button"
                onClick={() => onPick(product)}
                className="group block w-full rounded-lg border glass text-left shadow-sm hover:border-brand-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <div className="aspect-square overflow-hidden rounded-t-lg bg-surface-muted">
                  <ProductPicture product={product} color={product.colors[0]?.id ?? ""} thumbnail />
                </div>
                <div className="p-3">
                  <p className="font-medium text-fg group-hover:text-brand-ink">{product.name}</p>
                  <p className="mt-0.5 text-sm text-fg-muted">{product.priceLabel}</p>
                  <ul className="mt-2 flex gap-1" aria-label="Colours">
                    {product.colors.map((color) => (
                      <li
                        key={color.id}
                        title={color.label}
                        style={{ backgroundColor: color.hex }}
                        className="size-3.5 rounded-full border border-line-strong"
                      />
                    ))}
                  </ul>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type ProductPictureProps = {
  product: ProductRecord;
  color: string;
  /** Fills a card's square instead of the framed preview. */
  thumbnail?: boolean;
};

/** The product's picture when it has a link, else the tee drawn in the chosen colour with the pinecone mark. */
function ProductPicture({ product, color, thumbnail = false }: ProductPictureProps) {
  if (product.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={product.imageUrl}
        alt={product.name}
        className={
          thumbnail
            ? "size-full object-cover"
            : "mx-auto w-full max-w-sm rounded-lg border border-line bg-surface-muted object-cover"
        }
      />
    );
  }
  const fill = product.colors.find((candidate) => candidate.id === color)?.hex ?? "#ffffff";
  return (
    <div
      className={
        thumbnail
          ? "relative size-full p-4"
          : "relative mx-auto w-full max-w-sm rounded-lg border border-line bg-surface-muted p-6"
      }
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 200 200"
        className="block h-full w-full text-line-strong"
        fill={fill}
        stroke="currentColor"
        strokeWidth={2}
        strokeLinejoin="round"
      >
        <path d="M64 30 L36 44 L16 88 L48 100 L48 178 L152 178 L152 100 L184 88 L164 44 L136 30 C128 48 112 56 100 56 C88 56 72 48 64 30 Z" />
        {/* Collar rib, drawn a touch inside the neckline. */}
        <path d="M70 34 C78 50 90 58 100 58 C110 58 122 50 130 34" fill="none" />
      </svg>
      {/* Over the chest: the SVG is square, so percentages hold at any width. */}
      <div className="pointer-events-none absolute left-1/2 top-[44%] -translate-x-1/2">
        <BrandLogo compact height={thumbnail ? 28 : 44} />
      </div>
    </div>
  );
}

const SWATCH_BASE =
  "size-8 rounded-full border-2 ring-offset-2 ring-offset-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

const PICK_BASE =
  "rounded-md border px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";
const PICK_ON = "border-brand-strong bg-brand-soft text-brand-ink";
const PICK_OFF = "border-line-strong text-fg-muted hover:bg-surface-hover hover:text-fg";

type ChooseStepProps = {
  product: ProductRecord;
  selection: SelectionValues;
  onChange: (selection: SelectionValues) => void;
  onPlaced: (email: string) => void;
};

function ChooseStep({ product, selection, onChange, onPlaced }: ChooseStepProps) {
  const id = useId();
  const { appendRequest } = useRequestsStore();
  const [error, setError] = useState<SelectionError | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof SelectionValues>(key: K, value: SelectionValues[K]) =>
    onChange({ ...selection, [key]: value });

  const handleCheckout = () => {
    const clientError = validateSelection(selection, product);
    if (clientError) {
      setError(clientError);
      return;
    }

    setError(null);
    setFailed(false);
    startTransition(async () => {
      let result: PlaceOrderResult;
      try {
        result = await placeOrder(selection);
      } catch {
        setFailed(true);
        return;
      }
      if (!result.ok) {
        setError(result.error);
        return;
      }
      appendRequest(result.request);
      onPlaced(result.request.email);
    });
  };

  return (
    <div>
      <h2 className="text-2xl font-semibold text-fg">{product.name}</h2>
      <p className="mt-1 text-xl font-medium text-fg">{product.priceLabel}</p>
      {product.description ? <p className="mt-3 text-sm text-fg-muted">{product.description}</p> : null}

      <fieldset className="mt-6">
        <legend className="text-sm font-medium text-fg">
          Color: <span className="font-normal text-fg-muted">{colorLabel(product, selection.color)}</span>
        </legend>
        <div className="mt-2 flex flex-wrap gap-3">
          {product.colors.map((color) => {
            const selected = color.id === selection.color;
            return (
              <button
                key={color.id}
                type="button"
                aria-label={color.label}
                aria-pressed={selected}
                title={color.label}
                onClick={() => set("color", color.id)}
                style={{ backgroundColor: color.hex }}
                className={`${SWATCH_BASE} ${
                  selected ? "border-brand-strong ring-2 ring-brand-strong" : "border-line-strong"
                }`}
              />
            );
          })}
        </div>
      </fieldset>

      <fieldset className="mt-6">
        <legend className="text-sm font-medium text-fg">Size</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {product.sizes.map((size) => {
            const selected = size === selection.size;
            return (
              <button
                key={size}
                type="button"
                aria-pressed={selected}
                onClick={() => set("size", size)}
                className={`min-w-12 ${PICK_BASE} ${selected ? PICK_ON : PICK_OFF}`}
              >
                {size}
              </button>
            );
          })}
        </div>
      </fieldset>

      <Field label="Quantity" htmlFor={`${id}-quantity`} className="mt-6 max-w-28">
        <input
          id={`${id}-quantity`}
          type="number"
          inputMode="numeric"
          min={1}
          max={product.maxQuantity}
          value={selection.quantity}
          onChange={(event) => {
            const next = Number(event.target.value);
            set("quantity", Number.isInteger(next) ? Math.min(Math.max(next, 1), product.maxQuantity) : 1);
          }}
          className={INPUT_CLASS}
        />
      </Field>

      {error ? (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error.message}
        </p>
      ) : null}

      <p role="alert" className="mt-4 min-h-4 text-xs text-danger">
        {failed ? "Something went wrong and the order was not filed. Please try again." : null}
      </p>

      <button
        type="button"
        onClick={handleCheckout}
        disabled={pending}
        className={`${PRIMARY_BUTTON_CLASS} mt-4 w-full sm:w-auto disabled:opacity-60`}
      >
        {pending ? "Sending request…" : "Checkout"}
      </button>
      <p className="mt-3 text-xs text-fg-subtle">
        No payment online. Checkout sends a request to the office using your account details; they
        confirm by email and arrange payment and pickup or shipping with you.
      </p>
    </div>
  );
}

type RequestReceivedDialogProps = {
  placed: PlacedOrder | null;
  onClose: () => void;
};

/** Success popup after Checkout; OK / Escape / backdrop returns to the catalog. */
function RequestReceivedDialog({ placed, onClose }: RequestReceivedDialogProps) {
  const open = placed !== null;
  const { dialogRef, close } = useModalDialog(open);
  const titleId = useId();

  return (
    <ModalDialog
      dialogRef={dialogRef}
      labelledBy={titleId}
      onClose={onClose}
      className="max-w-md overflow-y-auto"
    >
      {placed ? (
        <div className="p-6">
          <h2 id={titleId} className="text-base font-semibold text-fg">
            Request received
          </h2>
          <p className="mt-1 text-sm text-fg-muted">
            {placed.product.name} · {colorLabel(placed.product, placed.selection.color)} ·{" "}
            {placed.selection.size} · Qty {placed.selection.quantity}
          </p>
          <p className="mt-3 text-sm text-fg">
            The office has your request and will be in touch at{" "}
            <span className="font-medium">{placed.email}</span> to confirm it.
          </p>
          <div className="mt-5 flex justify-end">
            <button type="button" onClick={close} className={PRIMARY_BUTTON_CLASS} autoFocus>
              OK
            </button>
          </div>
        </div>
      ) : null}
    </ModalDialog>
  );
}
