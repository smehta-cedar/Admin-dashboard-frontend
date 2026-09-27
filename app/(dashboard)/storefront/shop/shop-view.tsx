"use client";

import { useId, useMemo, useState, useTransition, type FormEvent } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { GHOST_BUTTON_CLASS, INPUT_CLASS, PRIMARY_BUTTON_CLASS } from "@/components/classes";
import { Field } from "@/components/field";
import {
  PRODUCT_CATEGORIES,
  PRODUCT_TYPES,
  colorLabel,
  validateOrder,
  type OrderError,
  type OrderValues,
  type ProductRecord,
} from "@/lib/shop";
import { placeOrder, type PlaceOrderResult } from "./actions";

/*
 * The shop: a catalog, then two steps, then a confirmation.
 *
 *   catalog – every active product as a card, with a section nav (All,
 *             Womens, Mens, …) and a type nav (All types, Polos, Shirts, …)
 *             narrowing the grid. Picking a card opens it.
 *   choose  – the product's color, size and quantity, beside its picture
 *             (or the drawn tee). Checkout keeps the pick.
 *   details – name, email, phone and shipping address. Submit files the order
 *             through the server action; the same `validateOrder` runs here
 *             first so a typo is caught before the round trip.
 *   done    – the office has the request and will be in touch. No email is
 *             sent; the office follows up by hand from the HR page.
 *
 * The selection is state on this component, so going back and forward loses
 * nothing. No payment: the office settles that with the buyer. The page
 * header carries the h1, so the steps head with h2.
 */

type Step = "catalog" | "choose" | "details" | "done";

type Selection = Pick<OrderValues, "productId" | "size" | "color" | "quantity">;

