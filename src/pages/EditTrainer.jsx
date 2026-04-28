import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import TrainerForm from "../components/TrainerForm";
import { supabase } from "../supabaseClient";

import { useToast } from "../context/ToastContext";


export default function EditTrainer() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [trainer, setTrainer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // ✅ ACTUALLY USED NOW
  const [photoFile, setPhotoFile] = useState(null);
  const [cvFile, setCvFile] = useState(null);
  const [idProof1File, setIdProof1File] = useState(null);

  /* =========================
     LOAD TRAINER
  ========================= */
  useEffect(() => {
    const loadTrainer = async () => {
      try {
        const { data, error } = await supabase
          .from("trainers")
          .select("*")
          .eq("id", id)
          .single();

        if (error) throw error;
        setTrainer(data);
      } catch (err) {
        console.error("LOAD TRAINER ERROR:", err);
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    };

    loadTrainer();
  }, [id]);

  /* =========================
     UPLOAD PHOTO (HELPER)
  ========================= */
  const uploadTrainerPhoto = async (trainerId) => {
    if (!photoFile) return trainer.profile_image_url || null;

    const ext = photoFile.name.split(".").pop();
    const fileName = `trainer-${trainerId}-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("trainer-avatars")
      .upload(fileName, photoFile, { upsert: true });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from("trainer-avatars")
      .getPublicUrl(fileName);

    return data.publicUrl;
  };

  const uploadDocument = async (trainerId, file, docType) => {
    if (!file) return null;
    const ext = file.name.split(".").pop();
    const fileName = `trainer-${trainerId}-${docType}-${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("trainer-documents")
      .upload(fileName, file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from("trainer-documents")
      .getPublicUrl(fileName);

    return data.publicUrl;
  }

  /* =========================
     GUARDS
  ========================= */
  if (loading) {
    return <div className="p-10">Loading trainer…</div>;
  }

  if (loadError || !trainer) {
    return (
      <div className="p-10 text-red-600">
        Failed to load trainer details.
      </div>
    );
  }

  /* =========================
     SUBMIT
  ========================= */
  const submit = async (payload, documentFiles) => {
    // 🚫 Never update identity/system fields
    const { id: _ignore, created_at, ...rest } = payload;

    // The payload from TrainerForm is already normalized and validated.
    // We just need to strip the non-updatable fields.
    const normalizedPayload = { ...rest };

    // 1️⃣ UPDATE TRAINER DATA
    const { error } = await supabase
      .from("trainers")
      .update(normalizedPayload)
      .eq("id", id);

    if (error) {
      console.error("UPDATE TRAINER FAILED FULL:", JSON.stringify(error, null, 2));
      showToast(error.message, "error");
      return;
    }

    const trainerId = Number(id);
    const updates = {};

    // 2️⃣ UPLOAD PHOTO (IF ANY)
    try {
      const imageUrl = await uploadTrainerPhoto(trainerId);
      if (imageUrl) {
        updates.profile_image_url = imageUrl;
      }
    } catch (err) {
      console.error("PHOTO UPLOAD FAILED:", err);
      showToast("Trainer updated, but photo upload failed", "error");
    }

    const docUploads = [
      { file: documentFiles.cvFile, type: "cv_url" },
      { file: documentFiles.idProof1File, type: "id_proof_1_url" },
    ];

    for (const upload of docUploads) {
      if (upload.file) {
        try {
          const url = await uploadDocument(trainerId, upload.file, upload.type);
          if (url) {
            updates[upload.type] = url;
          }
        } catch (err) {
          console.error(`${upload.type} UPLOAD FAILED:`, err);
          showToast(`Trainer updated, but ${upload.type} upload failed`, "error");
        }
      }
    }

    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabase
        .from("trainers")
        .update(updates)
        .eq("id", trainerId);

      if (updateError) {
        console.error("TRAINER UPDATE FAILED:", updateError);
        showToast("Trainer updated, but failed to save document URLs", "error");
      }
    }

    showToast("Trainer updated successfully", "success");
    navigate("/trainers");
  };

  /* =========================
     RENDER
  ========================= */
  return (
    <div className="mx-auto w-full px-4 sm:px-6 py-6 bg-navy">
      <div className="flex items-center mb-6">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-full hover:bg-slate-800/30"
          aria-label="Go back"
        >
          <span className="material-icons-round">arrow_back</span>
        </button>
        <h1 className="text-2xl font-bold ml-2">Edit Trainer</h1>
      </div>
      <TrainerForm
        initialData={trainer}
        onSubmit={submit}
        submitLabel="Update Trainer"
        // ✅ NEW PROPS
        photoFile={photoFile}
        setPhotoFile={setPhotoFile}
        cvFile={cvFile}
        setCvFile={setCvFile}
        idProof1File={idProof1File}
        setIdProof1File={setIdProof1File}
      />
    </div>
  );
}
