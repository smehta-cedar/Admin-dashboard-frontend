"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { GHOST_BUTTON_CLASS, INPUT_CLASS, PRIMARY_BUTTON_CLASS } from "@/components/classes";
import { Field } from "@/components/field";
import {
  MAX_QUANTITY,
  TEE,
  TEE_COLORS,
  TEE_SIZES,
  colorLabel,
  validateOrder,
  type OrderError,
  type OrderValues,
} from "@/lib/shop";
import { placeOrder, type PlaceOrderResult } from "./actions";

/*
 * The shop in two steps, then a confirmation:
 *
 *   choose  – the tee, its color, size and quantity. Checkout keeps the pick.
 *   details – name, email, phone and shipping address. Submit files the order
 *             through the server action; the same `validateOrder` runs here
 *             first so a typo is caught before the round trip.
 *   done    – the office has the request and will be in touch. No email is
 *             sent; the office follows up by hand from the HR page.
 *
 * The selection is state on this component, so going back from details to
 * choose and forward again loses nothing. No payment and no login anywhere.
 */

type Step = "choose" | "details" | "done";

type Selection = Pick<OrderValues, "size" | "color" | "quantity">;

const DEFAULT_SELECTION: Selection = { size: "M", color: "teal", quantity: 1 };

export function ShopView() {
  const [step, setStep] = useState<Step>("choose");
  const [selection, setSelection] = useState<Selection>(DEFAULT_SELECTION);
  const [placedEmail, setPlacedEmail] = useState<string | null>(null);

  if (step === "done" && placedEmail !== null) {
    return <Confirmation selection={selection} email={placedEmail} />;
  }

  return (
    <div className="grid gap-8 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:items-start">
      <TeePreview color={selection.color} />
      <div>
        {step === "choose" ? (
          <ChooseStep
            selection={selection}
            onChange={setSelection}
            onCheckout={() => setStep("details")}
          />
        ) : (
          <DetailsStep
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
  );
}

/** The tee, filled in the chosen color, with the pinecone mark on the chest. */
function TeePreview({ color }: { color: string }) {
  const fill = TEE_COLORS.find((candidate) => candidate.id === color)?.hex ?? "#ffffff";
  return (
    <div className="relative mx-auto w-full max-w-sm rounded-lg border border-line bg-surface-muted p-6">
      <svg
        aria-hidden="true"
        viewBox="0 0 200 200"
        className="block w-full text-line-strong"
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
        <BrandLogo compact height={44} />
      </div>
    </div>
  );
}

const SWATCH_BASE =
  "size-8 rounded-full border-2 ring-offset-2 ring-offset-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand";

type ChooseStepProps = {
  selection: Selection;
  onChange: (selection: Selection) => void;
  onCheckout: () => void;
};

function ChooseStep({ selection, onChange, onCheckout }: ChooseStepProps) {
  const id = useId();
  const set = <K extends keyof Selection>(key: K, value: Selection[K]) =>
    onChange({ ...selection, [key]: value });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-fg">{TEE.name}</h1>
      <p className="mt-1 text-xl font-medium text-fg">{TEE.priceLabel}</p>
      <p className="mt-3 text-sm text-fg-muted">{TEE.description}</p>

      <fieldset className="mt-6">
        <legend className="text-sm font-medium text-fg">
          Color: <span className="font-normal text-fg-muted">{colorLabel(selection.color)}</span>
        </legend>
        <div className="mt-2 flex gap-3">
          {TEE_COLORS.map((color) => {
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
          {TEE_SIZES.map((size) => {
            const selected = size === selection.size;
            return (
              <button
                key={size}
                type="button"
                aria-pressed={selected}
                onClick={() => set("size", size)}
                className={`min-w-12 rounded-md border px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                  selected
                    ? "border-brand-strong bg-brand-soft text-brand-ink"
                    : "border-line-strong text-fg-muted hover:bg-surface-hover hover:text-fg"
                }`}
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
          max={MAX_QUANTITY}
          value={selection.quantity}
          onChange={(event) => {
            const next = Number(event.target.value);
            set("quantity", Number.isInteger(next) ? Math.min(Math.max(next, 1), MAX_QUANTITY) : 1);
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
  selection: Selection;
  onBack: () => void;
  onPlaced: (email: string) => void;
};

function DetailsStep({ selection, onBack, onPlaced }: DetailsStepProps) {
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

    const clientError = validateOrder(values);
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
      <h1 className="text-2xl font-semibold text-fg">Your details</h1>
      <p className="mt-1 text-sm text-fg-muted">
        {TEE.name} · {colorLabel(selection.color)} · {selection.size} · Qty {selection.quantity} ·{" "}
        {TEE.priceLabel} each
      </p>

      {/* A selection error can only come from the server; it has no field on this step. */}
      {error && ["color", "size", "quantity"].includes(error.field) ? (
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
  selection: Selection;
  email: string;
};

function Confirmation({ selection, email }: ConfirmationProps) {
  return (
    <div className="mx-auto max-w-lg rounded-lg border border-line bg-surface p-6 text-center sm:p-8">
      <div className="flex justify-center">
        <BrandLogo compact height={48} />
      </div>
      <h1 className="mt-4 text-2xl font-semibold text-fg">Request received</h1>
      <p className="mt-2 text-sm text-fg-muted">
        {TEE.name} · {colorLabel(selection.color)} · {selection.size} · Qty {selection.quantity}
      </p>
      <p className="mt-4 text-sm text-fg">
        The office has your request and will be in touch at <span className="font-medium">{email}</span>{" "}
        to confirm it.
      </p>
    </div>
  );
}