/** A product with its first colour and size. */
const defaultSelection = (product: ProductRecord): Selection => ({
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
  const [selection, setSelection] = useState<Selection | null>(null);
  const [placedEmail, setPlacedEmail] = useState<string | null>(null);

  const product = selection ? products.find((candidate) => candidate.id === selection.productId) : undefined;

  if (step === "done" && product && selection && placedEmail !== null) {
    return <Confirmation product={product} selection={selection} email={placedEmail} />;
  }

  if (step === "catalog" || !product || !selection) {
    return (
      <Catalog
        products={products}
        onPick={(picked) => {
          setSelection(defaultSelection(picked));
          setStep("choose");
        }}
      />
    );
  }

  return (
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
        <div>
          {step === "choose" ? (
            <ChooseStep
              product={product}
              selection={selection}
              onChange={setSelection}
              onCheckout={() => setStep("details")}
            />
          ) : (
            <DetailsStep
              product={product}
              selection={selection}
              onBack={() => setStep("choose")}
              onPlaced={(email) => {
                setPlacedEmail(email);
                setStep("done");
              }}
            />
          )}
        </div>
      </div>
    </div>
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
        Pick something, choose its colour and size, and the office will confirm your order by email.
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
                className="group block w-full rounded-lg border border-line bg-surface text-left shadow-sm hover:border-brand-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
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
  selection: Selection;
  onChange: (selection: Selection) => void;
  onCheckout: () => void;
};

function ChooseStep({ product, selection, onChange, onCheckout }: ChooseStepProps) {
  const id = useId();
  const set = <K extends keyof Selection>(key: K, value: Selection[K]) =>
    onChange({ ...selection, [key]: value });

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

      <button type="button" onClick={onCheckout} className={`${PRIMARY_BUTTON_CLASS} mt-8 w-full sm:w-auto`}>
        Checkout
      </button>
      <p className="mt-3 text-xs text-fg-subtle">
        No payment online. The office confirms your request by email and arranges payment and pickup or
        shipping with you.
      </p>
    </div>
  );
}

type DetailsStepProps = {
  product: ProductRecord;
  selection: Selection;
  onBack: () => void;
  onPlaced: (email: string) => void;
};

function DetailsStep({ product, selection, onBack, onPlaced }: DetailsStepProps) {
  const id = useId();
  const [error, setError] = useState<OrderError | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const text = (field: string) => String(data.get(field) ?? "").trim();
    const values: OrderValues = {
      ...selection,
      buyerName: text("buyerName"),
      email: text("email"),
      phone: text("phone"),
      address: text("address"),
    };

    const clientError = validateOrder(values, product);
    if (clientError) {
      setError(clientError);
      return;
    }

    setError(null);
    setFailed(false);
    startTransition(async () => {
      let result: PlaceOrderResult;
      try {
        result = await placeOrder(values);
      } catch {
        setFailed(true);
        return;
      }
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onPlaced(values.email);
    });
  };

  const errorProps = (field: OrderError["field"]) =>
    error?.field === field
      ? { "aria-invalid": true as const, "aria-describedby": `${id}-${field}-error` }
      : {};
  const hint = (field: OrderError["field"]) =>
    error?.field === field ? { hint: error.message, hintId: `${id}-${field}-error`, error: true } : {};

  return (
    <form onSubmit={handleSubmit} noValidate>
      <h2 className="text-2xl font-semibold text-fg">Your details</h2>
      <p className="mt-1 text-sm text-fg-muted">
        {product.name} · {colorLabel(product, selection.color)} · {selection.size} · Qty {selection.quantity} ·{" "}
        {product.priceLabel} each
      </p>

      {/* A selection error can only come from the server; it has no field on this step. */}
      {error && ["productId", "color", "size", "quantity"].includes(error.field) ? (
        <p role="alert" className="mt-4 text-sm text-danger">
          {error.message} Go back and choose again.
        </p>
      ) : null}

      <div className="mt-6 space-y-4">
        <Field label="Full name" htmlFor={`${id}-buyerName`} {...hint("buyerName")}>
          <input
            id={`${id}-buyerName`}
            name="buyerName"
            type="text"
            required
            autoComplete="name"
            autoFocus
            className={INPUT_CLASS}
            {...errorProps("buyerName")}
          />
        </Field>
        <Field label="Email" htmlFor={`${id}-email`} {...hint("email")}>
          <input
            id={`${id}-email`}
            name="email"
            type="email"
            required
            autoComplete="email"
            className={INPUT_CLASS}
            {...errorProps("email")}
          />
        </Field>
        <Field label="Phone" htmlFor={`${id}-phone`} {...hint("phone")}>
          <input
            id={`${id}-phone`}
            name="phone"
            type="tel"
            required
            autoComplete="tel"
            className={INPUT_CLASS}
            {...errorProps("phone")}
          />
        </Field>
        <Field label="Shipping address" htmlFor={`${id}-address`} {...hint("address")}>
          <textarea
            id={`${id}-address`}
            name="address"
            required
            rows={3}
            autoComplete="street-address"
            placeholder={"Street\nCity, State ZIP"}
            className={INPUT_CLASS}
            {...errorProps("address")}
          />
        </Field>
      </div>

      {/* Stays mounted so the message is announced when it appears. */}
      <p role="alert" className="mt-4 min-h-4 text-xs text-danger">
        {failed ? "Something went wrong and the order was not filed. Please try again." : null}
      </p>

      <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
        <button type="button" onClick={onBack} disabled={pending} className={GHOST_BUTTON_CLASS}>
          Back
        </button>
        <button type="submit" disabled={pending} className={`${PRIMARY_BUTTON_CLASS} disabled:opacity-60`}>
          {pending ? "Placing order…" : "Place order"}
        </button>
      </div>
    </form>
  );
}

type ConfirmationProps = {
  product: ProductRecord;
  selection: Selection;
  email: string;
};

function Confirmation({ product, selection, email }: ConfirmationProps) {
  return (
    <div className="mx-auto max-w-lg rounded-lg border border-line bg-surface p-6 text-center sm:p-8">
      <div className="flex justify-center">
        <BrandLogo compact height={48} />
      </div>
      <h2 className="mt-4 text-2xl font-semibold text-fg">Request received</h2>
      <p className="mt-2 text-sm text-fg-muted">
        {product.name} · {colorLabel(product, selection.color)} · {selection.size} · Qty {selection.quantity}
      </p>
      <p className="mt-4 text-sm text-fg">
        The office has your request and will be in touch at <span className="font-medium">{email}</span>{" "}
        to confirm it.
      </p>
    </div>
  );
}
