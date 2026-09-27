"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PRIMARY_BUTTON_CLASS, ROW_BUTTON_CLASS } from "@/components/classes";
import { DataTable, type DataTableColumn } from "@/components/data-table";
import { EditIcon } from "@/components/edit-icon";
import { EmptyState } from "@/components/empty-state";
import { NoteList } from "@/components/note-list";
import { PageHeader } from "@/components/page-header";
import { StatusBadge, statusRank } from "@/components/status-badge";
import { categoryLabel, typeLabel, type ProductRecord } from "@/lib/shop";
import type { ProductNote } from "@/lib/storefront";
import { byName } from "@/lib/text";
import { saveProduct } from "./actions";
import {
  PRODUCT_FIELD_LABELS,
  ProductDialog,
  type ProductEditor,
  type ProductError,
  type ProductValues,
} from "./product-dialog";

/*
 * Storefront: what the shop (/storefront/shop) sells. One row per product with
 * its picture, section and type, price, colours (as swatches), sizes and
 * whether the shop lists it;
 * clicking a name expands the row to show its change notes. Add product and
 * a row's Edit open the shared ProductDialog; saves go to the API through
 * the saveProduct server action, which records the notes and refreshes the
 * shop.
 */

type StorefrontViewProps = {
  initialProducts: ProductRecord[];
  /** Every product's notes, newest first. */
  notes: ProductNote[];
};

export function StorefrontView({ initialProducts, notes }: StorefrontViewProps) {
  const [products, setProducts] = useState(initialProducts);
  const [editor, setEditor] = useState<ProductEditor | null>(null);

  const columns = useMemo<DataTableColumn<ProductRecord>[]>(
    () => [
      {
        id: "actions",
        header: "Action",
        cell: (product) => (
          <button
            type="button"
            onClick={() => setEditor({ mode: "edit", product })}
            className={`inline-flex items-center gap-1.5 ${ROW_BUTTON_CLASS}`}
          >
            <EditIcon className="size-3.5 shrink-0" />
            <span className="sr-only"> {product.name}</span>
          </button>
        ),
      },
      {
        id: "picture",
        header: "Picture",
        srOnlyHeader: true,
        cell: (product) =>
          product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.imageUrl}
              alt=""
              className="size-10 rounded-md border border-line bg-surface-muted object-cover"
            />
          ) : (
            <span aria-hidden="true" className="inline-block size-10 rounded-md border border-dashed border-line-strong" />
          ),
        className: "w-14",
      },
      {
        id: "name",
        header: "Name",
        cell: (product, { expanded, toggleExpanded, detailsId }) => (
          <button
            type="button"
            onClick={toggleExpanded}
            aria-expanded={expanded}
            aria-controls={expanded ? detailsId : undefined}
            className="-ml-1 flex items-center gap-1 whitespace-nowrap rounded-md px-1 py-0.5 text-fg hover:bg-surface-hover"
          >
            {product.name}
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              className={`size-4 shrink-0 text-fg-subtle transition-transform ${expanded ? "rotate-90" : ""}`}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M8 5l5 5-5 5" />
            </svg>
          </button>
        ),
        sortValue: (product) => product.name,
        searchText: (product) => [product.name, product.description],
      },
      {
        id: "category",
        header: "Section",
        cell: (product) => (
          <span className={product.category ? undefined : "text-fg-faint"}>
            {categoryLabel(product.category) || "None"}
          </span>
        ),
        className: "whitespace-nowrap text-fg-muted",
        sortValue: (product) => categoryLabel(product.category),
        searchText: (product) => categoryLabel(product.category),
      },
      {
        id: "type",
        header: "Type",
        cell: (product) => (
          <span className={product.productType ? undefined : "text-fg-faint"}>
            {typeLabel(product.productType) || "None"}
          </span>
        ),
        className: "whitespace-nowrap text-fg-muted",
        sortValue: (product) => typeLabel(product.productType),
        searchText: (product) => typeLabel(product.productType),
      },
      {
        id: "price",
        header: "Price",
        cell: (product) => product.priceLabel,
        className: "whitespace-nowrap tabular-nums text-fg-muted",
        sortValue: (product) => product.price,
        searchText: (product) => product.priceLabel,
      },
      {
        id: "colors",
        header: "Colours",
        cell: (product) => (
          <ul className="flex flex-wrap items-center gap-1.5">
            {product.colors.map((color) => (
              <li key={color.id} className="flex items-center gap-1 text-xs text-fg-muted" title={color.hex}>
                <span
                  aria-hidden="true"
                  style={{ backgroundColor: color.hex }}
                  className="inline-block size-3.5 rounded-full border border-line-strong"
                />
                {color.label}
              </li>
            ))}
          </ul>
        ),
        searchText: (product) => product.colors.map((color) => color.label),
      },
      {
        id: "sizes",
        header: "Sizes",
        cell: (product) => product.sizes.join(", "),
        className: "whitespace-nowrap text-fg-muted",
        searchText: (product) => product.sizes,
      },
      {
        id: "maxQuantity",
        header: "Max per order",
        cell: (product) => product.maxQuantity,
        className: "tabular-nums text-fg-muted",
        sortValue: (product) => product.maxQuantity,
      },
      {
        id: "status",
        header: "Status",
        cell: (product) => <StatusBadge status={product.status} />,
        sortValue: (product) => statusRank(product.status),
        searchText: (product) => product.status,
      },
    ],
    [],
  );

  /** Adds or edits a product through the API. Resolves with the dialog's errors, if any. */
  const handleSave = async (values: ProductValues): Promise<ProductError[]> => {
    const editing = editor?.mode === "edit" ? editor.product : undefined;
    const result = await saveProduct(values, editing?.id);
    if (!result.ok) return result.errors;
    const saved = result.product;
    setProducts((current) =>
      (editing ? current.map((product) => (product.id === saved.id ? saved : product)) : [...current, saved]).sort(byName),
    );
    return [];
  };

  const addButton = (
    <button type="button" onClick={() => setEditor({ mode: "add" })} className={PRIMARY_BUTTON_CLASS}>
      Add product
    </button>
  );

  return (
    <>
      <PageHeader
        title="Storefront"
        description={
          <>
            What the shop sells.{" "}
            <Link href="/storefront/shop" className="text-brand-ink hover:underline">
              Open the shop<span aria-hidden="true"> →</span>
            </Link>
          </>
        }
        actions={addButton}
      />

      {products.length === 0 ? (
        <EmptyState
          title="No products yet"
          description="Add a product to list it in the shop."
          action={addButton}
        />
      ) : (
        <DataTable
          rows={products}
          columns={columns}
          getRowId={(product) => product.id}
          unit={["product", "products"]}
          renderDetails={(product) => (
            <section className="max-w-2xl">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">Notes</h3>
              <NoteList
                notes={notes.filter((note) => note.productId === product.id)}
                labels={PRODUCT_FIELD_LABELS}
              />
            </section>
          )}
        />
      )}

      <ProductDialog editor={editor} onSave={handleSave} onClose={() => setEditor(null)} />
    </>
  );
}
