// pages/forms/pdfs.js
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import Head from "next/head";

const fetcher = (url) => fetch(url).then((res) => res.json());

function groupType(type) {
  const t = (type || "").toLowerCase();
  if (t === "vat") return "vat";
  if (t.startsWith("sa")) return "sa";
  if (t.startsWith("ct")) return "ct";
  if (t.startsWith("cis")) return "cis";
  return "other";
}

function formatLabel(pdf) {
  const baseType = (pdf.type || "").toUpperCase();
  const year = pdf.tax_year || pdf.year || "";
  const period =
    pdf.period_start && pdf.period_end
      ? `${pdf.period_start} → ${pdf.period_end}`
      : "";
  const created = pdf.created_at
    ? new Date(pdf.created_at).toLocaleString()
    : "";
  const bits = [baseType, year, period].filter(Boolean).join(" — ");
  return created ? `${bits} (${created})` : bits;
}

export default function PdfLibraryPage() {
  const router = useRouter();
  const { clientId } = router.query;

  const { data: session, status } = useSession();

  // 🔑 Access control (subscription)
  useEffect(() => {
    if (status === "loading") return;

    if (!session?.user) {
      router.replace("/login");
      return;
    }

    const isAdmin = session.user.role === "admin";
    const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(
      session.user.subscriptionStatus
    );

    if (!(isAdmin || isSubscribedOrTrial)) {
      router.replace("/upgrade");
    }
  }, [session, status, router]);

  // If no client selected
  if (!clientId) {
    return (
      <div className="p-10 text-center text-gray-600">
        <h1 className="text-xl font-semibold mb-2">PDF Library</h1>
        <p>Please select a client first.</p>
      </div>
    );
  }

  const { data, error } = useSWR(
    `/api/pdfs?clientId=${clientId}`,
    fetcher
  );

  const isLoading = !data && !error;
  const pdfs = data?.pdfs || [];

  const grouped = useMemo(() => {
    const base = { vat: [], sa: [], ct: [], cis: [], other: [] };
    pdfs.forEach((pdf) => base[groupType(pdf.type)].push(pdf));
    return base;
  }, [pdfs]);

  const [selectedPdfId, setSelectedPdfId] = useState(null);

  useEffect(() => {
    if (!selectedPdfId && pdfs.length > 0) {
      setSelectedPdfId(pdfs[0].id);
    }
  }, [pdfs, selectedPdfId]);

  const selectedPdf = pdfs.find((p) => p.id === selectedPdfId) || null;

  return (
    <>
      <Head>
        <title>PDF Library | ProfitLens</title>
      </Head>

      <div className="flex h-full min-h-screen flex-col">
        <div className="flex flex-1">
          {/* LEFT PANEL */}
          <div className="w-full max-w-md border-r border-gray-200 p-6 space-y-6">
            <h1 className="text-2xl font-semibold mb-2">PDF Library</h1>
            <p className="text-sm text-gray-600 mb-4">
              Browse all working papers generated for this client.
            </p>

            <Dropdown
              label="VAT PDFs"
              items={grouped.vat}
              selectedId={selectedPdfId}
              onSelect={setSelectedPdfId}
            />

            <Dropdown
              label="Self Assessment PDFs (SA)"
              items={grouped.sa}
              selectedId={selectedPdfId}
              onSelect={setSelectedPdfId}
            />

            <Dropdown
              label="Corporation Tax PDFs (CT)"
              items={grouped.ct}
              selectedId={selectedPdfId}
              onSelect={setSelectedPdfId}
            />

            <Dropdown
              label="CIS PDFs"
              items={grouped.cis}
              selectedId={selectedPdfId}
              onSelect={setSelectedPdfId}
            />

            <InfoPanel pdf={selectedPdf} />
          </div>

          {/* RIGHT PANEL */}
          <div className="flex-1 flex flex-col">
            <div className="flex-1 p-4">
              {isLoading && (
                <div className="h-full flex items-center justify-center text-gray-500">
                  Loading PDFs…
                </div>
              )}

              {error && (
                <div className="h-full flex items-center justify-center text-red-500">
                  Failed to load PDFs.
                </div>
              )}

              {!isLoading && !selectedPdf && !error && (
                <div className="h-full flex items-center justify-center text-gray-500">
                  No PDFs available for this client yet.
                </div>
              )}

              {selectedPdf && (
                <div className="h-full border border-gray-200 rounded-md overflow-hidden bg-gray-50">
                  <iframe
                    src={selectedPdf.url}
                    title={formatLabel(selectedPdf)}
                    className="w-full h-full"
                  />
                </div>
              )}
            </div>

            {/* FOOTER */}
            <footer className="border-t border-gray-200 px-4 py-3 text-center text-xs text-gray-500">
              <div>ProfitLens Technologies Ltd</div>
              <div className="mt-1">
                ProfitLens provides estimates only. Always verify figures before
                filing with HMRC. Nothing displayed here constitutes tax,
                accounting, or legal advice.
              </div>
            </footer>
          </div>
        </div>
      </div>
    </>
  );
}

function Dropdown({ label, items, selectedId, onSelect }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      <select
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        value={selectedId || ""}
        onChange={(e) => onSelect(e.target.value || null)}
      >
        <option value="">Select a PDF…</option>
        {items.map((pdf) => (
          <option key={pdf.id} value={pdf.id}>
            {formatLabel(pdf)}
          </option>
        ))}
      </select>
      {items.length === 0 && (
        <p className="mt-1 text-xs text-gray-400">
          No PDFs available in this category.
        </p>
      )}
    </div>
  );
}

function InfoPanel({ pdf }) {
  if (!pdf) {
    return (
      <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-500">
        Select a PDF from the dropdowns above to view its details.
      </div>
    );
  }

  const meta = pdf.metadata || {};
  const clientDetails = meta.clientDetails || meta.companyDetails || null;

  return (
    <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-3 text-xs space-y-2">
      <div className="font-semibold text-gray-700">Selected PDF</div>

      <div>
        <span className="font-medium text-gray-600">Type:</span>{" "}
        {(pdf.type || "").toUpperCase()}
      </div>

      <div>
        <span className="font-medium text-gray-600">Tax Year:</span>{" "}
        {pdf.tax_year || pdf.year || "—"}
      </div>

      <div>
        <span className="font-medium text-gray-600">Period:</span>{" "}
        {pdf.period_start && pdf.period_end
          ? `${pdf.period_start} → ${pdf.period_end}`
          : "—"}
      </div>

      <div>
        <span className="font-medium text-gray-600">Created At:</span>{" "}
        {new Date(pdf.created_at).toLocaleString()}
      </div>

      <div>
        <span className="font-medium text-gray-600">Created By:</span>{" "}
        {pdf.created_by || "system"}
      </div>

      {clientDetails && (
        <div className="pt-2 border-t border-gray-200">
          <div className="font-semibold text-gray-700 mb-1">
            Client Details
          </div>
          {clientDetails.name && <div>{clientDetails.name}</div>}
          {(clientDetails.trading_name || clientDetails.business_name) && (
            <div className="text-gray-500">
              {clientDetails.trading_name || clientDetails.business_name}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
