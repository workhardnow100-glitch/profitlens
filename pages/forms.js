// pages/forms.js
export const dynamic = "force-dynamic";

export async function getServerSideProps() {
  return { props: {} };
}

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import ResponsiveLayout from "../components/ResponsiveLayout";

export default function FormsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  // 🔐 Subscription + login guard
  useEffect(() => {
    if (status === "loading") return;

    if (session?.user) {
      const isAdmin = session.user.role === "admin";
      const isSubscribedOrTrial = ["basic", "pro", "trialing"].includes(
        session.user.subscriptionStatus
      );

      if (!(isAdmin || isSubscribedOrTrial)) {
        router.replace("/upgrade");
      }
    } else {
      router.replace("/login");
    }
  }, [session, status, router]);

  // ⭐ Client detection
  const [clientId, setClientId] = useState(null);
  const [clientName, setClientName] = useState("");

  useEffect(() => {
    if (!session?.user) return;

    const id = session.user.actingAsClientId || session.user.clientId;

    setClientId(id);
    setClientName("Your business");
  }, [session]);

  // Form state
  const [selectedCTForm, setSelectedCTForm] = useState("");
  const [selectedSAForm, setSelectedSAForm] = useState("");
  const [selectedCISForm, setSelectedCISForm] = useState("");

  // ⭐ NEW — Accounts form state
  const [selectedAccountsForm, setSelectedAccountsForm] = useState("");

  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [resultMessage, setResultMessage] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  // ⭐ CT Adjustments State
  const [lossCarryback, setLossCarryback] = useState("");
  const [groupRelief, setGroupRelief] = useState("");
  const [aiaClaimed, setAiaClaimed] = useState("");
  const [rAndDMultiplier, setRAndDMultiplier] = useState("");
  const [mainPoolBF, setMainPoolBF] = useState("");
  const [specialPoolBF, setSpecialPoolBF] = useState("");
  const [carsPoolBF, setCarsPoolBF] = useState("");

  const [ctAdjustmentsLoaded, setCtAdjustmentsLoaded] = useState(false);
  const [ctValidationError, setCtValidationError] = useState("");

  // ⭐ CT600 Supplement Detection
  const [supplements, setSupplements] = useState(null);
  const [supplementsLoading, setSupplementsLoading] = useState(false);

  const CT_FORMS = [
    { code: "CT600", label: "CT600 — Main Corporation Tax return" },
    { code: "CT600A", label: "CT600A — Loans to participators" },
    { code: "CT600J", label: "CT600J — Disclosure of tax avoidance schemes" },
    { code: "CT600L", label: "CT600L — R&D tax relief" },
    { code: "CT600F", label: "CT600F — Charity exemptions" },
    { code: "CT600M", label: "CT600M — Cross-border royalties" },
    { code: "CT600N", label: "CT600N — Northern Ireland rate" },
  ];

  const SA_FORMS = [
    { code: "SA100", label: "SA100 — Main individual return" },
    { code: "SA103", label: "SA103 — Self-employment pages" },
    { code: "SA105", label: "SA105 — UK property" },
    { code: "SA110", label: "SA110 — Tax calculation summary" },
  ];

  const CIS_FORMS = [
    { code: "CIS300", label: "CIS300 — Monthly contractor return" },
    { code: "CIS_STATEMENT", label: "CIS Subcontractor Statement" },
  ];

  // ⭐ NEW — Accounts frameworks
  const ACCOUNTS_FORMS = [
    { code: "FRS105", label: "FRS 105 — Micro‑entity Accounts" },
    { code: "FRS102_1A", label: "FRS 102 1A — Small Company Accounts" },
  ];

  // ⭐ NEW — Statutory Accounts Editor State

  // Accounting policies (shared FRS105 / FRS102)
  const [accountsPolicies, setAccountsPolicies] = useState({
    turnover: "",
    taxation: "",
    debtors: "",
    creditors: "",
    cash: "",
    tangibleFixedAssets: "",
    depreciation: "",
  });

  // Profit & Loss (FRS102 only)
  const [accountsPandL, setAccountsPandL] = useState({
    turnover: "",
    costOfSales: "",
    adminExpenses: "",
    interest: "",
    tax: "",
    profitForYear: "",
  });

  // Director’s report (FRS102 only)
  const [accountsDirectorsReport, setAccountsDirectorsReport] = useState("");

  // Additional notes (shared)
  const [accountsNotes, setAccountsNotes] = useState([]); // [{ id, title, body }]
  const [nextNoteId, setNextNoteId] = useState(1);

  // Director approval (shared)
  const [accountsApproval, setAccountsApproval] = useState({
    directorName: "",
    approvalDate: "",
  });

  // ⭐ NEW — Versioning state for statutory accounts
  const [accountsVersionId, setAccountsVersionId] = useState(null);
  const [accountsVersionNumber, setAccountsVersionNumber] = useState(null);
  const [accountsVersionCreatedAt, setAccountsVersionCreatedAt] = useState(null);
  const [accountsVersionIsFinal, setAccountsVersionIsFinal] = useState(false);
  const [accountsVersionLoading, setAccountsVersionLoading] = useState(false);

  // ⭐ Helper: reset accounts editor + version state
  const resetAccountsEditorState = () => {
    setAccountsPolicies({
      turnover: "",
      taxation: "",
      debtors: "",
      creditors: "",
      cash: "",
      tangibleFixedAssets: "",
      depreciation: "",
    });
    setAccountsPandL({
      turnover: "",
      costOfSales: "",
      adminExpenses: "",
      interest: "",
      tax: "",
      profitForYear: "",
    });
    setAccountsDirectorsReport("");
    setAccountsNotes([]);
    setNextNoteId(1);
    setAccountsApproval({
      directorName: "",
      approvalDate: "",
    });
    setAccountsVersionId(null);
    setAccountsVersionNumber(null);
    setAccountsVersionCreatedAt(null);
    setAccountsVersionIsFinal(false);
  };

  // ⭐ Helper: non‑negative numeric input
  const handleNonNegativeChange = (setter) => (e) => {
    const raw = e.target.value;
    if (raw === "") {
      setter("");
      setCtValidationError("");
      return;
    }
    const num = Number(raw);
    if (Number.isNaN(num)) {
      setter("");
      setCtValidationError("Values must be numeric.");
      return;
    }
    if (num < 0) {
      setter("0");
      setCtValidationError("Values cannot be negative.");
      return;
    }
    setter(raw);
    setCtValidationError("");
  };

  // ⭐ AUTO‑LOAD CT ADJUSTMENTS
  useEffect(() => {
    if (!selectedCTForm || !clientId || !periodStart || !periodEnd) {
      setCtAdjustmentsLoaded(false);
      return;
    }

    const loadAdjustments = async () => {
      try {
        const res = await fetch(
          `/api/forms/ct600/load?clientId=${clientId}&periodStart=${periodStart}&periodEnd=${periodEnd}`
        );

        const data = await res.json();
        if (!data.success || !data.adjustments) {
          setCtAdjustmentsLoaded(false);
          return;
        }

        const a = data.adjustments;

        setLossCarryback(a.loss_carryback ?? "");
        setGroupRelief(a.group_relief ?? "");
        setAiaClaimed(a.ca_aia_claimed ?? "");
        setRAndDMultiplier(a.r_and_d_multiplier ?? "");
        setMainPoolBF(a.ca_main_pool_bf ?? "");
        setSpecialPoolBF(a.ca_special_pool_bf ?? "");
        setCarsPoolBF(a.ca_cars_pool_bf ?? "");

        const anyLoaded =
          a.loss_carryback ||
          a.group_relief ||
          a.ca_aia_claimed ||
          a.r_and_d_multiplier ||
          a.ca_main_pool_bf ||
          a.ca_special_pool_bf ||
          a.ca_cars_pool_bf;

        setCtAdjustmentsLoaded(Boolean(anyLoaded));
      } catch (err) {
        console.error("Failed to load CT adjustments", err);
        setCtAdjustmentsLoaded(false);
      }
    };

    loadAdjustments();
  }, [selectedCTForm, clientId, periodStart, periodEnd]);

  // ⭐ AUTO‑LOAD CT600 SUPPLEMENTS
  useEffect(() => {
    if (!clientId || !periodStart || !periodEnd) {
      setSupplements(null);
      return;
    }

    const loadSupplements = async () => {
      try {
        setSupplementsLoading(true);

        const res = await fetch(
          `/api/forms/ct600/supplements?clientId=${clientId}&periodStart=${periodStart}&periodEnd=${periodEnd}`
        );

        const data = await res.json();
        if (data.success) {
          setSupplements(data.supplements);
        } else {
          setSupplements(null);
        }
      } catch (err) {
        console.error("Failed to load supplements", err);
        setSupplements(null);
      } finally {
        setSupplementsLoading(false);
      }
    };

    loadSupplements();
  }, [clientId, periodStart, periodEnd]);

  // ⭐ Save CT Adjustments
  const handleSaveCTAdjustments = async () => {
    setErrorMessage(null);
    setResultMessage(null);

    if (ctValidationError) {
      setErrorMessage("Please fix CT adjustment validation errors before saving.");
      return;
    }

    try {
      setIsLoading(true);

      const res = await fetch("/api/forms/ct600/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          periodStart,
          periodEnd,
          lossCarryback,
          groupRelief,
          aiaClaimed,
          rAndDMultiplier,
          mainPoolBF,
          specialPoolBF,
          carsPoolBF,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to save CT adjustments.");
      }

      setResultMessage("CT adjustments saved successfully.");
      setCtAdjustmentsLoaded(true);
    } catch (err) {
      setErrorMessage(err.message || "Failed to save CT adjustments.");
    } finally {
      setIsLoading(false);
    }
  };

  // ⭐ AUTO‑LOAD / CREATE VERSIONED STATUTORY ACCOUNTS
  useEffect(() => {
    if (!clientId || !periodStart || !periodEnd || !selectedAccountsForm) {
      resetAccountsEditorState();
      return;
    }

    const loadOrCreateVersion = async () => {
      try {
        setAccountsVersionLoading(true);

        // 1) Try load latest version
        const res = await fetch("/api/accounts/load", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId,
            periodStart,
            periodEnd,
            framework: selectedAccountsForm,
          }),
        });

        const data = await res.json();

        if (res.ok && data.success && data.version) {
          const v = data.version;

          setAccountsVersionId(v.versionId);
          setAccountsVersionNumber(v.versionNumber);
          setAccountsVersionCreatedAt(v.createdAt);
          setAccountsVersionIsFinal(v.isFinal ?? false);

          setAccountsPolicies({
            turnover: v.policies?.turnover ?? "",
            taxation: v.policies?.taxation ?? "",
            debtors: v.policies?.debtors ?? "",
            creditors: v.policies?.creditors ?? "",
            cash: v.policies?.cash ?? "",
            tangibleFixedAssets: v.policies?.tangibleFixedAssets ?? "",
            depreciation: v.policies?.depreciation ?? "",
          });

          if (selectedAccountsForm === "FRS102_1A" && v.pandl) {
            setAccountsPandL({
              turnover: v.pandl.turnover ?? "",
              costOfSales: v.pandl.costOfSales ?? "",
              adminExpenses: v.pandl.adminExpenses ?? "",
              interest: v.pandl.interest ?? "",
              tax: v.pandl.tax ?? "",
              profitForYear: v.pandl.profitForYear ?? "",
            });
          } else {
            setAccountsPandL({
              turnover: "",
              costOfSales: "",
              adminExpenses: "",
              interest: "",
              tax: "",
              profitForYear: "",
            });
          }

          setAccountsDirectorsReport(v.directorsReport?.reportText ?? "");

          const mappedNotes =
            v.notes?.map((n, idx) => ({
              id: idx + 1,
              title: n.title,
              body: n.body ?? "",
            })) ?? [];

          setAccountsNotes(mappedNotes);
          setNextNoteId(mappedNotes.length + 1);

          setAccountsApproval({
            directorName: v.approval?.directorName ?? "",
            approvalDate: v.approval?.approvalDate ?? "",
          });

          return;
        }

        // 2) If no version exists, create a new one
        const createRes = await fetch("/api/accounts/create-version", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clientId,
            periodStart,
            periodEnd,
            framework: selectedAccountsForm,
          }),
        });

        const createData = await createRes.json();

        if (!createRes.ok || !createData.success) {
          throw new Error(createData.message || "Failed to create accounts version.");
        }

        setAccountsVersionId(createData.versionId);
        setAccountsVersionNumber(createData.versionNumber);
        setAccountsVersionCreatedAt(createData.createdAt);
        setAccountsVersionIsFinal(createData.isFinal ?? false);

        resetAccountsEditorState();
        setAccountsVersionId(createData.versionId);
        setAccountsVersionNumber(createData.versionNumber);
        setAccountsVersionCreatedAt(createData.createdAt);
        setAccountsVersionIsFinal(createData.isFinal ?? false);
      } catch (err) {
        console.error("Failed to load/create accounts version", err);
      } finally {
        setAccountsVersionLoading(false);
      }
    };

    loadOrCreateVersion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId, periodStart, periodEnd, selectedAccountsForm]);

  // ⭐ REAL‑TIME AUTO‑SAVE (debounced 1s) FOR STATUTORY ACCOUNTS
  useEffect(() => {
    if (
      !accountsVersionId ||
      !clientId ||
      !periodStart ||
      !periodEnd ||
      !selectedAccountsForm
    ) {
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        const pandlPayload =
          selectedAccountsForm === "FRS102_1A"
            ? {
                turnover:
                  accountsPandL.turnover !== ""
                    ? Number(accountsPandL.turnover)
                    : null,
                costOfSales:
                  accountsPandL.costOfSales !== ""
                    ? Number(accountsPandL.costOfSales)
                    : null,
                adminExpenses:
                  accountsPandL.adminExpenses !== ""
                    ? Number(accountsPandL.adminExpenses)
                    : null,
                interest:
                  accountsPandL.interest !== ""
                    ? Number(accountsPandL.interest)
                    : null,
                tax:
                  accountsPandL.tax !== ""
                    ? Number(accountsPandL.tax)
                    : null,
                profitForYear:
                  accountsPandL.profitForYear !== ""
                    ? Number(accountsPandL.profitForYear)
                    : null,
              }
            : null;

        const notesPayload = accountsNotes.map((n, idx) => ({
          noteNumber: idx + 1,
          title: n.title,
          body: n.body ?? "",
        }));

        await fetch("/api/accounts/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            versionId: accountsVersionId,
            policies: accountsPolicies,
            pandl: pandlPayload,
            directorsReport:
              selectedAccountsForm === "FRS102_1A"
                ? { reportText: accountsDirectorsReport }
                : null,
            notes: notesPayload,
            approval: {
              directorName: accountsApproval.directorName || null,
              approvalDate: accountsApproval.approvalDate || null,
            },
          }),
        });
      } catch (err) {
        console.error("Auto-save accounts error", err);
      }
    }, 1000);

    return () => clearTimeout(timeout);
  }, [
    accountsVersionId,
    clientId,
    periodStart,
    periodEnd,
    selectedAccountsForm,
    accountsPolicies,
    accountsPandL,
    accountsDirectorsReport,
    accountsNotes,
    accountsApproval,
  ]);

  // ⭐ Create new accounts version (manual)
  const handleCreateNewAccountsVersion = async () => {
    if (!clientId || !periodStart || !periodEnd || !selectedAccountsForm) return;

    try {
      setAccountsVersionLoading(true);
      const res = await fetch("/api/accounts/create-version", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          periodStart,
          periodEnd,
          framework: selectedAccountsForm,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to create new accounts version.");
      }

      resetAccountsEditorState();
      setAccountsVersionId(data.versionId);
      setAccountsVersionNumber(data.versionNumber);
      setAccountsVersionCreatedAt(data.createdAt);
      setAccountsVersionIsFinal(data.isFinal ?? false);
    } catch (err) {
      console.error("Create new accounts version error", err);
      setErrorMessage(err.message || "Failed to create new accounts version.");
    } finally {
      setAccountsVersionLoading(false);
    }
  };

  // ⭐ Finalise accounts version
  const handleFinaliseAccountsVersion = async () => {
    if (!accountsVersionId) return;

    try {
      setAccountsVersionLoading(true);
      const res = await fetch("/api/accounts/finalise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId: accountsVersionId }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to finalise accounts version.");
      }

      setAccountsVersionIsFinal(true);
      setResultMessage("Accounts version finalised.");
    } catch (err) {
      console.error("Finalise accounts version error", err);
      setErrorMessage(err.message || "Failed to finalise accounts version.");
    } finally {
      setAccountsVersionLoading(false);
    }
  };

  // ⭐ Generate single form (CT, SA, CIS, ACCOUNTS)
  const handleGenerate = async (category) => {
    setResultMessage(null);
    setErrorMessage(null);

    const formCode =
      category === "CT"
        ? selectedCTForm
        : category === "SA"
        ? selectedSAForm
        : category === "CIS"
        ? selectedCISForm
        : selectedAccountsForm;

    if (!clientId) {
      setErrorMessage("No client selected.");
      return;
    }

    if (!formCode) {
      setErrorMessage("Please select a form.");
      return;
    }

    if (!periodStart || !periodEnd) {
      setErrorMessage("Please select a period start and end date.");
      return;
    }

    try {
      setIsLoading(true);

      const payload = {
        clientId,
        formCode,
        periodStart,
        periodEnd,
      };

      // ⭐ Attach Statutory Accounts payload when generating FRS105 / FRS102_1A
      if (category === "ACCOUNTS") {
        payload.accountsVersionId = accountsVersionId || null;
        payload.notes = {
          policies: accountsPolicies,
          directorsReport: accountsDirectorsReport,
          details: accountsNotes,
        };
        payload.pAndlCurrent = accountsPandL;
        payload.directorApproval = {
          name: accountsApproval.directorName || "",
          date: accountsApproval.approvalDate || "",
        };
      }

      const res = await fetch("/api/forms/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to generate form.");
      }

      setResultMessage(
        `Form ${formCode} generated successfully. PDF saved and available for download.`
      );
    } catch (err) {
      setErrorMessage(err.message || "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  };

  // ⭐ Generate full CT pack
  const handleGeneratePack = async () => {
    setResultMessage(null);
    setErrorMessage(null);

    if (!clientId || !periodStart || !periodEnd) {
      setErrorMessage("Client and period must be selected.");
      return;
    }

    try {
      setIsLoading(true);

      const res = await fetch("/api/forms/generate-pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          periodStart,
          periodEnd,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to generate CT pack.");
      }

      setResultMessage(`CT pack generated: ${data.generated.join(", ")}`);
    } catch (err) {
      setErrorMessage(err.message || "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  };

  // ⭐ Notes helpers
  const handleAddNote = () => {
    setAccountsNotes((prev) => [
      ...prev,
      { id: nextNoteId, title: `Note ${nextNoteId}`, body: "" },
    ]);
    setNextNoteId((id) => id + 1);
  };

  const handleUpdateNote = (id, field, value) => {
    setAccountsNotes((prev) =>
      prev.map((n) => (n.id === id ? { ...n, [field]: value } : n))
    );
  };

  const handleDeleteNote = (id) => {
    setAccountsNotes((prev) => prev.filter((n) => n.id !== id));
  };

  const handleMoveNote = (id, direction) => {
    setAccountsNotes((prev) => {
      const index = prev.findIndex((n) => n.id === id);
      if (index === -1) return prev;
      const newIndex = index + direction;
      if (newIndex < 0 || newIndex >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(index, 1);
      copy.splice(newIndex, 0, item);
      return copy;
    });
  };

  return (
    <ResponsiveLayout>
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        <header className="space-y-2">
          <h1 className="text-2xl font-bold">Forms &amp; Returns</h1>
          <p className="text-sm text-gray-600">
            Generate Corporation Tax (CT600), Self Assessment, CIS, and Statutory Accounts automatically from your
            transaction data.
          </p>

          <p className="text-sm text-blue-700 font-medium">
            Generating forms for:{" "}
            <span className="font-semibold">{clientName}</span>
          </p>
        </header>

        {/* Compliance */}
        <section className="border border-amber-300 bg-amber-50 text-amber-900 rounded-md p-4 text-sm space-y-2">
          <h2 className="font-semibold">Important before you generate any form</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>All relevant transactions must already be imported and categorised.</li>
            <li>ProfitLens auto-fills forms from your transactions and related tables.</li>
            <li>You must seek an accountant audit before submitting anything to HMRC.</li>
            <li>You remain responsible for the accuracy of all submissions.</li>
          </ul>
        </section>

        {/* Period selection */}
        <section className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium">Period start</label>
              <input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="border rounded px-3 py-2 text-sm w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Period end</label>
              <input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="border rounded px-3 py-2 text-sm w-full"
              />
            </div>
          </div>
        </section>

        {/* Forms */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* CT */}
          <div className="border rounded-md p-4 space-y-3">
            <h2 className="font-semibold text-sm">Corporation Tax (CT)</h2>
            <p className="text-xs text-gray-500">
              Generate CT600 and related supplements based on your company’s profit, losses, and capital allowances.
            </p>
            <select
              value={selectedCTForm}
              onChange={(e) => setSelectedCTForm(e.target.value)}
              className="border rounded px-2 py-2 text-sm w-full"
            >
              <option value="">Select CT form…</option>
              {CT_FORMS.map((form) => (
                <option key={form.code} value={form.code}>
                  {form.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => handleGenerate("CT")}
              disabled={isLoading}
              className="w-full bg-blue-600 text-white text-sm font-medium py-2 rounded disabled:opacity-50"
            >
              {isLoading ? "Generating…" : "Generate CT form"}
            </button>
          </div>

          {/* ⭐ CT Adjustments Panel */}
          {selectedCTForm && (
            <div className="border rounded-md p-4 space-y-3 bg-gray-50 md:col-span-2">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">CT Adjustments (Optional)</h3>
                {ctAdjustmentsLoaded && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                    Loaded from previous period
                  </span>
                )}
              </div>

              <p className="text-xs text-gray-500">
                Use these fields to refine your CT600 calculation for loss relief, group relief, and capital allowances.
              </p>

              {ctValidationError && (
                <p className="text-xs text-red-600">{ctValidationError}</p>
              )}

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Loss Carryback ⓘ
                  </label>
                  <input
                    type="number"
                    value={lossCarryback}
                    onChange={handleNonNegativeChange(setLossCarryback)}
                    className="border rounded px-2 py-1 w-full"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">
                    Amount of trading losses you want to carry back to earlier periods.
                  </p>
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Group Relief ⓘ
                  </label>
                  <input
                    type="number"
                    value={groupRelief}
                    onChange={handleNonNegativeChange(setGroupRelief)}
                    className="border rounded px-2 py-1 w-full"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">
                    Losses surrendered to or claimed from other group companies.
                  </p>
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    AIA Claimed ⓘ
                  </label>
                  <input
                    type="number"
                    value={aiaClaimed}
                    onChange={handleNonNegativeChange(setAiaClaimed)}
                    className="border rounded px-2 py-1 w-full"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">
                    Annual Investment Allowance claimed on qualifying assets.
                  </p>
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    R&D Multiplier ⓘ
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={rAndDMultiplier}
                    onChange={handleNonNegativeChange(setRAndDMultiplier)}
                    className="border rounded px-2 py-1 w-full"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">
                    Enhancement factor for qualifying R&amp;D expenditure (e.g. 1.3).
                  </p>
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Main Pool B/F ⓘ
                  </label>
                  <input
                    type="number"
                    value={mainPoolBF}
                    onChange={handleNonNegativeChange(setMainPoolBF)}
                    className="border rounded px-2 py-1 w-full"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">
                    Tax written down value brought forward for main pool assets.
                  </p>
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Special Pool B/F ⓘ
                  </label>
                  <input
                    type="number"
                    value={specialPoolBF}
                    onChange={handleNonNegativeChange(setSpecialPoolBF)}
                    className="border rounded px-2 py-1 w-full"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">
                    Brought forward balance for special rate pool assets.
                  </p>
                </div>

                <div>
                  <label className="block text-xs text-gray-600 mb-1">
                    Cars Pool B/F ⓘ
                  </label>
                  <input
                    type="number"
                    value={carsPoolBF}
                    onChange={handleNonNegativeChange(setCarsPoolBF)}
                    className="border rounded px-2 py-1 w-full"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">
                    Brought forward balance for car-related capital allowances.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSaveCTAdjustments}
                disabled={isLoading}
                className="w-full bg-gray-700 text-white text-sm font-medium py-2 rounded disabled:opacity-50"
              >
                {isLoading ? "Saving…" : "Save CT Adjustments"}
              </button>
            </div>
          )}

          {/* ⭐ CT600 Supplement Detection + Full Pack */}
          {supplements && (
            <section className="border border-blue-200 bg-blue-50 rounded-md p-4 space-y-2 text-sm md:col-span-3">
              <h3 className="font-semibold">Detected CT600 Supplements</h3>

              {supplementsLoading ? (
                <p className="text-xs text-gray-600">Checking supplements…</p>
              ) : (
                <ul className="list-disc list-inside space-y-1">
                  <li>
                    CT600A — Loans to Participators:{" "}
                    <strong>{supplements.ct600ARequired ? "Yes" : "No"}</strong>
                  </li>
                  <li>
                    CT600J — DOTAS Disclosure:{" "}
                    <strong>{supplements.ct600JRequired ? "Yes" : "No"}</strong>
                  </li>
                  <li>
                    CT600L — R&D Supplement:{" "}
                    <strong>{supplements.ct600LRequired ? "Yes" : "No"}</strong>
                  </li>
                  <li>
                    CT600F — Charity Exemptions:{" "}
                    <strong>{supplements.ct600FRequired ? "Yes" : "No"}</strong>
                  </li>
                  <li>
                    CT600M — Cross-Border Royalties:{" "}
                    <strong>{supplements.ct600MRequired ? "Yes" : "No"}</strong>
                  </li>
                  <li>
                    CT600N — Northern Ireland Rate:{" "}
                    <strong>{supplements.ct600NRequired ? "Yes" : "No"}</strong>
                  </li>
                </ul>
              )}

              <p className="text-xs text-gray-500">
                ProfitLens scans your data to detect which CT600 supplements are likely required, so you don’t miss
                critical disclosures.
              </p>

              <button
                type="button"
                onClick={handleGeneratePack}
                disabled={isLoading}
                className="mt-3 w-full bg-indigo-600 text-white text-sm font-medium py-2 rounded disabled:opacity-50"
              >
                {isLoading ? "Generating CT Pack…" : "Generate Full CT Pack"}
              </button>
            </section>
          )}

          {/* ⭐ ACCOUNTS SECTION (Selector only – editor is full-width below) */}
          <div className="border rounded-md p-4 space-y-3">
            <h2 className="font-semibold text-sm">Statutory Accounts</h2>
            <p className="text-xs text-gray-500">
              Choose the accounts framework for your statutory accounts. You can then configure notes, policies, and
              disclosures in the editor below.
            </p>
            <select
              value={selectedAccountsForm}
              onChange={(e) => setSelectedAccountsForm(e.target.value)}
              className="border rounded px-2 py-2 text-sm w-full"
            >
              <option value="">Select accounts framework…</option>
              {ACCOUNTS_FORMS.map((form) => (
                <option key={form.code} value={form.code}>
                  {form.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => handleGenerate("ACCOUNTS")}
              disabled={isLoading || !selectedAccountsForm}
              className="w-full bg-purple-600 text-white text-sm font-medium py-2 rounded disabled:opacity-50"
            >
              {isLoading ? "Generating…" : "Generate Accounts PDF"}
            </button>
          </div>

          {/* SA */}
          <div className="border rounded-md p-4 space-y-3">
            <h2 className="font-semibold text-sm">Self Assessment (SA)</h2>
            <p className="text-xs text-gray-500">
              Generate Self Assessment returns for individuals, including self-employment and property pages.
            </p>
            <select
              value={selectedSAForm}
              onChange={(e) => setSelectedSAForm(e.target.value)}
              className="border rounded px-2 py-2 text-sm w-full"
            >
              <option value="">Select SA form…</option>
              {SA_FORMS.map((form) => (
                <option key={form.code} value={form.code}>
                  {form.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => handleGenerate("SA")}
              disabled={isLoading}
              className="w-full bg-green-600 text-white text-sm font-medium py-2 rounded disabled:opacity-50"
            >
              {isLoading ? "Generating…" : "Generate SA form"}
            </button>
          </div>

          {/* CIS */}
          <div className="border rounded-md p-4 space-y-3">
            <h2 className="font-semibold text-sm">Construction Industry Scheme (CIS)</h2>
            <p className="text-xs text-gray-500">
              Generate CIS300 contractor returns and subcontractor statements from your CIS transaction data.
            </p>
            <select
              value={selectedCISForm}
              onChange={(e) => setSelectedCISForm(e.target.value)}
              className="border rounded px-2 py-2 text-sm w-full"
            >
              <option value="">Select CIS form…</option>
              {CIS_FORMS.map((form) => (
                <option key={form.code} value={form.code}>
                  {form.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => handleGenerate("CIS")}
              disabled={isLoading}
              className="w-full bg-amber-600 text-white text-sm font-medium py-2 rounded disabled:opacity-50"
            >
              {isLoading ? "Generating…" : "Generate CIS form"}
            </button>
          </div>
        </section>

        {/* ⭐ FULL-WIDTH STATUTORY ACCOUNTS EDITOR */}
        {selectedAccountsForm && (
          <section className="border border-purple-200 bg-purple-50/40 rounded-md p-4 md:p-6 space-y-4">
            <FullWidthAccountsEditor
              framework={selectedAccountsForm}
              periodStart={periodStart}
              periodEnd={periodEnd}
              policies={accountsPolicies}
              setPolicies={setAccountsPolicies}
              pAndL={accountsPandL}
              setPandL={setAccountsPandL}
              directorsReport={accountsDirectorsReport}
              setDirectorsReport={setAccountsDirectorsReport}
              notes={accountsNotes}
              onAddNote={handleAddNote}
              onUpdateNote={handleUpdateNote}
              onDeleteNote={handleDeleteNote}
              onMoveNote={handleMoveNote}
              approval={accountsApproval}
              setApproval={setAccountsApproval}
              versionId={accountsVersionId}
              versionNumber={accountsVersionNumber}
              versionCreatedAt={accountsVersionCreatedAt}
              versionIsFinal={accountsVersionIsFinal}
              versionLoading={accountsVersionLoading}
              onNewVersion={handleCreateNewAccountsVersion}
              onFinaliseVersion={handleFinaliseAccountsVersion}
            />
          </section>
        )}

        {/* Messages */}
        {resultMessage && (
          <div className="border border-emerald-300 bg-emerald-50 text-emerald-900 rounded-md p-3 text-sm">
            {resultMessage}
          </div>
        )}
        {errorMessage && (
          <div className="border border-red-300 bg-red-50 text-red-900 rounded-md p-3 text-sm">
            {errorMessage}
          </div>
        )}

        {/* Disclaimer */}
        <section className="border border-gray-200 bg-gray-50 rounded-md p-4 text-xs text-gray-600 space-y-1">
          <p>
            ProfitLens generates draft forms and working papers using your transaction data. These
            are <strong>not</strong> a substitute for professional advice.
          </p>
          <p>
            You must review each form carefully and seek an <strong>accountant audit</strong> before
            submitting anything to HMRC.
          </p>
        </section>
      </div>
    </ResponsiveLayout>
  );
}

/**
 * Full-width Statutory Accounts Editor
 * Vertical tabs, ProfitLens style, FRS105 + FRS102 1A aware.
 */
function FullWidthAccountsEditor({
  framework,
  periodStart,
  periodEnd,
  policies,
  setPolicies,
  pAndL,
  setPandL,
  directorsReport,
  setDirectorsReport,
  notes,
  onAddNote,
  onUpdateNote,
  onDeleteNote,
  onMoveNote,
  approval,
  setApproval,
  versionId,
  versionNumber,
  versionCreatedAt,
  versionIsFinal,
  versionLoading,
  onNewVersion,
  onFinaliseVersion,
}) {
  const [activeTab, setActiveTab] = useState("framework");

  const isFRS102 = framework === "FRS102_1A";
  const isFRS105 = framework === "FRS105";

  const tabs = [
    { id: "framework", label: "Framework" },
    { id: "policies", label: "Accounting Policies" },
    ...(isFRS102 ? [{ id: "pnl", label: "Profit & Loss" }] : []),
    ...(isFRS102 ? [{ id: "directors", label: "Director’s Report" }] : []),
    { id: "notes", label: "Additional Notes" },
    { id: "approval", label: "Director Approval" },
  ];

  const frameworkLabel = isFRS105
    ? "FRS 105 — Micro‑entity Accounts"
    : "FRS 102 Section 1A — Small Company Accounts";

  const versionLabel = (() => {
    if (!versionNumber) return "No version yet";
    const status = versionIsFinal ? "Final" : "Draft";
    const ts = versionCreatedAt
      ? new Date(versionCreatedAt).toLocaleString()
      : "";
    return `v${versionNumber} — ${status}${ts ? ` — ${ts}` : ""}`;
  })();

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-purple-900">
            Statutory Accounts Editor
          </h2>
          <p className="text-xs text-gray-600">
            Configure the disclosures, policies, and notes that will appear in your statutory accounts PDF.
          </p>
        </div>
        <div className="text-xs text-gray-700 space-y-1 text-right md:text-left">
          <div>
            <span className="font-medium">Framework:</span> {frameworkLabel}
          </div>
          <div>
            <span className="font-medium">Period:</span>{" "}
            {periodStart && periodEnd ? `${periodStart} → ${periodEnd}` : "Not set"}
          </div>
          <div>
            <span className="font-medium">Version:</span>{" "}
            {versionLoading ? "Loading…" : versionLabel}
          </div>
          <div className="flex flex-wrap gap-2 justify-end md:justify-start mt-1">
            <button
              type="button"
              onClick={onNewVersion}
              disabled={versionLoading}
              className="px-2 py-1 rounded border border-purple-400 text-purple-700 text-[11px] disabled:opacity-50"
            >
              New Version
            </button>
            <button
              type="button"
              onClick={onFinaliseVersion}
              disabled={versionLoading || !versionId || versionIsFinal}
              className="px-2 py-1 rounded bg-purple-600 text-white text-[11px] disabled:opacity-50"
            >
              Finalise Version
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        {/* Vertical Tabs */}
        <div className="md:w-48 flex md:flex-col gap-2 md:gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 md:flex-none text-xs text-left px-3 py-2 rounded border ${
                activeTab === tab.id
                  ? "bg-white border-purple-500 text-purple-700 font-medium"
                  : "bg-purple-50 border-transparent text-gray-700 hover:bg-purple-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 bg-white border border-purple-100 rounded-md p-4 space-y-3">
          {activeTab === "framework" && (
            <FrameworkTab isFRS105={isFRS105} isFRS102={isFRS102} />
          )}

          {activeTab === "policies" && (
            <PoliciesTab policies={policies} setPolicies={setPolicies} />
          )}

          {activeTab === "pnl" && isFRS102 && (
            <ProfitAndLossTab pAndL={pAndL} setPandL={setPandL} />
          )}

          {activeTab === "directors" && isFRS102 && (
            <DirectorsReportTab
              directorsReport={directorsReport}
              setDirectorsReport={setDirectorsReport}
            />
          )}

          {activeTab === "notes" && (
            <NotesTab
              notes={notes}
              onAddNote={onAddNote}
              onUpdateNote={onUpdateNote}
              onDeleteNote={onDeleteNote}
              onMoveNote={onMoveNote}
            />
          )}

          {activeTab === "approval" && (
            <ApprovalTab approval={approval} setApproval={setApproval} />
          )}
        </div>
      </div>
    </div>
  );
}

function FrameworkTab({ isFRS105, isFRS102 }) {
  return (
    <div className="space-y-2 text-xs text-gray-700">
      <h3 className="font-semibold text-sm">Framework overview</h3>
      {isFRS105 && (
        <>
          <p>
            <strong>FRS 105</strong> is the micro‑entity standard. It provides a highly simplified
            set of accounts for very small companies that meet the micro‑entity thresholds.
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>Balance sheet only (no detailed P&amp;L in the filed accounts).</li>
            <li>Very limited note disclosures.</li>
            <li>Suitable for the smallest companies that qualify as micro‑entities.</li>
          </ul>
        </>
      )}
      {isFRS102 && (
        <>
          <p>
            <strong>FRS 102 Section 1A</strong> is the small company regime. It requires more
            disclosures than FRS 105, but still offers simplifications compared to full FRS 102.
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>Balance sheet plus optional Profit and Loss Account.</li>
            <li>Accounting policies and key notes are required.</li>
            <li>Director’s report is optional but commonly included.</li>
          </ul>
        </>
      )}
      <p className="mt-2 text-gray-600">
        ProfitLens uses your transaction data to populate the core figures, while you control the
        narrative and disclosures here.
      </p>
    </div>
  );
}

function PoliciesTab({ policies, setPolicies }) {
  const handleChange = (field) => (e) => {
    setPolicies((prev) => ({ ...prev, [field]: e.target.value }));
  };

  return (
    <div className="space-y-3 text-xs text-gray-700">
      <h3 className="font-semibold text-sm">Accounting policies</h3>
      <p className="text-gray-600">
        These policies explain how your company recognises income, expenses, assets, and liabilities.
        They appear in the Notes to the Financial Statements.
      </p>

      <div className="space-y-2">
        <label className="block">
          <span className="block font-medium mb-1">Turnover</span>
          <textarea
            rows={3}
            value={policies.turnover}
            onChange={handleChange("turnover")}
            className="w-full border rounded px-2 py-1 text-xs"
            placeholder="Describe how and when turnover is recognised (e.g. on delivery of goods or completion of services)."
          />
        </label>

        <label className="block">
          <span className="block font-medium mb-1">Taxation</span>
          <textarea
            rows={3}
            value={policies.taxation}
            onChange={handleChange("taxation")}
            className="w-full border rounded px-2 py-1 text-xs"
            placeholder="Explain how corporation tax is calculated and when deferred tax is recognised."
          />
        </label>

        <label className="block">
          <span className="block font-medium mb-1">Debtors</span>
          <textarea
            rows={2}
            value={policies.debtors}
            onChange={handleChange("debtors")}
            className="w-full border rounded px-2 py-1 text-xs"
            placeholder="Explain how trade debtors and other receivables are measured (e.g. at amortised cost)."
          />
        </label>

        <label className="block">
          <span className="block font-medium mb-1">Creditors</span>
          <textarea
            rows={2}
            value={policies.creditors}
            onChange={handleChange("creditors")}
            className="w-full border rounded px-2 py-1 text-xs"
            placeholder="Explain how trade creditors and other payables are recognised and measured."
          />
        </label>

        <label className="block">
          <span className="block font-medium mb-1">Cash at bank and in hand</span>
          <textarea
            rows={2}
            value={policies.cash}
            onChange={handleChange("cash")}
            className="w-full border rounded px-2 py-1 text-xs"
            placeholder="Describe what is included in cash and cash equivalents."
          />
        </label>

        <label className="block">
          <span className="block font-medium mb-1">Tangible fixed assets</span>
          <textarea
            rows={3}
            value={policies.tangibleFixedAssets}
            onChange={handleChange("tangibleFixedAssets")}
            className="w-full border rounded px-2 py-1 text-xs"
            placeholder="Explain how tangible fixed assets are recognised, measured, and derecognised."
          />
        </label>

        <label className="block">
          <span className="block font-medium mb-1">Depreciation</span>
          <textarea
            rows={3}
            value={policies.depreciation}
            onChange={handleChange("depreciation")}
            className="w-full border rounded px-2 py-1 text-xs"
            placeholder="Describe depreciation methods and useful lives for key asset classes."
          />
        </label>
      </div>
    </div>
  );
}

function ProfitAndLossTab({ pAndL, setPandL }) {
  const handleChange = (field) => (e) => {
    setPandL((prev) => ({ ...prev, [field]: e.target.value }));
  };

  return (
    <div className="space-y-3 text-xs text-gray-700">
      <h3 className="font-semibold text-sm">Profit and Loss Account (optional)</h3>
      <p className="text-gray-600">
        If you enter figures here, a Profit and Loss Account will be included in the FRS 102 Section 1A accounts.
        If left blank, the P&amp;L section is omitted from the PDF.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <NumberField
          label="Turnover"
          value={pAndL.turnover}
          onChange={handleChange("turnover")}
          hint="Total income from trading activities."
        />
        <NumberField
          label="Cost of sales"
          value={pAndL.costOfSales}
          onChange={handleChange("costOfSales")}
          hint="Direct costs associated with generating turnover."
        />
        <NumberField
          label="Administrative expenses"
          value={pAndL.adminExpenses}
          onChange={handleChange("adminExpenses")}
          hint="Overheads and operating expenses."
        />
        <NumberField
          label="Interest"
          value={pAndL.interest}
          onChange={handleChange("interest")}
          hint="Finance costs such as loan interest."
        />
        <NumberField
          label="Tax on profit"
          value={pAndL.tax}
          onChange={handleChange("tax")}
          hint="Corporation tax charge for the year."
        />
        <NumberField
          label="Profit for the year"
          value={pAndL.profitForYear}
          onChange={handleChange("profitForYear")}
          hint="Final profit after tax."
        />
      </div>
    </div>
  );
}

function DirectorsReportTab({ directorsReport, setDirectorsReport }) {
  return (
    <div className="space-y-3 text-xs text-gray-700">
      <h3 className="font-semibold text-sm">Director’s Report (optional)</h3>
      <p className="text-gray-600">
        Under FRS 102 Section 1A, a director’s report is optional but commonly included. Use this
        section to describe the company’s activities, performance, and future plans.
      </p>
      <textarea
        rows={10}
        value={directorsReport}
        onChange={(e) => setDirectorsReport(e.target.value)}
        className="w-full border rounded px-2 py-1 text-xs"
        placeholder="Example: The principal activity of the company during the year was construction services..."
      />
    </div>
  );
}

function NotesTab({ notes, onAddNote, onUpdateNote, onDeleteNote, onMoveNote }) {
  return (
    <div className="space-y-3 text-xs text-gray-700">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-sm">Additional Notes</h3>
          <p className="text-gray-600">
            These notes appear after the primary statements. Use them for disclosures such as
            related party transactions, contingencies, or other narrative explanations.
          </p>
        </div>
        <button
          type="button"
          onClick={onAddNote}
          className="text-xs px-3 py-1 rounded bg-purple-600 text-white font-medium"
        >
          Add note
        </button>
      </div>

      {notes.length === 0 && (
        <p className="text-gray-500">
          No additional notes yet. Click &quot;Add note&quot; to create your first disclosure.
        </p>
      )}

      <div className="space-y-3">
        {notes.map((note, index) => (
          <div
            key={note.id}
            className="border border-gray-200 rounded-md p-3 bg-gray-50 space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <input
                type="text"
                value={note.title}
                onChange={(e) => onUpdateNote(note.id, "title", e.target.value)}
                className="flex-1 border rounded px-2 py-1 text-xs"
                placeholder="Note title (e.g. Related party transactions)"
              />
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onMoveNote(note.id, -1)}
                  disabled={index === 0}
                  className="px-2 py-1 text-[10px] border rounded disabled:opacity-40"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => onMoveNote(note.id, 1)}
                  disabled={index === notes.length - 1}
                  className="px-2 py-1 text-[10px] border rounded disabled:opacity-40"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteNote(note.id)}
                  className="px-2 py-1 text-[10px] border border-red-300 text-red-700 rounded"
                >
                  Delete
                </button>
              </div>
            </div>
            <textarea
              rows={4}
              value={note.body}
              onChange={(e) => onUpdateNote(note.id, "body", e.target.value)}
              className="w-full border rounded px-2 py-1 text-xs"
              placeholder="Enter the narrative for this note. It will appear as a numbered note in the accounts PDF."
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function ApprovalTab({ approval, setApproval }) {
  const handleChange = (field) => (e) => {
    setApproval((prev) => ({ ...prev, [field]: e.target.value }));
  };

  return (
    <div className="space-y-3 text-xs text-gray-700">
      <h3 className="font-semibold text-sm">Director approval</h3>
      <p className="text-gray-600">
        These details appear at the end of the accounts and confirm the date the directors approved
        the financial statements.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1">
            Director name
          </label>
          <input
            type="text"
            value={approval.directorName}
            onChange={handleChange("directorName")}
            className="w-full border rounded px-2 py-1 text-xs"
            placeholder="Name of the approving director"
          />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">
            Approval date
          </label>
          <input
            type="date"
            value={approval.approvalDate}
            onChange={handleChange("approvalDate")}
            className="w-full border rounded px-2 py-1 text-xs"
          />
        </div>
      </div>

      <p className="text-[11px] text-gray-500">
        If you leave the date blank, ProfitLens will default to the date the PDF is generated.
      </p>
    </div>
  );
}

function NumberField({ label, value, onChange, hint }) {
  return (
    <div>
      <label className="block text-xs text-gray-600 mb-1">
        {label}
      </label>
      <input
        type="number"
        value={value}
        onChange={onChange}
        className="border rounded px-2 py-1 w-full text-xs"
      />
      {hint && (
        <p className="text-[10px] text-gray-400 mt-1">
          {hint}
        </p>
      )}
    </div>
  );
}
