import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabaseClient";
import BatchSlotEditor from "./BatchSlotEditor";
import UpiPaymentPanel from "./UpiPaymentPanel";

// NOTE: Removed console logging of Supabase credentials.

const MEDICAL_OPTIONS = [
  "Knee Pain",
  "Back Pain",
  "Shoulder Pain",
  "Neck Pain",
  "Heart Condition",
  "Asthma",
  "Diabetes",
  "High Blood Pressure",
];


/* ================= CONSTANTS ================= */
const PAYMENT_MODE_MAP = {
  "Cash": "cash",
  "UPI": "upi",
  "Card": "card",
  "Bank Transfer": "bank_transfer",
};

const RELATIONS = [
  "Father",
  "Mother",
  "Spouse",
  "Sibling",
  "Guardian",
  "Friend",
  "Other",
];

const DEPENDENT_RELATIONS = [
  "Spouse",
  "Son",
  "Daughter",
  "Father",
  "Mother",
  "Sibling",
  "Guardian",
  "Friend",
  "Other",
];

const MAX_PHOTO_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_ID_PROOF_SIZE = 20 * 1024 * 1024; // 20 MB
const PHOTO_MAX_DIMENSION = 1600;

const computeBmi = (heightCm, weightKg) => {
  const h = Number(heightCm);
  const w = Number(weightKg);
  if (h > 0 && w > 0) {
    return (w / ((h / 100) ** 2)).toFixed(1);
  }
  return "";
};

const isIOS = () =>
  /iPhone|iPad|iPod/i.test(navigator.userAgent);

const loadImageFromFile = (file) =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });

const compressImageFile = async (file) => {
  if (!file || !file.type?.startsWith("image/")) return file;

  const img = await loadImageFromFile(file);
  const maxDim = PHOTO_MAX_DIMENSION;
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const targetWidth = Math.max(1, Math.round(img.width * scale));
  const targetHeight = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;

  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.85)
  );

  if (!blob) return file;

  const baseName = (file.name || "photo").replace(/\.[^/.]+$/, "");
  return new File([blob], `${baseName}.jpg`, {
    type: blob.type,
    lastModified: Date.now(),
  });
};

const toDateInputValue = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const dataURLtoBlob = (dataURL) => {
  const arr = dataURL.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  const n = bstr.length;
  const u8arr = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    u8arr[i] = bstr.charCodeAt(i);
  }
  return new Blob([u8arr], { type: mime });
};

export default function MemberForm({
  title,
  initialData = {},
  initialDependents = null,
  packages = [],
  addOns = [],
  trainers = [],
  packageHistory = [],
  initialAddOnDates = {},
  onSubmit,
  submitLabel = "Submit Registration",
  submitDisabled = false,
  showTrainerSelect = true,
  showPackageSection = true,
  requirePackageSelection = false,
  disablePostSubmitUploads = false,
  enableUpiPayment = false,
  enableCashPayment = false,
  mode = "admin", // Added mode prop for conditional UI rendering
  requireIdProof = false,
  requireTermsAcceptance = false,
  requireEmail = false,
}) {
  const navigate = useNavigate();
  const hydrated = useRef(false);
  const addOnDatesHydrated = useRef(false);
  const dependentsHydrated = useRef(false);
  const fileInputRef = useRef(null);
  const idProofInputRef = useRef(null);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState(null);
  const [idProofFile, setIdProofFile] = useState(null);
  const [dependentPhotoPreviewUrls, setDependentPhotoPreviewUrls] = useState({}); // { [depId]: dataUrl }
  const [medicalIssues, setMedicalIssues] = useState([]);
  const [batchSlots, setBatchSlots] = useState([]);
  const [showSlotEditor, setShowSlotEditor] = useState(false);

  const [couponCode, setCouponCode] = useState("");
  const [couponResult, setCouponResult] = useState(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState(null);
  const [otherMedical, setOtherMedical] = useState("");
  const [error, setError] = useState("");
  const [dependents, setDependents] = useState([]);
  const [expandedDependents, setExpandedDependents] = useState({});
  const [dependentError, setDependentError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Stores { [add_on_id]: { start_date: 'YYYY-MM-DD', end_date: 'YYYY-MM-DD' } }
  const [addOnDates, setAddOnDates] = useState({});
  // Referral
  const [referralQuery, setReferralQuery] = useState("");
  const [referralResults, setReferralResults] = useState([]);
  const [referralSearching, setReferralSearching] = useState(false);
  const [referrerName, setReferrerName] = useState("");
  const isPublicMode = String(mode).startsWith("public");

  // Restore photo preview from sessionStorage if it exists (for QR/navigation flows)
  useEffect(() => {
    if (!isPublicMode) return;
    if (photoFile || photoPreviewUrl) return; // Already have preview or file
    try {
      const stored = sessionStorage.getItem("photoPreview");
      if (stored) {
        setPhotoPreviewUrl(stored);
        // Convert data URL back to File for upload
        const blob = dataURLtoBlob(stored);
        const file = new File([blob], "photo.jpg", { type: "image/jpeg" });
        setPhotoFile(file);
      }
    } catch (err) {
      console.error("sessionStorage read failed:", err);
    }
  }, [isPublicMode, photoFile, photoPreviewUrl]);

  // Restore dependent photo previews from sessionStorage if they exist
  useEffect(() => {
    if (!isPublicMode) return;
    try {
      const stored = JSON.parse(sessionStorage.getItem("depPhotosPreviews") || "{}");
      if (Object.keys(stored).length > 0) {
        setDependentPhotoPreviewUrls((prev) => ({
          ...prev,
          ...stored,
        }));
        // Also restore files from data URLs
        dependents.forEach((dep) => {
          if (stored[dep.id] && !dep.photoFile) {
            try {
              const blob = dataURLtoBlob(stored[dep.id]);
              const file = new File([blob], "photo.jpg", { type: "image/jpeg" });
              updateDependent(dep.id, "photoFile", file);
            } catch (err) {
              console.error("Dependent photo file conversion failed:", err);
            }
          }
        });
      }
    } catch (err) {
      console.error("sessionStorage read failed:", err);
    }
  }, [isPublicMode]);

  const toggleMedicalIssue = (issue) => {
    setMedicalIssues((prev) =>
      prev.includes(issue)
        ? prev.filter((i) => i !== issue)
        : [...prev, issue]
    );
  };

  const createDependent = (seed = {}) => {
    const localId = seed.local_id || (crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`);

    return {
      id: seed.id || localId,
      local_id: localId,
      full_name: seed.full_name || "",
      email: seed.email || "",
      phone: seed.phone || "",
      gender: seed.gender || "",
      dob: seed.dob ? toDateInputValue(seed.dob) : "",
      joining_date: seed.joining_date ? toDateInputValue(seed.joining_date) : "",
      relation: seed.relation || "",

      address: seed.address || "",
      area: seed.area || "",
      district: seed.district || "",
      pin_code: seed.pin_code || "",

      emergency_contact: seed.emergency_contact || "",
      emergency_relation: seed.emergency_relation || "",

      batch_slot_id: seed.batch_slot_id ? String(seed.batch_slot_id) : "",
      batch_start_time: seed.batch_start_time || "",
      batch_end_time: seed.batch_end_time || "",

      height_cm: seed.height_cm || "",
      weight_kg: seed.weight_kg || "",
      bmi: seed.bmi || "",
      heart_rate: seed.heart_rate || "",
      blood_pressure: seed.blood_pressure || "",
      sugar_level: seed.sugar_level || "",

      medical_issues: Array.isArray(seed.medical_issues)
        ? seed.medical_issues
        : [],
      medical_other: seed.medical_other || "",

      profile_image_url: seed.profile_image_url || "",
      id_proof_type: seed.id_proof_type || "",
      id_proof_url: seed.id_proof_url || "",

      photoFile: null,
      idProofFile: null,
    };
  };


  const addDependent = () => {
    setDependents((prev) => [
      ...prev,
      createDependent({
        joining_date: form.joining_date,
        address: form.address,
        area: form.area,
        district: form.district,
        pin_code: form.pin_code,
      }),
    ]);
  };

  const updateDependent = (id, key, value) => {
    setDependents((prev) =>
      prev.map((d) => (d.id === id ? { ...d, [key]: value } : d))
    );
  };

  const removeDependent = (id) => {
    setDependents((prev) => prev.filter((d) => d.id !== id));
  };

  const handlePrimaryPhotoChange = async (file) => {
    if (!file) return;
    let nextFile = file;

    console.log("📸 Photo selected:", { name: file.name, size: file.size, type: file.type });

    if (file.size > MAX_PHOTO_SIZE) {
      try {
        console.log("📦 Compressing large photo...");
        nextFile = await compressImageFile(file);
        console.log("✅ Photo compressed:", { newSize: nextFile.size });
      } catch (err) {
        console.error("❌ Photo compression failed:", err);
        alert("Unable to process this photo. Please choose a different image.");
        return;
      }
    }

    if (nextFile.size > MAX_PHOTO_SIZE) {
      alert("Photo must be less than 5 MB. Please choose a smaller image.");
      return;
    }

    // Create blob URL for immediate preview (sync)
    const blobUrl = URL.createObjectURL(nextFile);
    setPhotoPreviewUrl(blobUrl);
    
    console.log("🔍 Setting photo file for upload", { fileName: nextFile.name, size: nextFile.size });
    setPhotoFile(nextFile);

    // Also create data URL for persistence across re-renders (async)
    // Important: Do this AFTER setPhotoFile to ensure file is stored
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      // Store in sessionStorage as backup for page navigation/QR flows
      try {
        sessionStorage.setItem("photoPreview", dataUrl);
        console.log("✅ Photo preview stored in sessionStorage");
      } catch (err) {
        console.warn("⚠️ sessionStorage write failed:", err);
      }
      // Replace blob URL with data URL once ready
      setPhotoPreviewUrl(dataUrl);
    };
    reader.onerror = (err) => {
      console.error("❌ FileReader error:", err);
    };
    reader.readAsDataURL(nextFile);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const toggleDependentExpanded = (depId) => {
    setExpandedDependents((prev) => ({
      ...prev,
      [depId]: !prev[depId],
    }));
  };

  const toggleDependentMedicalIssue = (depId, issue) => {
    setDependents((prev) =>
      prev.map((d) => {
        if (d.id !== depId) return d;
        const current = Array.isArray(d.medical_issues) ? d.medical_issues : [];
        const next = current.includes(issue)
          ? current.filter((i) => i !== issue)
          : [...current, issue];
        return {
          ...d,
          medical_issues: next,
          medical_other: next.includes("Other") ? d.medical_other : "",
        };
      })
    );
  };

  const handleDependentPhotoChange = async (depId, file) => {
    if (!file) return;
    let nextFile = file;

    if (file.size > MAX_PHOTO_SIZE) {
      try {
        nextFile = await compressImageFile(file);
      } catch (err) {
        console.error("Dependent photo compression failed:", err);
        alert("Unable to process this photo. Please choose a different image.");
        return;
      }
    }

    if (nextFile.size > MAX_PHOTO_SIZE) {
      alert("Photo must be less than 5 MB. Please choose a smaller image.");
      return;
    }

    // Create blob URL for immediate preview (sync)
    const blobUrl = URL.createObjectURL(nextFile);
    setDependentPhotoPreviewUrls((prev) => ({
      ...prev,
      [depId]: blobUrl,
    }));

    // Also create data URL for persistence across re-renders (async)
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      // Store in sessionStorage as backup for page navigation/QR flows
      try {
        const stored = JSON.parse(sessionStorage.getItem("depPhotosPreviews") || "{}");
        stored[depId] = dataUrl;
        sessionStorage.setItem("depPhotosPreviews", JSON.stringify(stored));
      } catch (err) {
        console.error("sessionStorage write failed:", err);
      }
      // Replace blob URL with data URL once ready
      setDependentPhotoPreviewUrls((prev) => ({
        ...prev,
        [depId]: dataUrl,
      }));
    };
    reader.readAsDataURL(nextFile);

    updateDependent(depId, "photoFile", nextFile);
  };

  const handleDependentIdProofChange = (depId, file) => {
    if (!file) return;
    if (file.size > MAX_ID_PROOF_SIZE) {
      alert("ID proof must be less than 20 MB");
      return;
    }
    updateDependent(depId, "idProofFile", file);
  };

  const setDependentBatchSlot = (depId, slotId) => {
    setDependents((prev) =>
      prev.map((d) => {
        if (d.id !== depId) return d;
        if (!slotId) {
          return {
            ...d,
            batch_slot_id: "",
            batch_start_time: "",
            batch_end_time: "",
          };
        }
        const slot = batchSlots.find(
          (s) => String(s.id) === String(slotId)
        );
        if (!slot) return d;
        return {
          ...d,
          batch_slot_id: String(slotId),
          batch_start_time: slot.start_time,
          batch_end_time: slot.end_time,
        };
      })
    );
  };


  const loadBatchSlots = async () => {
    const { data, error } = await supabase
      .from("batch_slots")
      .select("id, label, start_time, end_time")
      .eq("is_active", true)
      .order("start_time");

    if (!error) setBatchSlots(data || []);
  };

  useEffect(() => {
    loadBatchSlots();
  }, []);

  useEffect(() => {
    if (dependentsHydrated.current) return;
    if (initialDependents === null) return;
    if (!Array.isArray(initialDependents)) return;

    setDependents((prev) => {
      if (prev.length > 0) return prev;
      return initialDependents.map((d) => createDependent(d));
    });

    dependentsHydrated.current = true;
  }, [initialDependents]);

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    gender: "",
    dob: "",
    joining_date: toDateInputValue(new Date()),
    end_date: "",


    address: "",
    area: "",
    district: "",
    pin_code: "",

    emergency_contact: "",
    emergency_relation: "",

    batch_slot_id: "",
    batch_start_time: "",
    batch_end_time: "",

    height_cm: "",
    weight_kg: "",
    bmi: "",
    heart_rate: "",
    blood_pressure: "",
    sugar_level: "",

    package_id: "",
    package_variant_id: "",
    package_price: null,
    discount_amount: 0,
    final_amount: null,
    paid_amount: 0,
    pricing_snapshot: null,
    trainer_id: "",
    profile_image_url: "",
    add_on_ids: [],
    referred_by: null,

    // payment (public join only)
    payment_mode: "",
    payment_claimed: false,
    payment_reference: "",

    // id proof
    id_proof_type: "",

    terms_accepted: false,
  });

  const safePackages = useMemo(
    () => (Array.isArray(packages) ? packages : []),
    [packages]
  );
  const safeAddOns = useMemo(
    () => (Array.isArray(addOns) ? addOns : []),
    [addOns]
  );
  const selectedAddOnIds = useMemo(
    () => new Set((form.add_on_ids || []).map((id) => String(id))),
    [form.add_on_ids]
  );

  const addOnTotal = useMemo(() => {
    return safeAddOns
      .filter((a) => selectedAddOnIds.has(String(a.id)))
      .reduce((sum, a) => sum + Number(a.amount || 0), 0);
  }, [safeAddOns, selectedAddOnIds]);

  const selectedVariant = useMemo(() => {
    return safePackages
      .flatMap(p => p.package_variants || [])
      .find(v => String(v.id) === String(form.package_variant_id));
  }, [safePackages, form.package_variant_id]);

  const selectedPackage = useMemo(() => {
    if (form.package_id) {
      return (
        safePackages.find(
          (p) => String(p.id) === String(form.package_id)
        ) || null
      );
    }

    if (form.package_variant_id) {
      return (
        safePackages.find((p) =>
          (p.package_variants || []).some(
            (v) => String(v.id) === String(form.package_variant_id)
          )
        ) || null
      );
    }

    return null;
  }, [safePackages, form.package_id, form.package_variant_id]);

  const memberScope = selectedPackage?.member_scope || "individual";
  const memberCount = Number(selectedPackage?.member_count || 1);
  const isGroupPackage =
    memberScope === "couple" || memberScope === "family";
  const requiredDependents = isGroupPackage
    ? Math.max(memberCount - 1, 0)
    : 0;
  const shouldShowDependents = isGroupPackage;

  const basePrice = selectedVariant?.price ?? 0;
  const packageFinalAmount =
    couponResult?.is_valid
      ? couponResult.final_price
      : basePrice;
  const finalAmount = packageFinalAmount + addOnTotal;
  const hasVariant = Boolean(selectedVariant);
  const resolvedPackagePrice = hasVariant ? basePrice : null;
  const resolvedDiscountAmount = couponResult?.is_valid
    ? Number(couponResult.discount_amount || 0)
    : 0;
  const resolvedFinalAmount = (hasVariant || addOnTotal > 0) ? finalAmount : null;

  /* ================= HYDRATE EDIT ================= */
  useEffect(() => {
    if (hydrated.current) return;
    if (!initialData || Object.keys(initialData).length === 0) return;

    setForm((f) => ({
      ...f,
      ...initialData,
      joining_date: toDateInputValue(
        initialData.joining_date || initialData.created_at
      ),
      package_variant_id: initialData.package_variant_id
        ? String(initialData.package_variant_id)
        : "",
      batch_slot_id: initialData.batch_slot_id
        ? String(initialData.batch_slot_id)
        : "",
      batch_start_time: initialData.batch_start_time || "",
      batch_end_time: initialData.batch_end_time || "",
      trainer_id: initialData.trainer_id
        ? String(initialData.trainer_id)
        : "",
      profile_image_url: initialData.profile_image_url || "",
      add_on_ids: Array.isArray(initialData.add_on_ids)
        ? initialData.add_on_ids.map((id) => String(id))
        : [],
      referred_by: initialData.referred_by ?? null,
    }));

    if (initialData.referred_by && initialData.referrer_name) {
      setReferrerName(initialData.referrer_name);
    }

    if (Array.isArray(initialData.medical_issues)) {
      setMedicalIssues(initialData.medical_issues);
    }
    if (initialData.medical_other) {
      setOtherMedical(initialData.medical_other);
    }

    hydrated.current = true;
  }, [initialData]);

  useEffect(() => {
    if (!Array.isArray(initialData?.add_on_ids)) return;
    setForm((prev) => {
      const current = Array.isArray(prev.add_on_ids) ? prev.add_on_ids : [];
      if (current.length > 0) return prev;
      return {
        ...prev,
        add_on_ids: initialData.add_on_ids.map((id) => String(id)),
      };
    });
  }, [initialData?.add_on_ids]);

  useEffect(() => {
    if (addOnDatesHydrated.current) return;
    if (!initialAddOnDates || Object.keys(initialAddOnDates).length === 0) return;

    setAddOnDates(initialAddOnDates);
    addOnDatesHydrated.current = true;
  }, [initialAddOnDates]);

  const toggleAddOn = (id, addonMeta) => {
    const key = String(id);
    setForm((prev) => {
      const currentRaw = Array.isArray(prev.add_on_ids) ? prev.add_on_ids : [];
      const current = currentRaw.map(String);
      const exists = current.includes(key);
      const next = exists ? current.filter((x) => x !== key) : [...current, key];

      // Seed / remove date entry
      setAddOnDates((prev) => {
        if (exists) {
          const { [key]: _, ...rest } = prev;
          return rest;
        }
        // Auto-calculate end date using 30-day months
        const today = new Date().toISOString().slice(0, 10);
        let endDate = today;
        if (addonMeta?.duration_value && addonMeta?.duration_unit) {
          const d = new Date(today);
          const unit = addonMeta.duration_unit?.toLowerCase();
          const val = Number(addonMeta.duration_value || 0);

          if (unit === "month") {
            d.setMonth(d.getMonth() + val);
          } else if (unit === "year") {
            d.setFullYear(d.getFullYear() + val);
          } else if (unit === "day" || unit === "days") {
            d.setDate(d.getDate() + val);
          }
          endDate = d.toISOString().slice(0, 10);
        }
        return { ...prev, [key]: { start_date: today, end_date: endDate } };
      });

      return { ...prev, add_on_ids: next };
    });
  };

  /* ================= REFERRAL SEARCH ================= */
  const searchReferral = async (q) => {
    setReferralQuery(q);
    if (!q || q.trim().length < 2) {
      setReferralResults([]);
      return;
    }
    setReferralSearching(true);
    try {
      const { data } = await supabase
        .from("members")
        .select("id, full_name, phone")
        .ilike("phone", `%${q.trim()}%`)
        .eq("is_deleted", false)
        .limit(8);
      setReferralResults(data || []);
    } catch (_) {
      setReferralResults([]);
    } finally {
      setReferralSearching(false);
    }
  };

  const selectReferrer = (member) => {
    setForm((f) => ({ ...f, referred_by: member.id }));
    setReferrerName(member.full_name);
    setReferralQuery("");
    setReferralResults([]);
  };

  const clearReferrer = () => {
    setForm((f) => ({ ...f, referred_by: null }));
    setReferrerName("");
    setReferralQuery("");
    setReferralResults([]);
  };

  /* ================= RESET COUPON ON PACKAGE VARIANT CHANGE ================= */
  useEffect(() => {
    // Coupon should reset when variant changes
    setCouponCode("");
    setCouponResult(null);
    setCouponError(null);
  }, [selectedVariant?.id]);

  useEffect(() => {
    if (!shouldShowDependents) {
      setDependentError("");
      return;
    }

    setDependents((prev) =>
      prev.length > requiredDependents
        ? prev.slice(0, requiredDependents)
        : prev
    );
  }, [shouldShowDependents, requiredDependents]);

  /* ================= SYNC PRICING STATE ================= */
  useEffect(() => {
    setForm((f) => {
      const next = {
        ...f,
        package_price: resolvedPackagePrice,
        discount_amount: resolvedDiscountAmount,
        final_amount: resolvedFinalAmount,
      };

      if (
        f.package_price === next.package_price &&
        f.discount_amount === next.discount_amount &&
        f.final_amount === next.final_amount
      ) {
        return f;
      }

      return next;
    });
  }, [resolvedPackagePrice, resolvedDiscountAmount, resolvedFinalAmount]);

  /* ================= BMI AUTO ================= */
  useEffect(() => {
    const h = Number(form.height_cm);
    const w = Number(form.weight_kg);
    if (h > 0 && w > 0) {
      setForm((f) => ({
        ...f,
        bmi: (w / ((h / 100) ** 2)).toFixed(1),
      }));
    }
  }, [form.height_cm, form.weight_kg]);

  /* ================= AUTO EXPIRY CALCULATION ================= */
  useEffect(() => {
    if (!form.joining_date || !selectedVariant) return;

    const startDate = new Date(form.joining_date);
    if (isNaN(startDate.getTime())) return;

    let endDate = new Date(startDate);
    const { pricing_type, duration_value, duration_unit, duration_months } = selectedVariant;

    if (pricing_type === "duration") {
      const unit = duration_unit?.toLowerCase();
      const val = Number(duration_value || 0);

      if (unit === "month") {
        endDate.setMonth(endDate.getMonth() + val);
      } else if (unit === "year") {
        endDate.setFullYear(endDate.getFullYear() + val);
      } else if (unit === "day" || unit === "days") {
        endDate.setDate(endDate.getDate() + val);
      }
    } else if (pricing_type === "sessions") {
      endDate.setMonth(endDate.getMonth() + Number(duration_months || 0));
    }

    const formattedEndDate = endDate.toISOString().slice(0, 10);

    if (form.end_date !== formattedEndDate) {
      setForm(f => ({ ...f, end_date: formattedEndDate }));
    }
  }, [form.joining_date, form.package_variant_id, selectedVariant]);

  /* ================= PHOTO UPLOAD ================= */

  const uploadPhoto = async (memberId) => {
    if (!photoFile) {
      console.log("⚠️ MemberForm.uploadPhoto: photoFile is null, returning existing URL");
      return form.profile_image_url || null;
    }
    console.log("🔍 MemberForm.uploadPhoto DEBUG:", {
      photoFile: { name: photoFile.name, size: photoFile.size, type: photoFile.type },
      memberId,
    });
    const ext = photoFile.name.split(".").pop();
    const fileName = `member-${memberId}.${ext}`;
    const uploadOptions = { upsert: true };
    if (photoFile.type) uploadOptions.contentType = photoFile.type;
    console.log("📤 MemberForm uploading to storage:", { fileName, bucketName: "member-avatars" });
    const { error, data: uploadData } = await supabase.storage
      .from("member-avatars")
      .upload(fileName, photoFile, uploadOptions);
    console.log("📤 MemberForm storage upload result:", { error, uploadData });
    if (error) throw error;
    const { data } = supabase.storage
      .from("member-avatars")
      .getPublicUrl(fileName);
    console.log("🔗 MemberForm public URL retrieved:", { publicUrl: data.publicUrl });
    return data.publicUrl;
  };

  const uploadIdProof = async (memberId) => {
    if (!idProofFile) return null;
    const ext = idProofFile.name.split(".").pop();
    const fileName = `id-proof-${memberId}.${ext}`;
    const { error } = await supabase.storage
      .from("id-proofs")
      .upload(fileName, idProofFile, { upsert: true });
    if (error) throw error;
    const { data } = supabase.storage
      .from("id-proofs")
      .getPublicUrl(fileName);
    return data.publicUrl;
  }

  const applyCoupon = async (code) => {
    if (!code || !selectedVariant) return;

    setCouponLoading(true);
    setCouponError(null);
    setCouponResult(null);

    const { data, error } = await supabase.rpc("validate_coupon", {
      p_coupon_code: code.trim(),
      p_package_variant_id: Number(selectedVariant.id),
      p_variant_price: Number(selectedVariant.price),
      p_member_id: null,
    });

    if (error || !data || !data.is_valid) {
      setCouponError(data?.reason || "Invalid or expired coupon");
      setCouponResult(null);
    } else {
      setCouponResult(data);
    }

    setCouponLoading(false);
  };

  const uploadDependentPhoto = async (dep) => {
    if (!dep.photoFile) return dep.profile_image_url || null;
    const ext = dep.photoFile.name.split(".").pop();
    const id = dep.local_id || dep.id;
    const fileName = `dependent-${id}.${ext}`;
    const uploadOptions = { upsert: true };
    if (dep.photoFile.type) uploadOptions.contentType = dep.photoFile.type;
    const { error } = await supabase.storage
      .from("member-avatars")
      .upload(fileName, dep.photoFile, uploadOptions);
    if (error) throw error;
    const { data } = supabase.storage
      .from("member-avatars")
      .getPublicUrl(fileName);
    return data.publicUrl;
  };

  const uploadDependentIdProof = async (dep) => {
    if (!dep.idProofFile) return dep.id_proof_url || null;
    const ext = dep.idProofFile.name.split(".").pop();
    const id = dep.local_id || dep.id;
    const fileName = `dependent-id-${id}.${ext}`;
    const { error } = await supabase.storage
      .from("id-proofs")
      .upload(fileName, dep.idProofFile, { upsert: true });
    if (error) throw error;
    const { data } = supabase.storage
      .from("id-proofs")
      .getPublicUrl(fileName);
    return data.publicUrl;
  };


  const validateForm = (form, selectedVariant) => {
    const errors = {};

    // Name
    if (!form.full_name || form.full_name.trim().length < 2) {
      errors.full_name = "Enter a valid full name";
    }

    // Email
    const email = (form.email || "").trim();
    if (email) {
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      if (!emailOk) {
        errors.email = "Enter a valid email address";
      }
    } else if (requireEmail) {
      errors.email = "Email is required";
    }

    // Phone (India)
    if (!/^[6-9]\d{9}$/.test(form.phone)) {
      errors.phone = "Enter a valid 10-digit phone number";
    }

    // Package variant
    if (requirePackageSelection) {
      const hasAddOns =
        Array.isArray(form.add_on_ids) && form.add_on_ids.length > 0;
      const hasPackageVariant = Boolean(form.package_variant_id && selectedVariant);
      if (!hasPackageVariant && !hasAddOns) {
        errors.package =
          "Please select a package or at least one add-on before creating a member.";
      }
    }

    // Batch — only required when a package is selected
    if (selectedVariant) {
      if (!form.batch_start_time || !form.batch_end_time) {
        errors.batch = "Batch start and end time are required";
      }

      if (
        form.batch_start_time &&
        form.batch_end_time &&
        form.batch_end_time <= form.batch_start_time
      ) {
        errors.batch = "Batch end time must be after start time";
      }
    }

    // Terms
    if (requireTermsAcceptance && !form.terms_accepted) {
      errors.terms = "You must accept the terms";
    }

    // Variant-specific validation
    if (selectedVariant) {
      if (selectedVariant.pricing_type === "duration") {
        if (
          !selectedVariant.duration_value ||
          !selectedVariant.duration_unit
        ) {
          errors.package = "Invalid membership plan";
        }
      }

      if (selectedVariant.pricing_type === "sessions") {
        if (
          ![1, 3, 6].includes(selectedVariant.duration_months) ||
          ![4, 5, 6].includes(selectedVariant.weekly_days) ||
          !selectedVariant.sessions_total ||
          selectedVariant.sessions_total <= 0
        ) {
          errors.package = "Invalid personal training plan";
        }
      }
    }

    return errors;
  };

  /* ================= SUBMIT ================= */
  const submit = async (e) => {
    e.preventDefault();

    setError("");
    setDependentError("");
    setIsSubmitting(true);

    if (!String(mode).startsWith("public")) {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error("No active Supabase session");
        setIsSubmitting(false);
        navigate("/login");
        return;
      }
    }

    const package_variant_id = form.package_variant_id
      ? Number(form.package_variant_id)
      : null;

    const hasAddOns =
      Array.isArray(form.add_on_ids) && form.add_on_ids.length > 0;
    const hasPackageVariant = Boolean(package_variant_id && selectedVariant);
    if (requirePackageSelection && !hasPackageVariant && !hasAddOns) {
      setError("Please select a package or at least one add-on before creating a member.");
      setIsSubmitting(false);
      return;
    }
    const package_id = form.package_id ? Number(form.package_id) : null;

    let dependentsPayload = [];
    if (shouldShowDependents) {
      const preparedDependents = dependents.map((d) => ({
        ...d,
        full_name: (d.full_name || "").trim(),
        email: (d.email || "").trim(),
        phone: (d.phone || "").trim(),
      }));

      if (preparedDependents.length !== requiredDependents) {
        const msg = `Please add ${requiredDependents} dependent${requiredDependents === 1 ? "" : "s"} for this package.`;
        setDependentError(msg);
        setError(msg);
        setIsSubmitting(false);
        return;
      }

      for (let i = 0; i < preparedDependents.length; i++) {
        const dep = preparedDependents[i];
        if (!dep.full_name || dep.full_name.length < 2) {
          const msg = `Dependent ${i + 1} needs a valid full name.`;
          setDependentError(msg);
          setError(msg);
          setIsSubmitting(false);
          return;
        }
        if (!/^[6-9]\d{9}$/.test(dep.phone)) {
          const msg = `Dependent ${i + 1} needs a valid 10-digit phone number.`;
          setDependentError(msg);
          setError(msg);
          setIsSubmitting(false);
          return;
        }
      }

      const primaryPhone = (form.phone || "").trim();
      const phones = [primaryPhone, ...preparedDependents.map((d) => d.phone)]
        .filter(Boolean);
      const uniquePhones = new Set(phones);

      if (uniquePhones.size !== phones.length) {
        const msg = "Duplicate phone numbers are not allowed in a group.";
        setDependentError(msg);
        setError(msg);
        setIsSubmitting(false);
        return;
      }

      const uploadedDependents = await Promise.all(
        preparedDependents.map(async (dep) => {
          let profileUrl = dep.profile_image_url || null;
          let idProofUrl = dep.id_proof_url || null;

          if (dep.photoFile) {
            profileUrl = await uploadDependentPhoto(dep);
          }

          if (dep.idProofFile) {
            idProofUrl = await uploadDependentIdProof(dep);
          }

          const bmiValue = computeBmi(dep.height_cm, dep.weight_kg);
          const resolvedBmi = bmiValue
            ? Number(bmiValue)
            : dep.bmi
              ? Number(dep.bmi)
              : null;

          return {
            ...dep,
            profile_image_url: profileUrl,
            id_proof_url: idProofUrl,
            bmi: resolvedBmi,
          };
        })
      );

      dependentsPayload = uploadedDependents.map((d) => ({
        full_name: d.full_name,
        email: d.email || null,
        phone: d.phone,
        gender: d.gender || null,
        dob: d.dob || null,
        joining_date: d.joining_date || form.joining_date || null,
        relation: d.relation || null,

        address: d.address || form.address || null,
        area: d.area || form.area || null,
        district: d.district || form.district || null,
        pin_code: d.pin_code || form.pin_code || null,

        emergency_contact: d.emergency_contact || null,
        emergency_relation: d.emergency_relation || null,

        batch_slot_id: d.batch_slot_id ? Number(d.batch_slot_id) : null,
        batch_start_time: d.batch_start_time || null,
        batch_end_time: d.batch_end_time || null,

        height_cm: d.height_cm ? Number(d.height_cm) : null,
        weight_kg: d.weight_kg ? Number(d.weight_kg) : null,
        bmi: d.bmi || null,
        heart_rate: d.heart_rate ? Number(d.heart_rate) : null,
        blood_pressure: d.blood_pressure || null,
        sugar_level: d.sugar_level || null,

        medical_issues: Array.isArray(d.medical_issues) ? d.medical_issues : [],
        medical_other: (Array.isArray(d.medical_issues) && d.medical_issues.includes("Other"))
          ? (d.medical_other || null)
          : null,

        profile_image_url: d.profile_image_url || null,
        id_proof_type: d.id_proof_type || null,
        id_proof_url: d.id_proof_url || null,
      }));
    }

    if (couponCode && !couponResult?.is_valid) {
      alert("Please apply the coupon or clear the coupon code before submitting.");
      setIsSubmitting(false);
      return;
    }

    const errors = validateForm(form, selectedVariant);

    if (Object.keys(errors).length > 0) {
      alert(Object.values(errors)[0]); // show first error only
      setIsSubmitting(false);
      return;
    }

    if ((enableUpiPayment || enableCashPayment) && !form.payment_mode) {
      alert("Please select a payment method.");
      setIsSubmitting(false);
      return;
    }

    if (enableUpiPayment && form.payment_mode === "upi" && !form.payment_claimed) {
      alert("Please complete the UPI payment before submitting.");
      setIsSubmitting(false);
      return;
    }

    const hasExistingIdProof = Boolean(initialData?.id_proof_url);

    if (
      requireIdProof &&
      (!form.id_proof_type || (!idProofFile && !hasExistingIdProof))
    ) {
      alert("ID proof is required.");
      setIsSubmitting(false);
      return;
    }

    if (requireTermsAcceptance && !form.terms_accepted) {
      alert("You must accept the Terms & Conditions to continue.");
      setIsSubmitting(false);
      return;
    }

    if (
      enableUpiPayment &&
      isIOS() &&
      form.payment_mode === "upi" && form.payment_claimed &&
      !form.payment_reference
    ) {
      alert("Please enter the UPI reference ID after payment.");
      setIsSubmitting(false);
      return;
    }

    let payment_status;
    let package_price;
    let final_amount;
    let paid;

    if (requirePackageSelection && (hasPackageVariant || hasAddOns)) {
      package_price = form.package_price ?? resolvedPackagePrice;
      final_amount = form.final_amount ?? resolvedFinalAmount;

      if (final_amount == null) {
        throw new Error("Pricing not resolved");
      }

      paid = Number(form.paid_amount || 0);
      const total = Number(final_amount);

      payment_status = "unpaid";
      if (paid > 0 && paid < total) payment_status = "partial";
      if (paid >= total) payment_status = "paid";
    }

    const payload = {
      full_name: form.full_name,
      phone: form.phone,
      email: form.email || null,
      gender: form.gender || null,
      dob: form.dob || null,
      joining_date: form.joining_date || null,
      end_date: form.end_date || null,

      address: form.address || null,
      area: form.area || null,
      district: form.district || null,
      pin_code: form.pin_code || null,

      emergency_contact: form.emergency_contact || null,
      emergency_relation: form.emergency_relation || null,

      medical_issues: medicalIssues,
      medical_other: medicalIssues.includes("Other")
        ? otherMedical.trim()
        : null,

      height_cm: form.height_cm ? Number(form.height_cm) : null,
      weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
      bmi: form.bmi ? Number(form.bmi) : null,
      heart_rate: form.heart_rate ? Number(form.heart_rate) : null,
      blood_pressure: form.blood_pressure || null,
      sugar_level: form.sugar_level || null,

      batch_slot_id: form.batch_slot_id
        ? Number(form.batch_slot_id)
        : null,
      batch_start_time: form.batch_start_time || null,
      batch_end_time: form.batch_end_time || null,

      id_proof_type: form.id_proof_type || null,
      terms_accepted: form.terms_accepted,
      add_on_ids: Array.isArray(form.add_on_ids)
        ? [...new Set(form.add_on_ids.map(String))]
        : [],
      referred_by: form.referred_by ? Number(form.referred_by) : null,
      // Always include these so edit flows (without requirePackageSelection) can save them
      package_variant_id: form.package_variant_id ? Number(form.package_variant_id) : null,
      trainer_id: form.trainer_id ? Number(form.trainer_id) : null,
    };

    if (requirePackageSelection) {
      payload.package_id = package_id;
      payload.package_variant_id = package_variant_id;
      payload.package_price = package_price;
      payload.final_amount = final_amount;
      payload.paid_amount = paid;
      payload.payment_status = payment_status;
      payload.pricing_snapshot = form.pricing_snapshot;
      payload.payment_mode = form.payment_mode || null;
      payload.payment_reference = form.payment_reference || null;
      payload.coupon_id = couponResult?.is_valid ? couponResult.id : null;
      payload.discount_amount = couponResult?.is_valid ? couponResult.discount_amount : null;
      payload.trainer_id = form.trainer_id ? Number(form.trainer_id) : null;
    }

    try {
      // Log files being sent to onSubmit
      console.log("📤 FORM SUBMIT - FILES BEING SENT:", {
        hasPhotoFile: !!photoFile,
        photoFileDetails: photoFile ? { name: photoFile.name, size: photoFile.size, type: photoFile.type } : null,
        hasIdProofFile: !!idProofFile,
        idProofFileDetails: idProofFile ? { name: idProofFile.name, size: idProofFile.size, type: idProofFile.type } : null,
        isPublicMode,
      });

      const saved = await onSubmit(
        payload,
        idProofFile,
        photoFile,
        dependentsPayload,
        addOnDates   // { [add_on_id]: { start_date, end_date } }
      );
      const memberId = saved?.id || initialData?.id;

      if (!saved) {
        setIsSubmitting(false);
        return;
      }

      if (!memberId) {
        setIsSubmitting(false);
        return;
      }

      console.log("📋 MemberForm post-submit upload check:", {
        disablePostSubmitUploads,
        hasPhotoFile: !!photoFile,
        hasIdProofFile: !!idProofFile,
        memberId,
      });

      if (disablePostSubmitUploads) {
        console.log("⏭️ MemberForm skipping post-submit uploads due to disablePostSubmitUploads flag");
        setIsSubmitting(false);
        return;
      }

      const updates = {};

      if (photoFile) {
        console.log("📸 MemberForm post-submit: uploading photoFile...");
        try {
          const url = await uploadPhoto(memberId);
          if (url) {
            updates.profile_image_url = url;
            console.log("✅ MemberForm photo upload successful, will update DB");
          }
        } catch (err) {
          console.error("❌ MemberForm photo upload error:", err);
        }
      }

      if (idProofFile) {
        console.log("📄 MemberForm post-submit: uploading idProofFile...");
        try {
          const url = await uploadIdProof(memberId);
          if (url) {
            updates.id_proof_url = url;
            console.log("✅ MemberForm ID proof upload successful, will update DB");
          }
        } catch (err) {
          console.error("❌ MemberForm ID proof upload error:", err);
        }
      }

      if (Object.keys(updates).length > 0) {
        console.log("💾 MemberForm updating member with:", Object.keys(updates));
        await supabase
          .from("members")
          .update(updates)
          .eq("id", memberId);
        console.log("✅ MemberForm database update complete");
      }
      setIsSubmitting(false);
    } catch (err) {
      console.error("MemberForm submit failed");
      console.error("Error:", err);
      console.error("Error message:", err?.message);
      console.error("Error details:", err?.details);
      console.error("Error hint:", err?.hint);
      setError(err?.message || "Failed to save. Please try again.");
      setIsSubmitting(false);
    }
  };

  const showCoupon = mode === "public"; // Rule for showing coupon UI
  const dependentsIncomplete =
    shouldShowDependents &&
    dependents.length !== requiredDependents;
  const hasAddOns =
    Array.isArray(form.add_on_ids) && form.add_on_ids.length > 0;
  const hasPackageVariant = Boolean(form.package_variant_id && selectedVariant);
  const packageRequirementUnmet =
    requirePackageSelection && !hasPackageVariant && !hasAddOns;
  const pricingUnresolved =
    requirePackageSelection && hasPackageVariant && resolvedFinalAmount == null;

  return (
    <form onSubmit={submit} className="max-w-5xl mx-auto px-4 py-6 space-y-8">
      {title && (
        <h1 className="text-2xl font-bold mb-2">{title}</h1>
      )}
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {/* BASIC + LOCATION */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Section title="Basic Information" icon="account_circle">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 border-2 border-dashed border-gray-300 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center text-lg font-bold shrink-0">
              {photoPreviewUrl ? (
                <img src={photoPreviewUrl} className="w-full h-full object-cover" alt="Member photo preview" />
              ) : form.profile_image_url ? (
                <img src={form.profile_image_url} className="w-full h-full object-cover" alt="Member profile" />
              ) : (
                form.full_name?.charAt(0) || "?"
              )}
            </div>

            <div className="flex-1">
              <input
                id="member-photo-upload"
                type="file"
                accept="image/*"
                ref={fileInputRef}
                className="sr-only"
                onChange={(e) => handlePrimaryPhotoChange(e.target.files?.[0])}
              />

              <div className="flex items-center gap-3">
                <label
                  htmlFor="member-photo-upload"
                  className="px-4 py-2 bg-primary text-white rounded-lg text-sm cursor-pointer inline-flex items-center"
                >
                  Upload Photo
                </label>
                <span className="text-xs text-gray-400">
                  JPG/PNG, max 5MB
                </span>
              </div>
            </div>
          </div>

          <Grid>
            <Input label="Full Name *" value={form.full_name} onChange={(v) => setForm(f => ({ ...f, full_name: v }))} />
            <Input
              label={requireEmail ? "Email *" : "Email"}
              value={form.email}
              onChange={(v) => setForm(f => ({ ...f, email: v }))}
            />
            <Input label="Phone *" value={form.phone} onChange={(v) => setForm(f => ({ ...f, phone: v }))} />
            <Select label="Gender" value={form.gender} options={["Male", "Female", "Other"]} onChange={(v) => setForm(f => ({ ...f, gender: v }))} />
            <Input type="date" label="DOB" value={form.dob} onChange={(v) => setForm(f => ({ ...f, dob: v }))} />
            {!isPublicMode && (
              <>
                <Input
                  type="date"
                  label="Joined On"
                  value={form.joining_date}
                  onChange={(v) =>
                    setForm(f => ({ ...f, joining_date: v }))
                  }
                />
                {/* Compact Referral Input */}
                <div className="relative">
                  <label className="text-xs uppercase tracking-wide text-gray-500 mb-1 block">
                    Referral (Optional)
                  </label>
                  {form.referred_by ? (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-green-50 border border-green-200 h-10">
                      <span className="material-icons-round text-green-600 text-sm">person_check</span>
                      <span className="text-sm text-green-700 truncate flex-1 font-medium">{referrerName}</span>
                      <button type="button" onClick={clearReferrer} className="text-green-600 hover:bg-green-100 rounded-full p-1" title="Clear referrer">
                        <span className="material-icons-round text-[16px]">close</span>
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        type="text"
                        value={referralQuery}
                        onChange={(e) => searchReferral(e.target.value)}
                        placeholder="Search by phone..."
                        className="w-full border rounded-lg px-3 py-2 text-sm bg-card h-10 pr-10"
                      />
                      {referralSearching && (
                        <div className="absolute right-3 top-2.5 text-gray-400 text-[10px]">...</div>
                      )}
                      {referralResults.length > 0 && (
                        <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-card border rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto">
                          {referralResults.map((m) => (
                            <button key={m.id} type="button" onClick={() => selectReferrer(m)} className="w-full px-4 py-2.5 text-left hover:bg-primary/5 transition text-sm border-b last:border-0">
                              <div className="font-semibold text-gray-800">{m.full_name}</div>
                              <div className="text-xs text-gray-500">{m.phone}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </Grid>
        </Section>

        <Section
          title="Location & Emergency"
          icon="location_on"
          className="bg-gray-50 border-gray-200">
          <Grid>
            <Input label="Full Address" value={form.address} onChange={(v) => setForm(f => ({ ...f, address: v }))} />
            <Input label="Area" value={form.area} onChange={(v) => setForm(f => ({ ...f, area: v }))} />
            <Input label="District" value={form.district} onChange={(v) => setForm(f => ({ ...f, district: v }))} />
            <Input label="Pincode" value={form.pin_code} onChange={(v) => setForm(f => ({ ...f, pin_code: v }))} />
            <Input label="Emergency Contact" value={form.emergency_contact} onChange={(v) => setForm(f => ({ ...f, emergency_contact: v }))} />
            <Select label="Relation" value={form.emergency_relation} options={RELATIONS} onChange={(v) => setForm(f => ({ ...f, emergency_relation: v }))} />
          </Grid>
        </Section>
      </div>

      {/* BATCH */}
      <Section>
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-primary text-lg font-semibold">
            <span className="material-icons-round">schedule</span>
            Batch Selection
          </h2>
        </div>
        <Select
          label="Batch Preset (optional)"
          value={form.batch_slot_id ?? ""}
          options={batchSlots.map((slot) => ({
            value: String(slot.id),
            label: slot.label,
          }))}
          onChange={(id) => {
            if (!id) {
              setForm(f => ({ ...f, batch_slot_id: "" }));
              return;
            }
            const slot = batchSlots.find(
              (s) => String(s.id) === String(id)
            );
            if (!slot) return;

            setForm(f => ({
              ...f,
              batch_slot_id: id,
              batch_start_time: slot.start_time,
              batch_end_time: slot.end_time,
            }));
          }}
        />
        <div className="grid grid-cols-2 gap-4">
          <Input
            type="time"
            label="Batch Start Time"
            value={form.batch_start_time ?? ""}
            onChange={(v) =>
              setForm(f => ({ ...f, batch_start_time: v }))
            }
          />

          <Input
            type="time"
            label="Batch End Time"
            value={form.batch_end_time ?? ""}
            onChange={(v) =>
              setForm(f => ({ ...f, batch_end_time: v }))
            }
          />
        </div>
        {showSlotEditor && (
          <BatchSlotEditor
            onClose={() => setShowSlotEditor(false)}
            onRefresh={loadBatchSlots}
          />
        )}
      </Section>

      {/* HEALTH VITALS */}
      <Section
        title="Health Vitals"
        icon="monitor_heart"
        className="bg-gray-50 border-gray-200"
      >
        <div className="grid grid-cols-1 md:grid-cols-6 lg:grid-cols-6 gap-3">
          <Input label="Height" value={form.height_cm} onChange={(v) => setForm(f => ({ ...f, height_cm: v }))} />
          <Input label="Weight" value={form.weight_kg} onChange={(v) => setForm(f => ({ ...f, weight_kg: v }))} />
          <Input label="BMI" value={form.bmi} disabled />
          <Input label="Heart Rate" value={form.heart_rate} onChange={(v) => setForm(f => ({ ...f, heart_rate: v }))} />
          <Input label="BP" value={form.blood_pressure} onChange={(v) => setForm(f => ({ ...f, blood_pressure: v }))} />
          <Input label="Sugar" value={form.sugar_level} onChange={(v) => setForm(f => ({ ...f, sugar_level: v }))} />
        </div>
      </Section>

      {/* MEDICAL NOTES */}
      <Section title="Medical Notes" icon="healing">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {MEDICAL_OPTIONS.map((issue) => (
            <label
              key={issue}
              className="flex items-center gap-2 text-sm text-white"
            >
              <input
                type="checkbox"
                checked={medicalIssues.includes(issue)}
                onChange={() => toggleMedicalIssue(issue)}
                className="rounded border-gray-300 accent-black focus:ring-primary"
              />
              {issue}
            </label>
          ))}

          {/* OTHER OPTION */}
          <label className="flex items-center gap-2 text-sm text-white">
            <input
              type="checkbox"
              checked={medicalIssues.includes("Other")}
              onChange={() => toggleMedicalIssue("Other")}
              className="rounded border-gray-300 accent-black focus:ring-primary"
            />
            Other
          </label>
        </div>

        {/* OTHER TEXT INPUT */}
        {medicalIssues.includes("Other") && (
          <input
            type="text"
            placeholder="Specify other medical condition"
            value={otherMedical}
            onChange={(e) => setOtherMedical(e.target.value)}
            className="mt-3 w-full rounded-md border px-3 py-2 text-sm text-white bg-secondary-blue/30 focus:ring-2 focus:ring-primary"
          />
        )}
      </Section>


      {showPackageSection && (
        <Section id="package-section" title="Choose Package" className="border-primary/30 bg-primary/5">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {safePackages.map((pkg) => {
              const isSelected = pkg.package_variants?.some(
                (v) => String(v.id) === String(form.package_variant_id)
              );

              return (
                <div
                  key={pkg.id}
                  className={`rounded-xl overflow-hidden transition-all
              ${isSelected
                      ? "border-2 border-primary shadow-lg shadow-primary/10"
                      : "border border-gray-200 hover:border-primary"
                    }`}
                >
                  {/* CARD HEADER */}
                  <div
                    className={`p-4 border-b text-center font-bold flex items-center justify-center gap-2
                ${isSelected
                        ? "bg-primary text-white border-primary"
                        : "bg-gray-100 text-blue-900"
                      }`}
                  >
                    {pkg.title}
                    {isSelected && (
                      <svg className="w-5 h-5 text-white flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                    {pkg.is_student_offer && (
                      <span className="ml-2 inline-flex px-2 py-0.5 rounded-full text-[10px] bg-yellow-400 text-yellow-900 border border-yellow-500/30 shadow-sm animate-pulse-subtle">
                        Students Offer
                      </span>
                    )}
                  </div>

                  {/* CARD BODY */}
                  <div className="p-3 space-y-2">
                    {pkg.package_variants
                      ?.filter((v) => v.is_active)
                      .map((v) => {
                        const checked = String(form.package_variant_id) === String(v.id);
                        return (
                          <label
                            key={v.id}
                            className={`flex items-center justify-between p-3 rounded-lg cursor-pointer border transition
      ${checked
                                ? "border-primary bg-primary/5"
                                : "border-transparent hover:bg-gray-50"
                              }`}
                          >
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                {checked && (
                                  <svg className="w-4 h-4 text-primary flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                )}
                                <span className="text-sm font-medium">
                                  {v.pricing_type === "duration" && (
                                    <>
                                      {v.duration_value}{" "}
                                      {v.duration_unit === "month" ? "Month" : "Year"}
                                      {v.duration_value > 1 ? "s" : ""}
                                    </>
                                  )}

                                  {v.pricing_type === "sessions" && (
                                    <>
                                      {v.duration_value} Month{v.duration_value > 1 ? "s" : ""} ·{" "}
                                      {v.weekly_days} days/week ·{" "}
                                      {v.sessions_total} Sessions
                                    </>
                                  )}
                                </span>
                              </div>

                              <span className="text-sm font-semibold">
                                ₹{v.price}
                              </span>
                            </div>

                            <input
                              type="radio"
                              name="package_variant"
                              checked={checked}
                              onClick={() => {
                                if (checked) {
                                  setForm((prev) => ({
                                    ...prev,
                                    package_id: "",
                                    package_variant_id: "",
                                    package_price: null,
                                    discount_amount: 0,
                                    final_amount: null,
                                    paid_amount: 0,
                                    pricing_snapshot: null,
                                    end_date: "",
                                  }));
                                }
                              }}
                              onChange={() => {
                                if (!checked) {
                                  setForm((prev) => ({
                                    ...prev,
                                    package_id: pkg.id,
                                    package_variant_id: v.id,
                                    package_price: v.price,
                                    discount_amount: 0,
                                    final_amount: v.price,
                                    paid_amount: 0,
                                    batch_slot_id: pkg.batch_slot_id
                                      ? String(pkg.batch_slot_id)
                                      : prev.batch_slot_id,
                                    batch_start_time:
                                      pkg.batch_start_time || prev.batch_start_time,
                                    batch_end_time:
                                      pkg.batch_end_time || prev.batch_end_time,
                                    pricing_snapshot: {
                                      variant_id: v.id,
                                      variant_name:
                                        v.name ??
                                          `${pkg.title} ${v.pricing_type === "duration"
                                            ? `${v.duration_value} ${v.duration_unit === "month" ? "Month" : "Year"}${v.duration_value > 1 ? "s" : ""}`
                                            : `${v.duration_value} Month${v.duration_value > 1 ? "s" : ""} · ${v.weekly_days} days/week · ${v.sessions_total} Sessions`
                                        }`,
                                      base_price: v.price,
                                    },
                                  }));
                                }
                              }}
                              className="text-primary focus:ring-primary"
                            />
                          </label>
                        );
                      })}
                  </div>
                </div>
              );
            })}
          </div>

          {packageHistory.length > 0 && (
            <div className="mt-6 rounded-lg border border-primary/30 bg-card p-4">
              <h3 className="text-sm font-semibold text-primary mb-3">
                Package History
              </h3>

              <div className="space-y-2">
                {packageHistory.map((p) => (
                  <div
                    key={p.id}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm text-white bg-card px-3 py-2 rounded-md border border-slate-700/20"
                  >
                    <span className="font-medium text-white">
                      {p.packages?.title || "—"}
                    </span>

                    <span className="text-xs text-white sm:text-sm">
                      {p.start_date}
                      {" → "}
                      {p.end_date || "Present"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Section>
      )}

      {showPackageSection && safeAddOns.length > 0 && (
        <Section title="Add-Ons" icon="extension">
          {safeAddOns.length === 0 ? (
            <p className="text-sm text-gray-500">No add-ons available.</p>
          ) : (
            <div className="space-y-3">
              {safeAddOns
                .filter(
                  (a) =>
                    a.is_active !== false ||
                    selectedAddOnIds.has(String(a.id))
                )
                .map((addon) => {
                  const key = String(addon.id);
                  const checked = selectedAddOnIds.has(key);
                  const dates = addOnDates[key] || {};
                  return (
                    <div key={addon.id} className="rounded-lg border overflow-hidden">
                      <label
                        className={`flex items-center justify-between p-3 cursor-pointer transition ${checked ? "border-primary bg-primary/5" : "bg-gray-50 hover:bg-gray-100"
                          }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleAddOn(addon.id, addon)}
                            className="rounded border-gray-300 text-primary focus:ring-primary w-5 h-5"
                          />
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-blue-900">{addon.name}</span>
                            <span className="text-xs text-gray-500">
                              {addon.duration_value} {addon.duration_unit} · ₹
                              {Number(addon.amount || 0).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </label>

                      {/* Date fields for selected add-ons */}
                      {checked && (
                        <div className="px-3 py-2 bg-card border-t grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-white block mb-1">Membership Start Date</label>
                            <input
                              type="date"
                              value={dates.start_date || ""}
                              onChange={(e) => {
                                const newStart = e.target.value;
                                setAddOnDates((prev) => {
                                  let newEnd = newStart;
                                  if (newStart && addon.duration_value && addon.duration_unit) {
                                    const d = new Date(newStart);
                                    const unit = addon.duration_unit?.toLowerCase();
                                    const val = Number(addon.duration_value || 0);

                                    if (unit === "month") {
                                      d.setDate(d.getDate() + val * 30);
                                    } else if (unit === "year") {
                                      d.setFullYear(d.getFullYear() + val);
                                    } else if (unit === "day" || unit === "days") {
                                      d.setDate(d.getDate() + val);
                                    }
                                    newEnd = d.toISOString().slice(0, 10);
                                  }
                                  return { ...prev, [key]: { start_date: newStart, end_date: newEnd } };
                                });
                              }}
                              className="w-full h-9 border rounded-lg px-2 text-sm text-black"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-white block mb-1">Expiry Date (auto-calculated)</label>
                            <input
                              type="date"
                              value={dates.end_date || ""}
                              readOnly
                              disabled
                              className="w-full h-9 border rounded-lg px-2 text-sm bg-gray-50 text-black cursor-not-allowed"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          )}
        </Section>
      )}

      {/* ID PROOF */}
      {true && (
        <Section title={requireIdProof ? "ID Proof (Mandatory)" : "ID Proof (Optional)"} icon="badge">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="ID Type"
              value={form.id_proof_type}
              options={["Aadhar", "Driving License", "Passport", "Voter ID", "Other"]}
              onChange={(v) => setForm(f => ({ ...f, id_proof_type: v }))}
            />
            <div className="flex items-center gap-4">
              <input
                type="file"
                hidden
                accept="image/*,application/pdf"
                ref={idProofInputRef}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) {
                    console.log("⚠️ No ID proof file selected");
                    return;
                  }

                  console.log("📄 ID proof selected:", { name: file.name, size: file.size, type: file.type });

                  if (file.size > MAX_ID_PROOF_SIZE) {
                    console.error("❌ ID proof too large:", { size: file.size, max: MAX_ID_PROOF_SIZE });
                    alert("ID proof must be less than 20 MB");
                    return;
                  }

                  console.log("✅ ID proof file accepted, setting state");
                  setIdProofFile(file);
                }}
              />
              <button
                type="button"
                onClick={() => idProofInputRef.current.click()}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm"
              >
                Upload Document
              </button>
              {idProofFile && (
                <p className="text-sm text-gray-600 truncate">{idProofFile.name}</p>
              )}
              {!idProofFile && initialData.id_proof_url && (
                <a href={`${initialData.id_proof_url}${initialData.id_proof_url.includes('?') ? '&' : '?'}t=${Date.now()}`} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">
                  View Uploaded ID
                </a>
              )}
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Aadhar, Driving License, etc. Allowed JPG, PNG, PDF. Max 20MB.
          </p>
        </Section>
      )}

      {shouldShowDependents && (
        <Section title="Additional Members" icon="group">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-sm text-gray-600">
            <span>Required dependents: {requiredDependents}</span>
            <span>Selected: {dependents.length} / {requiredDependents}</span>
          </div>

          <div className="space-y-4">
            {dependents.map((dep, index) => {
              const isOpen = expandedDependents[dep.id] ?? true;
              const depMedicalIssues = Array.isArray(dep.medical_issues)
                ? dep.medical_issues
                : [];
              const bmiValue = computeBmi(dep.height_cm, dep.weight_kg) || dep.bmi || "";
              const photoPreview = dependentPhotoPreviewUrls[dep.id] || dep.profile_image_url;

              return (
                <div key={dep.id} className="rounded-lg border bg-card">
                  <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b">
                    <div>
                      <div className="text-sm font-semibold">
                        {dep.full_name || `Member ${index + 1}`}
                      </div>
                      <div className="text-xs text-gray-500">
                        {dep.relation || "Relation"} - {dep.phone || "Phone"}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => removeDependent(dep.id)}
                        className="text-xs text-red-600"
                      >
                        Remove
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleDependentExpanded(dep.id)}
                        className="text-xs text-primary flex items-center gap-1"
                      >
                        {isOpen ? "Collapse" : "Expand"}
                        <span className="material-symbols-outlined text-[16px]">
                          {isOpen ? "expand_less" : "expand_more"}
                        </span>
                      </button>
                    </div>
                  </div>

                  {isOpen && (
                    <div className="p-4 space-y-6">
                      <div className="space-y-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Basic Information
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-14 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center text-lg font-bold shrink-0">
                            {photoPreview ? (
                              <img src={photoPreview} className="w-full h-full object-cover" />
                            ) : (
                              dep.full_name?.charAt(0) || "?"
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <input
                              type="file"
                              hidden
                              accept="image/*"
                              id={`dep-photo-${dep.id}`}
                              onChange={(e) =>
                                handleDependentPhotoChange(dep.id, e.target.files?.[0])
                              }
                            />
                            <label
                              htmlFor={`dep-photo-${dep.id}`}
                              className="px-3 py-2 bg-primary text-white rounded-lg text-sm cursor-pointer"
                            >
                              Upload Photo
                            </label>
                            {dep.photoFile && (
                              <span className="text-xs text-gray-500 truncate max-w-[180px]">
                                {dep.photoFile.name}
                              </span>
                            )}
                          </div>
                        </div>

                        <Grid>
                          <Input
                            label="Full Name *"
                            value={dep.full_name}
                            onChange={(v) => updateDependent(dep.id, "full_name", v)}
                          />
                          <Input
                            label="Email"
                            value={dep.email}
                            onChange={(v) => updateDependent(dep.id, "email", v)}
                          />
                          <Input
                            label="Phone *"
                            value={dep.phone}
                            onChange={(v) => updateDependent(dep.id, "phone", v)}
                          />
                          <Select
                            label="Gender"
                            value={dep.gender}
                            options={["Male", "Female", "Other"]}
                            onChange={(v) => updateDependent(dep.id, "gender", v)}
                          />
                          <Input
                            type="date"
                            label="DOB"
                            value={dep.dob}
                            onChange={(v) => updateDependent(dep.id, "dob", v)}
                          />
                          {!isPublicMode && (
                            <Input
                              type="date"
                              label="Joined On"
                              value={dep.joining_date}
                              onChange={(v) => updateDependent(dep.id, "joining_date", v)}
                            />
                          )}
                          <Select
                            label="Relation to Primary"
                            value={dep.relation}
                            options={DEPENDENT_RELATIONS}
                            onChange={(v) => updateDependent(dep.id, "relation", v)}
                          />
                        </Grid>
                      </div>

                      <div className="space-y-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Location & Emergency
                        </div>
                        <Grid>
                          <Input
                            label="Full Address"
                            value={dep.address}
                            onChange={(v) => updateDependent(dep.id, "address", v)}
                          />
                          <Input
                            label="Area"
                            value={dep.area}
                            onChange={(v) => updateDependent(dep.id, "area", v)}
                          />
                          <Input
                            label="District"
                            value={dep.district}
                            onChange={(v) => updateDependent(dep.id, "district", v)}
                          />
                          <Input
                            label="Pincode"
                            value={dep.pin_code}
                            onChange={(v) => updateDependent(dep.id, "pin_code", v)}
                          />
                          <Input
                            label="Emergency Contact"
                            value={dep.emergency_contact}
                            onChange={(v) => updateDependent(dep.id, "emergency_contact", v)}
                          />
                          <Select
                            label="Relation"
                            value={dep.emergency_relation}
                            options={RELATIONS}
                            onChange={(v) => updateDependent(dep.id, "emergency_relation", v)}
                          />
                        </Grid>
                      </div>

                      <div className="space-y-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Batch Selection
                        </div>
                        <Select
                          label="Batch Preset (optional)"
                          value={dep.batch_slot_id ?? ""}
                          options={batchSlots.map((slot) => ({
                            value: String(slot.id),
                            label: slot.label,
                          }))}
                          onChange={(id) => setDependentBatchSlot(dep.id, id)}
                        />
                        <div className="grid grid-cols-2 gap-4">
                          <Input
                            type="time"
                            label="Batch Start Time"
                            value={dep.batch_start_time ?? ""}
                            onChange={(v) =>
                              updateDependent(dep.id, "batch_start_time", v)
                            }
                          />
                          <Input
                            type="time"
                            label="Batch End Time"
                            value={dep.batch_end_time ?? ""}
                            onChange={(v) =>
                              updateDependent(dep.id, "batch_end_time", v)
                            }
                          />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Health Vitals
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-6 lg:grid-cols-6 gap-3">
                          <Input
                            label="Height"
                            value={dep.height_cm}
                            onChange={(v) => updateDependent(dep.id, "height_cm", v)}
                          />
                          <Input
                            label="Weight"
                            value={dep.weight_kg}
                            onChange={(v) => updateDependent(dep.id, "weight_kg", v)}
                          />
                          <Input
                            label="BMI"
                            value={bmiValue}
                            disabled
                          />
                          <Input
                            label="Heart Rate"
                            value={dep.heart_rate}
                            onChange={(v) => updateDependent(dep.id, "heart_rate", v)}
                          />
                          <Input
                            label="BP"
                            value={dep.blood_pressure}
                            onChange={(v) => updateDependent(dep.id, "blood_pressure", v)}
                          />
                          <Input
                            label="Sugar"
                            value={dep.sugar_level}
                            onChange={(v) => updateDependent(dep.id, "sugar_level", v)}
                          />
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Medical Notes
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                          {MEDICAL_OPTIONS.map((issue) => (
                            <label
                              key={issue}
                              className="flex items-center gap-2 text-sm text-white"
                            >
                              <input
                                type="checkbox"
                                checked={depMedicalIssues.includes(issue)}
                                onChange={() =>
                                  toggleDependentMedicalIssue(dep.id, issue)
                                }
                                className="rounded border-gray-300 accent-black focus:ring-primary"
                              />
                              {issue}
                            </label>
                          ))}
                          <label className="flex items-center gap-2 text-sm text-white">
                            <input
                              type="checkbox"
                              checked={depMedicalIssues.includes("Other")}
                              onChange={() =>
                                toggleDependentMedicalIssue(dep.id, "Other")
                              }
                              className="rounded border-gray-300 accent-black focus:ring-primary"
                            />
                            Other
                          </label>
                        </div>

                        {depMedicalIssues.includes("Other") && (
                          <input
                            type="text"
                            placeholder="Specify other medical condition"
                            value={dep.medical_other}
                            onChange={(e) =>
                              updateDependent(dep.id, "medical_other", e.target.value)
                            }
                            className="mt-3 w-full rounded-md border px-3 py-2 text-sm text-white bg-secondary-blue/30 focus:ring-2 focus:ring-primary"
                          />
                        )}
                      </div>

                      <div className="space-y-3">
                        <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                          ID Proof
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <Select
                            label="ID Type"
                            value={dep.id_proof_type}
                            options={["Aadhar", "Driving License", "Passport", "Voter ID", "Other"]}
                            onChange={(v) => updateDependent(dep.id, "id_proof_type", v)}
                          />
                          <div className="flex items-center gap-4">
                            <input
                              type="file"
                              hidden
                              accept="image/*,application/pdf"
                              id={`dep-id-${dep.id}`}
                              onChange={(e) =>
                                handleDependentIdProofChange(dep.id, e.target.files?.[0])
                              }
                            />
                            <label
                              htmlFor={`dep-id-${dep.id}`}
                              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm cursor-pointer"
                            >
                              Upload Document
                            </label>
                            {dep.idProofFile && (
                              <span className="text-sm text-gray-600 truncate max-w-[180px]">
                                {dep.idProofFile.name}
                              </span>
                            )}
                            {!dep.idProofFile && dep.id_proof_url && (
                              <a
                                href={dep.id_proof_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-primary hover:underline"
                              >
                                View Uploaded ID
                              </a>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                          Aadhar, Driving License, etc. Allowed JPG, PNG, PDF. Max 20MB.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {dependents.length < requiredDependents && (
            <button
              type="button"
              onClick={addDependent}
              className="w-full sm:w-auto px-4 py-2 bg-card border rounded-lg text-sm text-primary"
            >
              + Add Member
            </button>
          )}

          {dependentError && (
            <p className="text-sm text-red-600">{dependentError}</p>
          )}
        </Section>
      )}

      {/* TERMS */}
      {requireTermsAcceptance && (
        <Section title="Terms & Conditions" icon="gavel">
          <div className="max-h-48 overflow-y-auto border rounded-lg p-3 text-sm text-gray-600 space-y-2">
            <p><strong>Discipline & Conduct:</strong> Members must follow all instructions given by trainers and staff.</p>
            <p><strong>Training Responsibility:</strong> FLEX GYM is not responsible for injuries caused by improper exercise or failure to follow guidance.</p>
            <p><strong>Health Disclosure:</strong> Members must disclose medical conditions prior to training.</p>
            <p><strong>Damage Liability:</strong> Any damage to gym property must be paid for by the member.</p>
            <p><strong>Prohibited Substances:</strong> Use of drugs or steroids is strictly prohibited.</p>
            <p><strong>Fees:</strong> Membership fees are non-refundable and non-transferable.</p>
            <p><strong>Management Rights:</strong> Gym management may update rules when required.</p>
          </div>

          <label className="flex items-start gap-2 text-sm mt-3">
            <input
              type="checkbox"
              required
              checked={form.terms_accepted}
              onChange={(e) =>
                setForm(f => ({
                  ...f,
                  terms_accepted: e.target.checked,
                }))
              }
            />
            <span>
              I have read and agree to the Terms & Conditions of FLEX GYM
            </span>
          </label>
        </Section>
      )}

      {showCoupon && (enableUpiPayment || enableCashPayment) && (selectedVariant || addOnTotal > 0) && (
        <Section title="Payment" icon="payments" className="bg-gray-50 border-gray-200">
          <div className="space-y-2">
            {finalAmount === 0 && (
              <p className="text-sm text-green-700 font-medium">
                No payment required
              </p>
            )}
            <label className="text-sm font-medium text-gray-600">
              Coupon Code
            </label>

            <div className="flex gap-2">
              <input
                type="text"
                value={couponCode}
                disabled={!selectedVariant || couponLoading || couponResult}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                className="flex-1 border rounded-lg px-3 py-2"
                placeholder="Enter coupon"
              />

              <button
                type="button"
                disabled={!selectedVariant || couponLoading || couponResult}
                onClick={() => applyCoupon(couponCode)}
                className="px-4 py-2 bg-gray-800 text-white rounded-lg disabled:opacity-50"
              >
                {couponLoading ? "Applying..." : "Apply"}
              </button>
              {couponResult && (
                <button
                  type="button"
                  onClick={() => { setCouponCode(""); setCouponResult(null); setCouponError(null); }}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg"
                >
                  Clear
                </button>
              )}
            </div>

            {couponError && (
              <p className="text-sm text-red-600">{couponError}</p>
            )}

            {couponResult?.is_valid && (
              <p className="text-sm text-green-600">
                Coupon applied. You saved ₹{couponResult.discount_amount}
              </p>
            )}
          </div>

          <div className="text-sm text-gray-600">
            <p>Base Price: ₹{basePrice}</p>
            {couponResult?.is_valid && (
              <p className="text-green-600">
                Discount: −₹{couponResult.discount_amount}
              </p>
            )}
            <p className="font-semibold">
              Payable Amount: ₹{finalAmount}
            </p>
          </div>

          <div className="flex items-center space-x-4">
            <label className="text-sm font-medium text-gray-600">Payment Method:</label>
            {enableUpiPayment && (
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="payment_mode"
                  value="upi"
                  checked={form.payment_mode === "upi"}
                  onChange={() => setForm(f => ({ ...f, payment_mode: "upi" }))}
                />
                <span>UPI</span>
              </label>
            )}
            {enableCashPayment && (
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="payment_mode"
                  value="cash"
                  checked={form.payment_mode === "cash"}
                  onChange={() => setForm(f => ({ ...f, payment_mode: "cash" }))}
                />
                <span>Cash</span>
              </label>
            )}
          </div>

          {enableUpiPayment && form.payment_mode === 'upi' && (
            <>
              <UpiPaymentPanel amount={finalAmount} />

              <label className="flex items-start gap-2 text-sm mt-3">
                <input
                  type="checkbox"
                  required
                  checked={form.payment_claimed}
                  onChange={(e) =>
                    setForm(f => ({
                      ...f,
                      payment_claimed: e.target.checked,
                    }))
                  }
                />
                <span>
                  I have initiated the UPI payment
                </span>
              </label>

              <Input
                label={isIOS() ? "UPI Reference ID *" : "UPI Reference ID (optional)"}
                value={form.payment_reference}
                onChange={(v) =>
                  setForm(f => ({
                    ...f,
                    payment_reference: v,
                  }))
                }
              />
            </>
          )}
        </Section>
      )}

      {/* TRAINER */}
      {showTrainerSelect && (
        <Section title="Assigned Trainer" icon="fitness_center">
          <Select
            label="Trainer"
            value={form.trainer_id ?? ""}
            options={trainers.map((t) => ({
              value: t.id,
              label: t.full_name,
            }))}
            onChange={(v) =>
              setForm(f => ({
                ...f,
                trainer_id: v,
              }))
            }
          />
        </Section>
      )}

      <button
        type="submit"
        disabled={
          submitDisabled ||
          isSubmitting ||
          dependentsIncomplete ||
          (enableUpiPayment && form.payment_mode === 'upi' && !form.payment_claimed) ||
          (requireTermsAcceptance && !form.terms_accepted) ||
          packageRequirementUnmet ||
          pricingUnresolved
        }
        className="w-full py-3 bg-primary text-white rounded-lg font-semibold transition-opacity disabled:opacity-50"
      >
        {submitLabel}
      </button>
    </form>
  );
}

/* ================= HELPERS ================= */
const Section = ({ id, title, icon, children, className = "" }) => (
  <div
    id={id}
    className={`bg-card rounded-xl border p-6 ${className}`}
  >
    {title && (
      <div className="flex items-center gap-3 text-primary mb-5">
        {icon && (
          <span className="material-icons-round text-[20px] leading-none">
            {icon}
          </span>
        )}
        <h2 className="text-lg font-semibold leading-none">
          {title}
        </h2>
      </div>
    )}

    <div className="space-y-4">
      {children}
    </div>
  </div>
);



const Grid = ({ children }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{children}</div>
);

const Input = ({ label, value, onChange, type = "text", disabled }) => (
  <div>
    <label className="text-xs uppercase tracking-wide text-white">
      {label}
    </label>
    <input
      type={type}
      value={value ?? ""}
      disabled={disabled}
      onChange={(e) => onChange?.(e.target.value)}
      className="w-full border rounded-lg px-3 py-2 bg-card text-white"
    />
  </div>
);


const Select = ({ label, value, options = [], onChange }) => (
  <div>
    {label && <label className="text-xs uppercase tracking-wide text-white">{label}</label>}
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value)}
      className="w-full border rounded-lg px-3 py-2 bg-card text-white"
    >
      <option value="">Select</option>
      {options.map((o) =>
        typeof o === "string" ? (
          <option key={o} value={o}>{o}</option>
        ) : (
          <option key={o.value} value={o.value}>{o.label}</option>
        )
      )}
    </select>
  </div>
);
